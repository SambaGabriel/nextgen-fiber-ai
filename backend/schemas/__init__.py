"""
Pydantic Schemas for API V2
Request/Response models for the V2 API
"""

from .auth import (
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    RefreshResponse,
    UserResponse,
    PermissionsResponse,
)
from .map import (
    MapUploadRequest,
    MapResponse,
    MapListResponse,
    MapStatusResponse,
    SpanResponse,
    EquipmentResponse,
    GPSPointResponse,
    ReprocessRequest,
)
from .job import (
    JobCreateRequest,
    JobUpdateRequest,
    JobResponse,
    JobListResponse,
    JobStatusUpdateRequest,
    ProductionSubmitRequest,
    JobStatsResponse,
)

__all__ = [
    # Auth
    "LoginRequest",
    "LoginResponse",
    "RefreshRequest",
    "RefreshResponse",
    "UserResponse",
    "PermissionsResponse",
    # Map
    "MapUploadRequest",
    "MapResponse",
    "MapListResponse",
    "MapStatusResponse",
    "SpanResponse",
    "EquipmentResponse",
    "GPSPointResponse",
    "ReprocessRequest",
    # Job
    "JobCreateRequest",
    "JobUpdateRequest",
    "JobResponse",
    "JobListResponse",
    "JobStatusUpdateRequest",
    "ProductionSubmitRequest",
    "JobStatsResponse",
]
