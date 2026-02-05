"""
Map Schemas
Request/Response models for map operations
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class MapUploadRequest(BaseModel):
    """Map upload request (used with multipart form)."""
    # File is handled separately via UploadFile
    # This is for additional metadata
    project_id: Optional[str] = Field(None, description="Optional project identifier")
    auto_process: bool = Field(True, description="Start processing immediately")
    priority: int = Field(5, ge=0, le=20, description="Processing priority")


class SpanResponse(BaseModel):
    """Span data response."""
    id: str
    length_ft: int
    start_pole: Optional[str] = None
    end_pole: Optional[str] = None
    grid_ref: Optional[str] = None
    category: str = "AERIAL"
    cable_type: Optional[str] = None
    fiber_count: Optional[int] = None
    is_long_span: bool = False
    confidence: int = 50
    page_number: Optional[int] = None

    class Config:
        from_attributes = True


class GPSPointResponse(BaseModel):
    """GPS point data response."""
    id: str
    lat: float
    lng: float
    label: Optional[str] = None
    point_type: Optional[str] = None
    confidence: int = 50

    class Config:
        from_attributes = True


class EquipmentResponse(BaseModel):
    """Equipment data response."""
    id: str
    equipment_id: Optional[str] = None
    equipment_type: str
    sub_type: Optional[str] = None
    size: Optional[str] = None
    slack_length: Optional[int] = None
    dimensions: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    grid_ref: Optional[str] = None
    confidence: int = 50
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class TotalsResponse(BaseModel):
    """Calculated totals response."""
    total_aerial_ft: int = 0
    total_underground_ft: int = 0
    total_cable_ft: int = 0
    span_count: int = 0
    anchor_count: int = 0
    splice_count: int = 0
    hub_count: int = 0
    slackloop_count: int = 0
    pedestal_count: int = 0
    pole_count: int = 0


class ValidationCheckResponse(BaseModel):
    """Validation check result."""
    name: str
    passed: bool
    message: str
    expected: Optional[str] = None
    actual: Optional[str] = None


class ValidationResponse(BaseModel):
    """Validation results response."""
    is_valid: bool = True
    overall_confidence: int = 0
    checks: List[ValidationCheckResponse] = []
    warnings: List[str] = []
    errors: List[str] = []


class MapResponse(BaseModel):
    """Full map response with all data."""
    id: str
    filename: str
    file_size: int
    mime_type: str
    status: str
    project_id: Optional[str] = None
    location: Optional[str] = None
    fsa: Optional[str] = None
    contractor: Optional[str] = None
    page_count: Optional[int] = None
    processing_time_ms: Optional[int] = None
    overall_confidence: Optional[int] = None
    totals: Optional[TotalsResponse] = None
    validation: Optional[ValidationResponse] = None
    error_message: Optional[str] = None
    uploaded_by_id: Optional[str] = None
    created_at: str
    updated_at: str

    # Download URL (presigned, expires)
    download_url: Optional[str] = None

    class Config:
        from_attributes = True


class MapListResponse(BaseModel):
    """Paginated list of maps."""
    items: List[MapResponse]
    total: int
    page: int
    page_size: int
    pages: int


class MapStatusResponse(BaseModel):
    """Map processing status response."""
    id: str
    status: str
    progress: Optional[int] = None  # 0-100 if processing
    processing_started_at: Optional[str] = None
    processing_completed_at: Optional[str] = None
    processing_time_ms: Optional[int] = None
    error_message: Optional[str] = None
    retry_count: int = 0

    # Queue position if queued
    queue_position: Optional[int] = None


class MapDetailResponse(MapResponse):
    """Detailed map response including extracted data."""
    spans: List[SpanResponse] = []
    equipment: List[EquipmentResponse] = []
    gps_points: List[GPSPointResponse] = []


class ReprocessRequest(BaseModel):
    """Map reprocess request."""
    reason: str = Field(..., min_length=1, max_length=500, description="Reason for reprocessing")
    priority: int = Field(10, ge=0, le=20, description="Processing priority")


class MapSearchRequest(BaseModel):
    """Map search parameters."""
    status: Optional[str] = None
    project_id: Optional[str] = None
    location: Optional[str] = None
    uploaded_by_id: Optional[str] = None
    created_after: Optional[datetime] = None
    created_before: Optional[datetime] = None
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)
