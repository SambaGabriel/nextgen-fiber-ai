"""
User Model
User accounts with RBAC support
"""

from enum import Enum
from typing import Optional, List

from sqlalchemy import Column, String, Boolean, Enum as SQLEnum, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin, SoftDeleteMixin, generate_uuid


class UserRole(str, Enum):
    """
    User roles with hierarchical permissions.
    ADMIN > SUPERVISOR > LINEMAN
    """
    ADMIN = "admin"
    SUPERVISOR = "supervisor"
    LINEMAN = "lineman"


class User(Base, TimestampMixin, SoftDeleteMixin):
    """
    User account model.

    Attributes:
        id: Unique identifier (UUID)
        email: Unique email address (login)
        password_hash: Bcrypt hashed password
        role: User role (ADMIN, SUPERVISOR, LINEMAN)
        first_name: User's first name
        last_name: User's last name
        phone: Contact phone number
        is_active: Whether user can log in
        is_verified: Whether email is verified
        last_login_at: Timestamp of last successful login
        metadata: Additional user data (JSON)
    """
    __tablename__ = "users"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=generate_uuid,
    )
    email = Column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )
    password_hash = Column(
        String(255),
        nullable=False,
    )
    role = Column(
        SQLEnum(UserRole),
        nullable=False,
        default=UserRole.LINEMAN,
        index=True,
    )
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)

    # Account status
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)

    # Tracking
    last_login_at = Column(String(50), nullable=True)  # ISO timestamp
    last_login_ip = Column(String(45), nullable=True)  # IPv6 max length

    # Extensible metadata
    metadata_ = Column("metadata", JSONB, nullable=True, default=dict)

    # Relationships
    assigned_jobs = relationship(
        "JobV2",
        back_populates="assigned_to",
        foreign_keys="JobV2.assigned_to_id",
    )
    created_jobs = relationship(
        "JobV2",
        back_populates="created_by",
        foreign_keys="JobV2.created_by_id",
    )
    uploaded_maps = relationship(
        "Map",
        back_populates="uploaded_by",
        foreign_keys="Map.uploaded_by_id",
    )

    @property
    def full_name(self) -> str:
        """Get full name."""
        return f"{self.first_name} {self.last_name}"

    def has_permission(self, permission: str) -> bool:
        """Check if user has a specific permission based on role."""
        from core.security import ROLE_PERMISSIONS
        return permission in ROLE_PERMISSIONS.get(self.role, set())

    def can_access_job(self, job: "JobV2") -> bool:
        """Check if user can access a specific job."""
        if self.role == UserRole.ADMIN:
            return True
        if self.role == UserRole.SUPERVISOR:
            return True
        # Linemen can only access their own jobs
        return str(job.assigned_to_id) == str(self.id)

    def __repr__(self) -> str:
        return f"<User {self.email} ({self.role.value})>"
