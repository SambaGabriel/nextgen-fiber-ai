"""
Audit Service
Comprehensive audit logging for all system operations
"""

from typing import Optional, Dict, Any, List
from datetime import datetime
import uuid

from sqlalchemy.orm import Session

from core.logging import get_logger
from models.db import AuditLog, AuditAction

logger = get_logger(__name__)


class AuditService:
    """
    Service for creating and querying audit logs.

    Captures:
    - All CRUD operations
    - Authentication events
    - Status changes
    - User context (IP, user agent)
    - Before/after values for changes
    """

    def __init__(self, db: Session):
        self._db = db

    def log(
        self,
        action: str,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        user_id: Optional[str] = None,
        user_email: Optional[str] = None,
        user_role: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        old_values: Optional[Dict[str, Any]] = None,
        new_values: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        is_success: bool = True,
        error_message: Optional[str] = None,
        duration_ms: Optional[int] = None,
        request_id: Optional[str] = None,
    ) -> AuditLog:
        """
        Create an audit log entry.

        Args:
            action: Action type (from AuditAction enum or custom string)
            entity_type: Type of entity (map, job, user, etc.)
            entity_id: ID of the affected entity
            user_id: ID of user performing action
            user_email: Email of user (denormalized)
            user_role: Role of user at time of action
            ip_address: Client IP address
            user_agent: Client user agent
            old_values: Previous state for updates
            new_values: New state for creates/updates
            metadata: Additional context
            is_success: Whether operation succeeded
            error_message: Error details if failed
            duration_ms: Operation duration
            request_id: Request correlation ID

        Returns:
            Created AuditLog instance
        """
        audit_log = AuditLog(
            id=uuid.uuid4(),
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            user_id=uuid.UUID(user_id) if user_id else None,
            user_email=user_email,
            user_role=user_role,
            ip_address=ip_address,
            user_agent=user_agent,
            old_values=old_values,
            new_values=new_values,
            metadata_=metadata,
            is_success="true" if is_success else "false",
            error_message=error_message,
            duration_ms=str(duration_ms) if duration_ms else None,
            request_id=request_id,
        )

        self._db.add(audit_log)
        # Don't commit here - let the caller manage the transaction

        logger.info(
            "audit_log_created",
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            user_id=user_id,
            is_success=is_success,
        )

        return audit_log

    def log_create(
        self,
        entity_type: str,
        entity_id: str,
        new_values: Dict[str, Any],
        user_id: Optional[str] = None,
        user_email: Optional[str] = None,
        user_role: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> AuditLog:
        """Log a create operation."""
        return self.log(
            action=AuditAction.CREATE.value,
            entity_type=entity_type,
            entity_id=entity_id,
            new_values=new_values,
            user_id=user_id,
            user_email=user_email,
            user_role=user_role,
            ip_address=ip_address,
            user_agent=user_agent,
            metadata=metadata,
        )

    def log_update(
        self,
        entity_type: str,
        entity_id: str,
        old_values: Dict[str, Any],
        new_values: Dict[str, Any],
        user_id: Optional[str] = None,
        user_email: Optional[str] = None,
        user_role: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> AuditLog:
        """Log an update operation."""
        return self.log(
            action=AuditAction.UPDATE.value,
            entity_type=entity_type,
            entity_id=entity_id,
            old_values=old_values,
            new_values=new_values,
            user_id=user_id,
            user_email=user_email,
            user_role=user_role,
            ip_address=ip_address,
            user_agent=user_agent,
            metadata=metadata,
        )

    def log_delete(
        self,
        entity_type: str,
        entity_id: str,
        old_values: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None,
        user_email: Optional[str] = None,
        user_role: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AuditLog:
        """Log a delete operation."""
        return self.log(
            action=AuditAction.DELETE.value,
            entity_type=entity_type,
            entity_id=entity_id,
            old_values=old_values,
            user_id=user_id,
            user_email=user_email,
            user_role=user_role,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    def log_login(
        self,
        user_id: str,
        user_email: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        is_success: bool = True,
        error_message: Optional[str] = None,
    ) -> AuditLog:
        """Log a login attempt."""
        return self.log(
            action=AuditAction.LOGIN.value if is_success else AuditAction.LOGIN_FAILED.value,
            entity_type="user",
            entity_id=user_id if is_success else None,
            user_id=user_id if is_success else None,
            user_email=user_email,
            ip_address=ip_address,
            user_agent=user_agent,
            is_success=is_success,
            error_message=error_message,
            metadata={"attempted_email": user_email} if not is_success else None,
        )

    def log_map_operation(
        self,
        action: str,
        map_id: str,
        user_id: Optional[str] = None,
        user_email: Optional[str] = None,
        user_role: Optional[str] = None,
        ip_address: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        is_success: bool = True,
        error_message: Optional[str] = None,
    ) -> AuditLog:
        """Log a map-related operation."""
        return self.log(
            action=action,
            entity_type="map",
            entity_id=map_id,
            user_id=user_id,
            user_email=user_email,
            user_role=user_role,
            ip_address=ip_address,
            metadata=metadata,
            is_success=is_success,
            error_message=error_message,
        )

    def log_job_operation(
        self,
        action: str,
        job_id: str,
        old_status: Optional[str] = None,
        new_status: Optional[str] = None,
        user_id: Optional[str] = None,
        user_email: Optional[str] = None,
        user_role: Optional[str] = None,
        ip_address: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> AuditLog:
        """Log a job-related operation."""
        old_values = {"status": old_status} if old_status else None
        new_values = {"status": new_status} if new_status else None

        return self.log(
            action=action,
            entity_type="job",
            entity_id=job_id,
            old_values=old_values,
            new_values=new_values,
            user_id=user_id,
            user_email=user_email,
            user_role=user_role,
            ip_address=ip_address,
            metadata=metadata,
        )

    # =========================================
    # Query Methods
    # =========================================

    def get_by_entity(
        self,
        entity_type: str,
        entity_id: str,
        limit: int = 100,
    ) -> List[AuditLog]:
        """Get audit logs for a specific entity."""
        return (
            self._db.query(AuditLog)
            .filter(
                AuditLog.entity_type == entity_type,
                AuditLog.entity_id == entity_id,
            )
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
            .all()
        )

    def get_by_user(
        self,
        user_id: str,
        limit: int = 100,
    ) -> List[AuditLog]:
        """Get audit logs for a specific user."""
        return (
            self._db.query(AuditLog)
            .filter(AuditLog.user_id == uuid.UUID(user_id))
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
            .all()
        )

    def get_by_action(
        self,
        action: str,
        limit: int = 100,
    ) -> List[AuditLog]:
        """Get audit logs for a specific action type."""
        return (
            self._db.query(AuditLog)
            .filter(AuditLog.action == action)
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
            .all()
        )

    def get_recent(
        self,
        limit: int = 100,
        entity_type: Optional[str] = None,
    ) -> List[AuditLog]:
        """Get most recent audit logs."""
        query = self._db.query(AuditLog)
        if entity_type:
            query = query.filter(AuditLog.entity_type == entity_type)
        return query.order_by(AuditLog.created_at.desc()).limit(limit).all()

    def get_failed_operations(
        self,
        limit: int = 100,
    ) -> List[AuditLog]:
        """Get recent failed operations."""
        return (
            self._db.query(AuditLog)
            .filter(AuditLog.is_success == "false")
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
            .all()
        )


# =========================================
# Context Manager for Request Auditing
# =========================================

class AuditContext:
    """
    Context manager for automatically capturing request context in audit logs.

    Usage:
        with AuditContext(db, request, user) as audit:
            audit.log_create("map", map_id, {"filename": "test.pdf"})
    """

    def __init__(
        self,
        db: Session,
        user_id: Optional[str] = None,
        user_email: Optional[str] = None,
        user_role: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        request_id: Optional[str] = None,
    ):
        self._service = AuditService(db)
        self._user_id = user_id
        self._user_email = user_email
        self._user_role = user_role
        self._ip_address = ip_address
        self._user_agent = user_agent
        self._request_id = request_id

    def __enter__(self) -> "AuditContext":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

    def log(
        self,
        action: str,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        old_values: Optional[Dict[str, Any]] = None,
        new_values: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        is_success: bool = True,
        error_message: Optional[str] = None,
        duration_ms: Optional[int] = None,
    ) -> AuditLog:
        """Log with pre-filled request context."""
        return self._service.log(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            user_id=self._user_id,
            user_email=self._user_email,
            user_role=self._user_role,
            ip_address=self._ip_address,
            user_agent=self._user_agent,
            old_values=old_values,
            new_values=new_values,
            metadata=metadata,
            is_success=is_success,
            error_message=error_message,
            duration_ms=duration_ms,
            request_id=self._request_id,
        )


def get_audit_service(db: Session) -> AuditService:
    """FastAPI dependency for audit service."""
    return AuditService(db)
