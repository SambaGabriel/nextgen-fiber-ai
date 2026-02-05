"""
Queue Publisher
Publishes map processing jobs to the queue
"""

from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum

from core.config import get_settings
from core.logging import get_logger
from .redis_client import get_redis_client

settings = get_settings()
logger = get_logger(__name__)


class JobPriority(int, Enum):
    """Job priority levels."""
    LOW = 0
    NORMAL = 5
    HIGH = 10
    URGENT = 20


class QueueNames:
    """Standard queue names."""
    MAP_PROCESSING = "map_processing"
    MAP_REPROCESS = "map_reprocess"
    JOB_CREATION = "job_creation"
    NOTIFICATIONS = "notifications"


class QueuePublisher:
    """
    Publishes jobs to Redis queues.

    Provides type-safe methods for enqueueing different job types.
    """

    def __init__(self):
        self._redis = get_redis_client()

    @property
    def is_available(self) -> bool:
        """Check if queue is available."""
        return self._redis.is_available

    def enqueue_map_processing(
        self,
        map_id: str,
        storage_key: str,
        uploaded_by_id: Optional[str] = None,
        priority: JobPriority = JobPriority.NORMAL,
        callback_url: Optional[str] = None,
    ) -> Optional[str]:
        """
        Queue a map for processing.

        Args:
            map_id: Database map ID
            storage_key: S3 object key
            uploaded_by_id: User who uploaded the map
            priority: Processing priority
            callback_url: Webhook URL for completion notification

        Returns:
            Job ID if enqueued, None otherwise
        """
        job_data = {
            "type": "map_processing",
            "map_id": map_id,
            "storage_key": storage_key,
            "uploaded_by_id": uploaded_by_id,
            "callback_url": callback_url,
            "queued_at": datetime.utcnow().isoformat(),
        }

        job_id = self._redis.enqueue(
            QueueNames.MAP_PROCESSING,
            job_data,
            priority=priority.value,
        )

        if job_id:
            logger.info(
                "map_processing_queued",
                map_id=map_id,
                job_id=job_id,
                priority=priority.name,
            )

        return job_id

    def enqueue_map_reprocess(
        self,
        map_id: str,
        storage_key: str,
        reason: str,
        requested_by_id: str,
        priority: JobPriority = JobPriority.HIGH,
    ) -> Optional[str]:
        """
        Queue a map for reprocessing.

        Args:
            map_id: Database map ID
            storage_key: S3 object key
            reason: Reason for reprocessing
            requested_by_id: User who requested reprocessing
            priority: Processing priority (default HIGH)

        Returns:
            Job ID if enqueued, None otherwise
        """
        job_data = {
            "type": "map_reprocess",
            "map_id": map_id,
            "storage_key": storage_key,
            "reason": reason,
            "requested_by_id": requested_by_id,
            "is_reprocess": True,
            "queued_at": datetime.utcnow().isoformat(),
        }

        job_id = self._redis.enqueue(
            QueueNames.MAP_REPROCESS,
            job_data,
            priority=priority.value,
        )

        if job_id:
            logger.info(
                "map_reprocess_queued",
                map_id=map_id,
                job_id=job_id,
                reason=reason,
            )

        return job_id

    def enqueue_job_creation(
        self,
        map_id: str,
        assigned_to_id: Optional[str] = None,
        auto_publish: bool = True,
        priority: JobPriority = JobPriority.NORMAL,
    ) -> Optional[str]:
        """
        Queue job creation from processed map.

        Args:
            map_id: Processed map ID
            assigned_to_id: Optional lineman to assign
            auto_publish: Whether this is auto-publish
            priority: Creation priority

        Returns:
            Job ID if enqueued, None otherwise
        """
        job_data = {
            "type": "job_creation",
            "map_id": map_id,
            "assigned_to_id": assigned_to_id,
            "auto_publish": auto_publish,
            "queued_at": datetime.utcnow().isoformat(),
        }

        job_id = self._redis.enqueue(
            QueueNames.JOB_CREATION,
            job_data,
            priority=priority.value,
        )

        if job_id:
            logger.info(
                "job_creation_queued",
                map_id=map_id,
                job_id=job_id,
                auto_publish=auto_publish,
            )

        return job_id

    def enqueue_notification(
        self,
        user_id: str,
        notification_type: str,
        payload: Dict[str, Any],
        priority: JobPriority = JobPriority.LOW,
    ) -> Optional[str]:
        """
        Queue a notification for delivery.

        Args:
            user_id: Target user ID
            notification_type: Type of notification
            payload: Notification data
            priority: Delivery priority

        Returns:
            Job ID if enqueued, None otherwise
        """
        job_data = {
            "type": "notification",
            "user_id": user_id,
            "notification_type": notification_type,
            "payload": payload,
            "queued_at": datetime.utcnow().isoformat(),
        }

        return self._redis.enqueue(
            QueueNames.NOTIFICATIONS,
            job_data,
            priority=priority.value,
        )

    def get_queue_stats(self) -> Dict[str, int]:
        """Get queue statistics."""
        return {
            "map_processing": self._redis.get_queue_length(QueueNames.MAP_PROCESSING),
            "map_reprocess": self._redis.get_queue_length(QueueNames.MAP_REPROCESS),
            "job_creation": self._redis.get_queue_length(QueueNames.JOB_CREATION),
            "notifications": self._redis.get_queue_length(QueueNames.NOTIFICATIONS),
        }

    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get job status by ID."""
        return self._redis.get_job_status(job_id)


# Global publisher instance
_publisher: Optional[QueuePublisher] = None


def get_queue_publisher() -> QueuePublisher:
    """Get global queue publisher instance."""
    global _publisher
    if _publisher is None:
        _publisher = QueuePublisher()
    return _publisher
