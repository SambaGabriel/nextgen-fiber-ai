"""
Storage Services
S3/MinIO object storage for map files
"""

from .object_storage import ObjectStorage, get_object_storage

__all__ = [
    "ObjectStorage",
    "get_object_storage",
]
