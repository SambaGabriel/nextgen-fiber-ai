"""
Map Model
Fiber optic construction maps with extracted data
"""

from enum import Enum
from typing import Optional, List

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text,
    ForeignKey, Enum as SQLEnum, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin, AuditMixin, generate_uuid


class MapStatus(str, Enum):
    """Map processing status workflow."""
    PENDING = "pending"          # Uploaded, not yet queued
    QUEUED = "queued"            # In processing queue
    PROCESSING = "processing"    # Currently being analyzed
    COMPLETED = "completed"      # Analysis successful
    FAILED = "failed"            # Analysis failed
    CANCELLED = "cancelled"      # Processing cancelled


class Map(Base, TimestampMixin, AuditMixin):
    """
    Fiber optic construction map.

    Represents an uploaded map/drawing that gets analyzed by Claude Vision
    to extract spans, equipment, and GPS coordinates.

    Attributes:
        id: Unique identifier (UUID)
        filename: Original uploaded filename
        storage_key: S3/MinIO object key
        file_size: File size in bytes
        mime_type: File MIME type (application/pdf, image/png, etc.)
        checksum: SHA-256 checksum for integrity verification
        status: Processing status
        project_id: Extracted project identifier
        location: Extracted location/county
        fsa: Fiber Service Area code
        page_count: Number of pages (for PDFs)
        processing_started_at: When processing began
        processing_completed_at: When processing finished
        processing_time_ms: Total processing time
        error_message: Error details if failed
        overall_confidence: Extraction confidence score (0-100)
        totals: Calculated totals (JSON)
        validation: Validation results (JSON)
        raw_extraction: Raw Claude extraction response (JSON)
    """
    __tablename__ = "maps"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=generate_uuid,
    )

    # File info
    filename = Column(String(255), nullable=False)
    storage_key = Column(String(500), nullable=False, unique=True)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(100), nullable=False)
    checksum = Column(String(64), nullable=True)  # SHA-256

    # Processing status
    status = Column(
        SQLEnum(MapStatus),
        nullable=False,
        default=MapStatus.PENDING,
        index=True,
    )

    # Extracted header info
    project_id = Column(String(100), nullable=True, index=True)
    location = Column(String(255), nullable=True)
    fsa = Column(String(50), nullable=True)
    contractor = Column(String(255), nullable=True)

    # Processing metrics
    page_count = Column(Integer, nullable=True)
    processing_started_at = Column(String(50), nullable=True)
    processing_completed_at = Column(String(50), nullable=True)
    processing_time_ms = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)

    # Extraction results
    overall_confidence = Column(Integer, nullable=True)
    totals = Column(JSONB, nullable=True, default=dict)
    validation = Column(JSONB, nullable=True, default=dict)
    raw_extraction = Column(JSONB, nullable=True)

    # Ownership
    uploaded_by_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True,
    )

    # Relationships
    uploaded_by = relationship(
        "User",
        back_populates="uploaded_maps",
        foreign_keys=[uploaded_by_id],
    )
    spans = relationship(
        "Span",
        back_populates="map",
        cascade="all, delete-orphan",
    )
    gps_points = relationship(
        "GPSPoint",
        back_populates="map",
        cascade="all, delete-orphan",
    )
    equipment = relationship(
        "Equipment",
        back_populates="map",
        cascade="all, delete-orphan",
    )
    jobs = relationship(
        "JobV2",
        back_populates="source_map",
    )

    # Indexes
    __table_args__ = (
        Index("ix_maps_status_created", "status", "created_at"),
        Index("ix_maps_uploaded_by_status", "uploaded_by_id", "status"),
    )

    @property
    def is_processed(self) -> bool:
        """Check if map has been processed successfully."""
        return self.status == MapStatus.COMPLETED

    @property
    def can_reprocess(self) -> bool:
        """Check if map can be reprocessed."""
        return self.status in (MapStatus.COMPLETED, MapStatus.FAILED)

    def __repr__(self) -> str:
        return f"<Map {self.filename} ({self.status.value})>"


class Span(Base, TimestampMixin):
    """
    Extracted span measurement from a map.

    Represents a single span/segment between two poles with length measurement.
    """
    __tablename__ = "spans"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=generate_uuid,
    )
    map_id = Column(
        UUID(as_uuid=True),
        ForeignKey("maps.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Span data
    length_ft = Column(Integer, nullable=False)
    start_pole = Column(String(100), nullable=True)
    end_pole = Column(String(100), nullable=True)
    grid_ref = Column(String(50), nullable=True)
    category = Column(String(50), default="AERIAL")  # AERIAL, UNDERGROUND
    cable_type = Column(String(50), nullable=True)
    fiber_count = Column(Integer, nullable=True)
    is_long_span = Column(Boolean, default=False)
    confidence = Column(Integer, default=50)
    page_number = Column(Integer, nullable=True)

    # PostGIS geometry (optional - for future spatial queries)
    # Using simple lat/lng for now
    start_lat = Column(Float, nullable=True)
    start_lng = Column(Float, nullable=True)
    end_lat = Column(Float, nullable=True)
    end_lng = Column(Float, nullable=True)

    # Relationships
    map = relationship("Map", back_populates="spans")

    __table_args__ = (
        Index("ix_spans_map_length", "map_id", "length_ft"),
    )

    def __repr__(self) -> str:
        return f"<Span {self.length_ft}ft ({self.start_pole} -> {self.end_pole})>"


class GPSPoint(Base, TimestampMixin):
    """
    Extracted GPS coordinate from a map.
    """
    __tablename__ = "gps_points"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=generate_uuid,
    )
    map_id = Column(
        UUID(as_uuid=True),
        ForeignKey("maps.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    label = Column(String(255), nullable=True)
    point_type = Column(String(50), nullable=True)  # PEDESTAL, HUB, etc.
    confidence = Column(Integer, default=50)
    page_number = Column(Integer, nullable=True)

    # Relationships
    map = relationship("Map", back_populates="gps_points")

    __table_args__ = (
        Index("ix_gps_points_coords", "lat", "lng"),
    )

    def __repr__(self) -> str:
        return f"<GPSPoint ({self.lat}, {self.lng}) - {self.label}>"


class Equipment(Base, TimestampMixin):
    """
    Extracted equipment item from a map.
    """
    __tablename__ = "equipment"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=generate_uuid,
    )
    map_id = Column(
        UUID(as_uuid=True),
        ForeignKey("maps.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Equipment identification
    equipment_id = Column(String(100), nullable=True)  # From map (e.g., LOUD04-T1_HUB_0354)
    equipment_type = Column(String(50), nullable=False)  # HUB, SPLICE, SLACKLOOP, etc.
    sub_type = Column(String(50), nullable=True)
    size = Column(String(50), nullable=True)  # For slackloops: 288-C, 48-C
    slack_length = Column(Integer, nullable=True)  # Slack length in feet
    dimensions = Column(String(100), nullable=True)  # For pedestals

    # Location
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    grid_ref = Column(String(50), nullable=True)

    # Metadata
    confidence = Column(Integer, default=50)
    page_number = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)

    # Relationships
    map = relationship("Map", back_populates="equipment")

    __table_args__ = (
        Index("ix_equipment_map_type", "map_id", "equipment_type"),
    )

    def __repr__(self) -> str:
        return f"<Equipment {self.equipment_type} - {self.equipment_id}>"
