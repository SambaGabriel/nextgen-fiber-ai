"""Business Services"""

from .parser import ProductionReportParser
from .validator import ValidationEngine
from .extractor import PDFExtractor
from .integrations import SmartSheetsClient, SmartSheetsSync

__all__ = [
    # Existing
    "ProductionReportParser",
    "ValidationEngine",
    "PDFExtractor",
    "SmartSheetsClient",
    "SmartSheetsSync",
]

# Lazy imports for V2 services
def __getattr__(name):
    if name in ("get_redis_client", "init_redis", "close_redis"):
        from .queue.redis_client import get_redis_client, init_redis, close_redis
        return locals()[name]
    if name in ("get_queue_publisher", "QueuePublisher"):
        from .queue.publisher import get_queue_publisher, QueuePublisher
        return locals()[name]
    if name in ("get_object_storage", "init_object_storage", "close_object_storage", "ObjectStorage"):
        from .storage.object_storage import get_object_storage, init_object_storage, close_object_storage, ObjectStorage
        return locals()[name]
    if name in ("AuditService", "get_audit_service"):
        from .audit_service import AuditService, get_audit_service
        return locals()[name]
    if name in ("create_job_from_map", "get_job_by_map"):
        from .job_service import create_job_from_map, get_job_by_map
        return locals()[name]
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
