"""
Job Model V2
Jobs with database persistence and map linking
"""

from enum import Enum
from typing import Optional

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text,
    ForeignKey, Enum as SQLEnum, Index, Date
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin, AuditMixin, SoftDeleteMixin, generate_uuid


class JobStatusV2(str, Enum):
    """Job status workflow."""
    ASSIGNED = "assigned"             # Job created and assigned
    IN_PROGRESS = "in_progress"       # Lineman started work
    SUBMITTED = "submitted"           # Lineman submitted production
    UNDER_REVIEW = "under_review"     # Supervisor reviewing
    APPROVED = "approved"             # Supervisor approved
    NEEDS_REVISION = "needs_revision" # Supervisor requested changes
    COMPLETED = "completed"           # Fully complete
    CANCELLED = "cancelled"           # Cancelled


class WorkTypeV2(str, Enum):
    """Type of fiber work."""
    AERIAL = "aerial"
    UNDERGROUND = "underground"
    OVERLASH = "overlash"
    MIXED = "mixed"


class JobV2(Base, TimestampMixin, AuditMixin, SoftDeleteMixin):
    """
    Job V2 Model - Persistent job with database storage.

    Represents work assigned to a lineman, optionally linked to a processed map.
    Supports the full workflow from assignment to completion.

    Attributes:
        id: Unique identifier (UUID)
        job_code: Human-readable job code (JOB-2024-001)
        title: Job title/description
        source_map_id: Link to source map (if auto-created from map)
        assigned_to_id: Lineman user ID
        created_by_id: Supervisor user ID who created the job
        client_id: Client identifier
        client_name: Client display name
        work_type: Type of work (AERIAL, UNDERGROUND, etc.)
        status: Job status
        location: Location details (JSON)
        scheduled_date: When work is scheduled
        due_date: Deadline
        estimated_footage: Expected footage from map
        actual_footage: Reported footage from lineman
        supervisor_notes: Instructions from supervisor
        lineman_notes: Notes from lineman
        production_data: Submitted production data (JSON)
        review_notes: Supervisor review notes
    """
    __tablename__ = "jobs_v2"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=generate_uuid,
    )
    job_code = Column(
        String(50),
        unique=True,
        nullable=False,
        index=True,
    )
    title = Column(String(255), nullable=False)

    # Map link (for auto-publish from map analysis)
    source_map_id = Column(
        UUID(as_uuid=True),
        ForeignKey("maps.id"),
        nullable=True,
        index=True,
    )

    # Assignment
    assigned_to_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )
    assigned_at = Column(String(50), nullable=True)  # ISO timestamp

    # Creator (supervisor)
    created_by_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )

    # Client info
    client_id = Column(String(100), nullable=True, index=True)
    client_name = Column(String(255), nullable=True)

    # Work details
    work_type = Column(
        SQLEnum(WorkTypeV2),
        nullable=False,
        default=WorkTypeV2.AERIAL,
    )
    location = Column(JSONB, nullable=True, default=dict)  # {address, city, state, lat, lng}

    # Scheduling
    scheduled_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)

    # Footage
    estimated_footage = Column(Integer, nullable=True)  # From map
    actual_footage = Column(Integer, nullable=True)     # From production

    # Status
    status = Column(
        SQLEnum(JobStatusV2),
        nullable=False,
        default=JobStatusV2.ASSIGNED,
        index=True,
    )
    status_changed_at = Column(String(50), nullable=True)

    # Notes
    supervisor_notes = Column(Text, nullable=True)
    lineman_notes = Column(Text, nullable=True)
    review_notes = Column(Text, nullable=True)

    # Production data (submitted by lineman)
    production_data = Column(JSONB, nullable=True)
    # Structure: {
    #   submittedAt: string,
    #   totalFootage: int,
    #   anchorCount: int,
    #   coilCount: int,
    #   snowshoeCount: int,
    #   entries: [{spanFeet, anchor, fiberNumber, coil, snowshoe, notes}],
    #   photos: [{id, url, ...}],
    # }

    # Map file (if attached directly)
    map_file = Column(JSONB, nullable=True)
    # Structure: {filename, storageKey, size, uploadedAt}

    # Audit fields
    submitted_at = Column(String(50), nullable=True)
    approved_at = Column(String(50), nullable=True)
    approved_by_id = Column(UUID(as_uuid=True), nullable=True)
    completed_at = Column(String(50), nullable=True)

    # Relationships
    source_map = relationship(
        "Map",
        back_populates="jobs",
        foreign_keys=[source_map_id],
    )
    assigned_to = relationship(
        "User",
        back_populates="assigned_jobs",
        foreign_keys=[assigned_to_id],
    )
    created_by = relationship(
        "User",
        back_populates="created_jobs",
        foreign_keys=[created_by_id],
    )

    # Indexes
    __table_args__ = (
        Index("ix_jobs_v2_assigned_status", "assigned_to_id", "status"),
        Index("ix_jobs_v2_status_created", "status", "created_at"),
        Index("ix_jobs_v2_client_status", "client_id", "status"),
    )

    @property
    def is_editable(self) -> bool:
        """Check if job can be edited."""
        return self.status in (JobStatusV2.ASSIGNED, JobStatusV2.IN_PROGRESS, JobStatusV2.NEEDS_REVISION)

    @property
    def can_submit_production(self) -> bool:
        """Check if production can be submitted."""
        return self.status in (JobStatusV2.ASSIGNED, JobStatusV2.IN_PROGRESS, JobStatusV2.NEEDS_REVISION)

    @property
    def can_approve(self) -> bool:
        """Check if job can be approved."""
        return self.status == JobStatusV2.SUBMITTED

    def __repr__(self) -> str:
        return f"<JobV2 {self.job_code} ({self.status.value})>"
