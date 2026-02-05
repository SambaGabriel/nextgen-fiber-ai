"""
Base Model Classes
Common base classes and mixins for all database models
"""

from datetime import datetime
from typing import Optional
import uuid

from sqlalchemy import Column, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, declared_attr

# Base class for all models
Base = declarative_base()


def generate_uuid() -> str:
    """Generate a new UUID string."""
    return str(uuid.uuid4())


class TimestampMixin:
    """
    Mixin that adds created_at and updated_at timestamps.
    Automatically updates updated_at on changes.
    """

    @declared_attr
    def created_at(cls):
        return Column(
            DateTime(timezone=True),
            nullable=False,
            server_default=func.now(),
            index=True,
        )

    @declared_attr
    def updated_at(cls):
        return Column(
            DateTime(timezone=True),
            nullable=False,
            server_default=func.now(),
            onupdate=func.now(),
        )


class AuditMixin:
    """
    Mixin that adds audit fields for tracking who created/modified records.
    """

    @declared_attr
    def created_by_id(cls):
        return Column(UUID(as_uuid=True), nullable=True)

    @declared_attr
    def updated_by_id(cls):
        return Column(UUID(as_uuid=True), nullable=True)


class SoftDeleteMixin:
    """
    Mixin for soft delete support.
    Records are marked as deleted instead of being removed.
    """

    @declared_attr
    def deleted_at(cls):
        return Column(DateTime(timezone=True), nullable=True)

    @declared_attr
    def deleted_by_id(cls):
        return Column(UUID(as_uuid=True), nullable=True)

    @property
    def is_deleted(self) -> bool:
        """Check if record is soft-deleted."""
        return self.deleted_at is not None
