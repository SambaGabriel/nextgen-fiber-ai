"""
Object Storage Service
S3/MinIO client for map file storage
"""

import hashlib
import io
from typing import Optional, BinaryIO, Tuple
from datetime import datetime, timedelta

from core.config import get_settings
from core.logging import get_logger

# boto3 import with fallback
try:
    import boto3
    from botocore.client import Config
    from botocore.exceptions import ClientError
    S3_AVAILABLE = True
except ImportError:
    S3_AVAILABLE = False
    boto3 = None

settings = get_settings()
logger = get_logger(__name__)


class ObjectStorage:
    """
    S3/MinIO object storage client.

    Provides:
    - File upload with checksum verification
    - Presigned URL generation for downloads
    - File existence checking
    - Structured key generation
    """

    _instance: Optional["ObjectStorage"] = None
    _client = None
    _bucket: str = ""

    def __new__(cls) -> "ObjectStorage":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def initialize(
        self,
        endpoint_url: str,
        access_key: str,
        secret_key: str,
        bucket: str,
        region: str = "us-east-1",
    ) -> bool:
        """
        Initialize S3/MinIO client.

        Args:
            endpoint_url: S3/MinIO endpoint (e.g., http://minio:9000)
            access_key: Access key ID
            secret_key: Secret access key
            bucket: Default bucket name
            region: AWS region (for S3)

        Returns:
            True if initialization successful
        """
        if not S3_AVAILABLE:
            logger.warning("s3_not_available", message="boto3 package not installed")
            return False

        if self._client is not None:
            logger.warning("object_storage_already_initialized")
            return True

        try:
            self._client = boto3.client(
                "s3",
                endpoint_url=endpoint_url,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                region_name=region,
                config=Config(
                    signature_version="s3v4",
                    s3={"addressing_style": "path"},
                ),
            )
            self._bucket = bucket

            # Verify bucket exists or create it
            try:
                self._client.head_bucket(Bucket=bucket)
            except ClientError as e:
                error_code = e.response.get("Error", {}).get("Code", "")
                if error_code == "404":
                    self._client.create_bucket(Bucket=bucket)
                    logger.info("bucket_created", bucket=bucket)
                else:
                    raise

            logger.info(
                "object_storage_initialized",
                endpoint=endpoint_url,
                bucket=bucket,
            )
            return True

        except Exception as e:
            logger.error("object_storage_initialization_failed", error=str(e))
            self._client = None
            return False

    @property
    def is_available(self) -> bool:
        """Check if storage is available."""
        return self._client is not None

    @property
    def bucket(self) -> str:
        """Get default bucket name."""
        return self._bucket

    def close(self) -> None:
        """Close client (no-op for boto3, but maintains interface)."""
        self._client = None
        logger.info("object_storage_closed")

    # =========================================
    # Key Generation
    # =========================================

    @staticmethod
    def generate_map_key(map_id: str, filename: str) -> str:
        """
        Generate structured S3 key for map files.

        Pattern: maps/{year}/{month}/{map_id}/{filename}
        """
        now = datetime.utcnow()
        extension = filename.rsplit(".", 1)[-1] if "." in filename else "pdf"
        return f"maps/{now.year}/{now.month:02d}/{map_id}.{extension}"

    @staticmethod
    def generate_photo_key(job_id: str, photo_id: str, extension: str = "jpg") -> str:
        """
        Generate structured S3 key for job photos.

        Pattern: photos/{year}/{month}/{job_id}/{photo_id}.{ext}
        """
        now = datetime.utcnow()
        return f"photos/{now.year}/{now.month:02d}/{job_id}/{photo_id}.{extension}"

    # =========================================
    # Upload Operations
    # =========================================

    def upload_file(
        self,
        key: str,
        data: BinaryIO,
        content_type: str = "application/octet-stream",
        metadata: Optional[dict] = None,
    ) -> Tuple[bool, Optional[str]]:
        """
        Upload file to storage.

        Args:
            key: Object key (path in bucket)
            data: File data (file-like object)
            content_type: MIME type
            metadata: Additional metadata to store

        Returns:
            Tuple of (success, checksum)
        """
        if not self.is_available:
            logger.warning("upload_skipped", reason="storage_not_available")
            return False, None

        try:
            # Read data and calculate checksum
            file_data = data.read()
            checksum = hashlib.sha256(file_data).hexdigest()

            # Upload with metadata
            extra_args = {
                "ContentType": content_type,
                "Metadata": {
                    "checksum-sha256": checksum,
                    "uploaded-at": datetime.utcnow().isoformat(),
                    **(metadata or {}),
                },
            }

            self._client.put_object(
                Bucket=self._bucket,
                Key=key,
                Body=file_data,
                **extra_args,
            )

            logger.info(
                "file_uploaded",
                key=key,
                size=len(file_data),
                checksum=checksum[:16],
            )
            return True, checksum

        except Exception as e:
            logger.error("file_upload_failed", key=key, error=str(e))
            return False, None

    def upload_bytes(
        self,
        key: str,
        data: bytes,
        content_type: str = "application/octet-stream",
        metadata: Optional[dict] = None,
    ) -> Tuple[bool, Optional[str]]:
        """Upload raw bytes to storage."""
        return self.upload_file(key, io.BytesIO(data), content_type, metadata)

    # =========================================
    # Download Operations
    # =========================================

    def download_file(self, key: str) -> Optional[bytes]:
        """
        Download file from storage.

        Args:
            key: Object key

        Returns:
            File bytes if successful, None otherwise
        """
        if not self.is_available:
            return None

        try:
            response = self._client.get_object(Bucket=self._bucket, Key=key)
            return response["Body"].read()
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            if error_code == "NoSuchKey":
                logger.warning("file_not_found", key=key)
            else:
                logger.error("file_download_failed", key=key, error=str(e))
            return None
        except Exception as e:
            logger.error("file_download_failed", key=key, error=str(e))
            return None

    def get_presigned_url(
        self,
        key: str,
        expires_in: int = 3600,
        download_filename: Optional[str] = None,
    ) -> Optional[str]:
        """
        Generate presigned URL for file download.

        Args:
            key: Object key
            expires_in: URL expiration time in seconds
            download_filename: Suggested filename for download

        Returns:
            Presigned URL if successful, None otherwise
        """
        if not self.is_available:
            return None

        try:
            params = {
                "Bucket": self._bucket,
                "Key": key,
            }
            if download_filename:
                params["ResponseContentDisposition"] = f'attachment; filename="{download_filename}"'

            url = self._client.generate_presigned_url(
                "get_object",
                Params=params,
                ExpiresIn=expires_in,
            )
            return url

        except Exception as e:
            logger.error("presigned_url_failed", key=key, error=str(e))
            return None

    def get_presigned_upload_url(
        self,
        key: str,
        content_type: str = "application/octet-stream",
        expires_in: int = 3600,
    ) -> Optional[str]:
        """
        Generate presigned URL for direct upload.

        Args:
            key: Object key
            content_type: Expected content type
            expires_in: URL expiration time in seconds

        Returns:
            Presigned URL for PUT if successful, None otherwise
        """
        if not self.is_available:
            return None

        try:
            url = self._client.generate_presigned_url(
                "put_object",
                Params={
                    "Bucket": self._bucket,
                    "Key": key,
                    "ContentType": content_type,
                },
                ExpiresIn=expires_in,
            )
            return url

        except Exception as e:
            logger.error("presigned_upload_url_failed", key=key, error=str(e))
            return None

    # =========================================
    # Utility Operations
    # =========================================

    def file_exists(self, key: str) -> bool:
        """Check if file exists in storage."""
        if not self.is_available:
            return False

        try:
            self._client.head_object(Bucket=self._bucket, Key=key)
            return True
        except ClientError:
            return False

    def delete_file(self, key: str) -> bool:
        """Delete file from storage."""
        if not self.is_available:
            return False

        try:
            self._client.delete_object(Bucket=self._bucket, Key=key)
            logger.info("file_deleted", key=key)
            return True
        except Exception as e:
            logger.error("file_delete_failed", key=key, error=str(e))
            return False

    def get_file_metadata(self, key: str) -> Optional[dict]:
        """Get file metadata."""
        if not self.is_available:
            return None

        try:
            response = self._client.head_object(Bucket=self._bucket, Key=key)
            return {
                "content_type": response.get("ContentType"),
                "content_length": response.get("ContentLength"),
                "last_modified": response.get("LastModified"),
                "metadata": response.get("Metadata", {}),
            }
        except ClientError:
            return None

    def verify_checksum(self, key: str, expected_checksum: str) -> bool:
        """Verify file checksum matches expected value."""
        data = self.download_file(key)
        if data is None:
            return False

        actual = hashlib.sha256(data).hexdigest()
        return actual == expected_checksum


# Global storage instance
_storage: Optional[ObjectStorage] = None


def get_object_storage() -> ObjectStorage:
    """Get global object storage instance."""
    global _storage
    if _storage is None:
        _storage = ObjectStorage()
    return _storage


def init_object_storage(
    endpoint_url: str,
    access_key: str,
    secret_key: str,
    bucket: str,
) -> bool:
    """Initialize object storage at application startup."""
    storage = get_object_storage()
    return storage.initialize(endpoint_url, access_key, secret_key, bucket)


def close_object_storage() -> None:
    """Close object storage at application shutdown."""
    storage = get_object_storage()
    storage.close()
