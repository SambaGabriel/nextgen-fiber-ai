"""
Audit Log Model
Complete audit trail for all system operations
"""

from enum import Enum
from typing import Optional

from sqlalchemy import Column, String, Text, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB

from .base import Base, TimestampMixin, generate_uuid


class AuditAction(str, Enum):
    """Types of auditable actions."""
    # CRUD operations
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"

    # Authentication
    LOGIN = "login"
    LOGOUT = "logout"
    LOGIN_FAILED = "login_failed"
    PASSWORD_CHANGE = "password_change"
    TOKEN_REFRESH = "token_refresh"

    # Map operations
    MAP_UPLOAD = "map_upload"
    MAP_PROCESS = "map_process"
    MAP_REPROCESS = "map_reprocess"
    MAP_PROCESS_FAILED = "map_process_failed"

    # Job operations
    JOB_ASSIGN = "job_assign"
    JOB_START = "job_start"
    JOB_SUBMIT = "job_submit"
    JOB_APPROVE = "job_approve"
    JOB_REJECT = "job_reject"
    JOB_COMPLETE = "job_complete"
    JOB_CANCEL = "job_cancel"

    # System operations
    FEATURE_FLAG_CHANGE = "feature_flag_change"
    PERMISSION_CHANGE = "permission_change"
    SYSTEM_ERROR = "system_error"


class AuditLog(Base, TimestampMixin):
    """
    Audit log entry.

    Captures all significant system operations with full context
    for compliance and debugging.

    Attributes:
        id: Unique identifier (UUID)
        action: Type of action performed
        entity_type: Type of entity affected (user, map, job, etc.)
        entity_id: ID of the affected entity
        user_id: ID of user who performed the action
        user_email: Email of user (denormalized for queries)
        user_role: Role of user at time of action
        ip_address: Client IP address
        user_agent: Client user agent string
        old_values: Previous state (for updates)
        new_values: New state (for creates/updates)
        metadata: Additional context
        error_message: Error details if action failed
        duration_ms: Operation duration in milliseconds
        request_id: Correlation ID for request tracing
    """
    __tablename__ = "audit_logs"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=generate_uuid,
    )

    # Action details
    action = Column(String(50), nullable=False, index=True)
    entity_type = Column(String(50), nullable=True, index=True)
    entity_id = Column(String(100), nullable=True, index=True)

    # User context
    user_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    user_email = Column(String(255), nullable=True)
    user_role = Column(String(50), nullable=True)

    # Request context
    ip_address = Column(String(45), nullable=True)  # IPv6 max length
    user_agent = Column(Text, nullable=True)
    request_id = Column(String(100), nullable=True, index=True)

    # State capture
    old_values = Column(JSONB, nullable=True)
    new_values = Column(JSONB, nullable=True)
    metadata_ = Column("metadata", JSONB, nullable=True)

    # Error tracking
    error_message = Column(Text, nullable=True)
    is_success = Column(String(10), default="true", nullable=False)

    # Performance
    duration_ms = Column(String(20), nullable=True)

    # Indexes for common queries
    __table_args__ = (
        Index("ix_audit_logs_user_action", "user_id", "action"),
        Index("ix_audit_logs_entity", "entity_type", "entity_id"),
        Index("ix_audit_logs_created", "created_at"),
        Index("ix_audit_logs_action_created", "action", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<AuditLog {self.action} on {self.entity_type}:{self.entity_id}>"

    def to_dict(self) -> dict:
        """Convert to dictionary for API responses."""
        return {
            "id": str(self.id),
            "action": self.action,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "user_id": str(self.user_id) if self.user_id else None,
            "user_email": self.user_email,
            "user_role": self.user_role,
            "ip_address": self.ip_address,
            "old_values": self.old_values,
            "new_values": self.new_values,
            "metadata": self.metadata_,
            "is_success": self.is_success == "true",
            "error_message": self.error_message,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
