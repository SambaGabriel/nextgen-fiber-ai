"""
Job Schemas
Request/Response models for job operations
"""

from typing import Optional, List, Dict, Any
from datetime import date
from pydantic import BaseModel, Field


class LocationSchema(BaseModel):
    """Location information."""
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class ProductionEntrySchema(BaseModel):
    """Single production entry from lineman."""
    span_feet: int = Field(..., ge=0)
    anchor: bool = False
    fiber_number: Optional[str] = None
    coil: bool = False
    snowshoe: bool = False
    notes: Optional[str] = None


class PhotoSchema(BaseModel):
    """Photo metadata."""
    id: str
    filename: Optional[str] = None
    url: Optional[str] = None  # Presigned URL or base64
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    captured_at: Optional[str] = None


class ProductionDataSchema(BaseModel):
    """Production data submitted by lineman."""
    total_footage: int = Field(..., ge=0)
    anchor_count: int = Field(0, ge=0)
    coil_count: int = Field(0, ge=0)
    snowshoe_count: int = Field(0, ge=0)
    entries: List[ProductionEntrySchema] = []
    photos: List[PhotoSchema] = []
    lineman_notes: Optional[str] = None


class JobCreateRequest(BaseModel):
    """Job creation request."""
    title: str = Field(..., min_length=1, max_length=255)
    assigned_to_id: Optional[str] = Field(None, description="Lineman user ID")
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    work_type: str = Field(default="aerial", pattern="^(aerial|underground|overlash|mixed)$")
    location: Optional[LocationSchema] = None
    scheduled_date: Optional[date] = None
    due_date: Optional[date] = None
    estimated_footage: Optional[int] = Field(None, ge=0)
    supervisor_notes: Optional[str] = None
    source_map_id: Optional[str] = Field(None, description="Link to processed map")


class JobUpdateRequest(BaseModel):
    """Job update request."""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    assigned_to_id: Optional[str] = None
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    work_type: Optional[str] = Field(None, pattern="^(aerial|underground|overlash|mixed)$")
    location: Optional[LocationSchema] = None
    scheduled_date: Optional[date] = None
    due_date: Optional[date] = None
    estimated_footage: Optional[int] = Field(None, ge=0)
    supervisor_notes: Optional[str] = None
    lineman_notes: Optional[str] = None


class JobStatusUpdateRequest(BaseModel):
    """Job status update request."""
    status: str = Field(
        ...,
        pattern="^(assigned|in_progress|submitted|under_review|approved|needs_revision|completed|cancelled)$"
    )
    notes: Optional[str] = Field(None, max_length=1000, description="Status change notes")


class ProductionSubmitRequest(BaseModel):
    """Production submission request from lineman."""
    production_data: ProductionDataSchema
    notes: Optional[str] = None


class MapFileSchema(BaseModel):
    """Attached map file info."""
    filename: str
    storage_key: str
    size: int
    uploaded_at: str
    download_url: Optional[str] = None


class JobResponse(BaseModel):
    """Full job response."""
    id: str
    job_code: str
    title: str
    source_map_id: Optional[str] = None
    assigned_to_id: Optional[str] = None
    assigned_to_name: Optional[str] = None
    assigned_at: Optional[str] = None
    created_by_id: Optional[str] = None
    created_by_name: Optional[str] = None
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    work_type: str
    location: Optional[LocationSchema] = None
    scheduled_date: Optional[str] = None
    due_date: Optional[str] = None
    estimated_footage: Optional[int] = None
    actual_footage: Optional[int] = None
    status: str
    status_changed_at: Optional[str] = None
    supervisor_notes: Optional[str] = None
    lineman_notes: Optional[str] = None
    review_notes: Optional[str] = None
    production_data: Optional[ProductionDataSchema] = None
    map_file: Optional[MapFileSchema] = None
    submitted_at: Optional[str] = None
    approved_at: Optional[str] = None
    completed_at: Optional[str] = None
    created_at: str
    updated_at: str

    # Computed flags
    is_editable: bool = True
    can_submit_production: bool = True
    can_approve: bool = False

    class Config:
        from_attributes = True


class JobListResponse(BaseModel):
    """Paginated list of jobs."""
    items: List[JobResponse]
    total: int
    page: int
    page_size: int
    pages: int


class JobStatsResponse(BaseModel):
    """Job statistics response."""
    total: int = 0
    assigned: int = 0
    in_progress: int = 0
    submitted: int = 0
    approved: int = 0
    needs_revision: int = 0
    completed: int = 0
    cancelled: int = 0


class JobSearchRequest(BaseModel):
    """Job search parameters."""
    status: Optional[str] = None
    assigned_to_id: Optional[str] = None
    client_id: Optional[str] = None
    work_type: Optional[str] = None
    source_map_id: Optional[str] = None
    scheduled_after: Optional[date] = None
    scheduled_before: Optional[date] = None
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)
