"""
Maps API V2
Map upload, processing, and retrieval endpoints
"""

from datetime import datetime
from typing import Optional, List
import uuid
import math

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import func

from core.database import get_db
from core.security import (
    get_current_user,
    require_permission,
    CurrentUser,
    Permission,
    get_client_ip,
    get_user_agent,
)
from core.feature_flags import is_flag_enabled, Flags
from core.logging import get_logger
from models.db import Map, MapStatus, Span, Equipment, GPSPoint
from schemas.map import (
    MapResponse,
    MapListResponse,
    MapDetailResponse,
    MapStatusResponse,
    SpanResponse,
    EquipmentResponse,
    GPSPointResponse,
    ReprocessRequest,
    TotalsResponse,
    ValidationResponse,
)
from services.storage import get_object_storage, ObjectStorage
from services.queue import get_queue_publisher, QueuePublisher, JobPriority
from services.audit_service import AuditService

router = APIRouter()
logger = get_logger(__name__)


def _map_to_response(map_obj: Map, storage: ObjectStorage = None) -> MapResponse:
    """Convert Map model to MapResponse."""
    download_url = None
    if storage and storage.is_available and map_obj.storage_key:
        download_url = storage.get_presigned_url(
            map_obj.storage_key,
            expires_in=3600,
            download_filename=map_obj.filename,
        )

    totals = None
    if map_obj.totals:
        totals = TotalsResponse(**map_obj.totals)

    validation = None
    if map_obj.validation:
        validation = ValidationResponse(**map_obj.validation)

    return MapResponse(
        id=str(map_obj.id),
        filename=map_obj.filename,
        file_size=map_obj.file_size,
        mime_type=map_obj.mime_type,
        status=map_obj.status.value,
        project_id=map_obj.project_id,
        location=map_obj.location,
        fsa=map_obj.fsa,
        contractor=map_obj.contractor,
        page_count=map_obj.page_count,
        processing_time_ms=map_obj.processing_time_ms,
        overall_confidence=map_obj.overall_confidence,
        totals=totals,
        validation=validation,
        error_message=map_obj.error_message,
        uploaded_by_id=str(map_obj.uploaded_by_id) if map_obj.uploaded_by_id else None,
        created_at=map_obj.created_at.isoformat() if map_obj.created_at else "",
        updated_at=map_obj.updated_at.isoformat() if map_obj.updated_at else "",
        download_url=download_url,
    )


@router.post("", response_model=MapResponse, status_code=status.HTTP_201_CREATED)
async def upload_map(
    request: Request,
    file: UploadFile = File(...),
    project_id: Optional[str] = Form(None),
    auto_process: bool = Form(True),
    priority: int = Form(5),
    current_user: CurrentUser = Depends(require_permission(Permission.MAPS_CREATE)),
    db: Session = Depends(get_db),
):
    """
    Upload a new map for processing.

    - Uploads file to S3/MinIO
    - Creates map record in database
    - Optionally queues for async processing
    """
    # Validate file type
    allowed_types = {"application/pdf", "image/png", "image/jpeg", "image/tiff"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: {allowed_types}",
        )

    # Read file content
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Empty file",
        )

    # Create map record
    map_id = uuid.uuid4()
    storage = get_object_storage()
    storage_key = ObjectStorage.generate_map_key(str(map_id), file.filename)

    # Upload to storage if available
    checksum = None
    if storage.is_available and is_flag_enabled(Flags.OBJECT_STORAGE, current_user.id, current_user.role, db):
        success, checksum = storage.upload_bytes(
            storage_key,
            content,
            content_type=file.content_type,
            metadata={
                "uploaded_by": current_user.id,
                "original_filename": file.filename,
            },
        )
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to upload file to storage",
            )

    # Determine initial status
    initial_status = MapStatus.PENDING
    if auto_process and is_flag_enabled(Flags.ASYNC_MAP_PROCESSING, current_user.id, current_user.role, db):
        initial_status = MapStatus.QUEUED

    # Create database record
    map_obj = Map(
        id=map_id,
        filename=file.filename,
        storage_key=storage_key,
        file_size=len(content),
        mime_type=file.content_type,
        checksum=checksum,
        status=initial_status,
        project_id=project_id,
        uploaded_by_id=uuid.UUID(current_user.id),
        created_by_id=uuid.UUID(current_user.id),
    )
    db.add(map_obj)

    # Audit log
    audit = AuditService(db)
    audit.log_map_operation(
        action="map_upload",
        map_id=str(map_id),
        user_id=current_user.id,
        user_email=current_user.email,
        user_role=current_user.role,
        ip_address=get_client_ip(request),
        metadata={
            "filename": file.filename,
            "file_size": len(content),
            "auto_process": auto_process,
        },
    )

    db.commit()
    db.refresh(map_obj)

    # Queue for processing if enabled
    if auto_process and is_flag_enabled(Flags.ASYNC_MAP_PROCESSING, current_user.id, current_user.role, db):
        publisher = get_queue_publisher()
        publisher.enqueue_map_processing(
            map_id=str(map_id),
            storage_key=storage_key,
            uploaded_by_id=current_user.id,
            priority=JobPriority(min(priority, 20)),
        )

    logger.info(
        "map_uploaded",
        map_id=str(map_id),
        filename=file.filename,
        status=initial_status.value,
    )

    return _map_to_response(map_obj, storage)


@router.get("", response_model=MapListResponse)
async def list_maps(
    status_filter: Optional[str] = Query(None, alias="status"),
    project_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: CurrentUser = Depends(require_permission(Permission.MAPS_READ)),
    db: Session = Depends(get_db),
):
    """
    List maps with pagination and filtering.
    """
    query = db.query(Map)

    # Apply filters
    if status_filter:
        try:
            status_enum = MapStatus(status_filter)
            query = query.filter(Map.status == status_enum)
        except ValueError:
            pass

    if project_id:
        query = query.filter(Map.project_id == project_id)

    # Count total
    total = query.count()

    # Paginate
    offset = (page - 1) * page_size
    maps = query.order_by(Map.created_at.desc()).offset(offset).limit(page_size).all()

    storage = get_object_storage()
    items = [_map_to_response(m, storage) for m in maps]

    return MapListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 1,
    )


@router.get("/{map_id}", response_model=MapDetailResponse)
async def get_map(
    map_id: str,
    current_user: CurrentUser = Depends(require_permission(Permission.MAPS_READ)),
    db: Session = Depends(get_db),
):
    """
    Get map details including extracted spans, equipment, and GPS points.
    """
    try:
        map_uuid = uuid.UUID(map_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid map ID format",
        )

    map_obj = db.query(Map).filter(Map.id == map_uuid).first()
    if map_obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Map not found",
        )

    storage = get_object_storage()
    response = _map_to_response(map_obj, storage)

    # Add extracted data
    spans = [SpanResponse.from_orm(s) for s in map_obj.spans]
    equipment = [EquipmentResponse.from_orm(e) for e in map_obj.equipment]
    gps_points = [GPSPointResponse.from_orm(g) for g in map_obj.gps_points]

    return MapDetailResponse(
        **response.dict(),
        spans=spans,
        equipment=equipment,
        gps_points=gps_points,
    )


@router.get("/{map_id}/status", response_model=MapStatusResponse)
async def get_map_status(
    map_id: str,
    current_user: CurrentUser = Depends(require_permission(Permission.MAPS_READ)),
    db: Session = Depends(get_db),
):
    """
    Get map processing status.
    """
    try:
        map_uuid = uuid.UUID(map_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid map ID format",
        )

    map_obj = db.query(Map).filter(Map.id == map_uuid).first()
    if map_obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Map not found",
        )

    # Calculate progress if processing
    progress = None
    if map_obj.status == MapStatus.PROCESSING:
        # Could be based on page count or time elapsed
        progress = 50  # Placeholder

    # Get queue position if queued
    queue_position = None
    if map_obj.status == MapStatus.QUEUED:
        # Would query Redis for position
        queue_position = 1  # Placeholder

    return MapStatusResponse(
        id=str(map_obj.id),
        status=map_obj.status.value,
        progress=progress,
        processing_started_at=map_obj.processing_started_at,
        processing_completed_at=map_obj.processing_completed_at,
        processing_time_ms=map_obj.processing_time_ms,
        error_message=map_obj.error_message,
        retry_count=map_obj.retry_count,
        queue_position=queue_position,
    )


@router.get("/{map_id}/spans", response_model=List[SpanResponse])
async def get_map_spans(
    map_id: str,
    current_user: CurrentUser = Depends(require_permission(Permission.MAPS_READ)),
    db: Session = Depends(get_db),
):
    """
    Get extracted spans for a map.
    """
    try:
        map_uuid = uuid.UUID(map_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid map ID format",
        )

    map_obj = db.query(Map).filter(Map.id == map_uuid).first()
    if map_obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Map not found",
        )

    return [SpanResponse.from_orm(s) for s in map_obj.spans]


@router.get("/{map_id}/equipment", response_model=List[EquipmentResponse])
async def get_map_equipment(
    map_id: str,
    current_user: CurrentUser = Depends(require_permission(Permission.MAPS_READ)),
    db: Session = Depends(get_db),
):
    """
    Get extracted equipment for a map.
    """
    try:
        map_uuid = uuid.UUID(map_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid map ID format",
        )

    map_obj = db.query(Map).filter(Map.id == map_uuid).first()
    if map_obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Map not found",
        )

    return [EquipmentResponse.from_orm(e) for e in map_obj.equipment]


@router.post("/{map_id}/reprocess", response_model=MapStatusResponse)
async def reprocess_map(
    map_id: str,
    request: Request,
    body: ReprocessRequest,
    current_user: CurrentUser = Depends(require_permission(Permission.MAPS_REPROCESS)),
    db: Session = Depends(get_db),
):
    """
    Queue map for reprocessing.
    """
    try:
        map_uuid = uuid.UUID(map_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid map ID format",
        )

    map_obj = db.query(Map).filter(Map.id == map_uuid).first()
    if map_obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Map not found",
        )

    if not map_obj.can_reprocess:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reprocess map in status: {map_obj.status.value}",
        )

    # Update status
    old_status = map_obj.status.value
    map_obj.status = MapStatus.QUEUED
    map_obj.retry_count += 1
    map_obj.error_message = None
    map_obj.updated_by_id = uuid.UUID(current_user.id)

    # Audit log
    audit = AuditService(db)
    audit.log_map_operation(
        action="map_reprocess",
        map_id=str(map_uuid),
        user_id=current_user.id,
        user_email=current_user.email,
        user_role=current_user.role,
        ip_address=get_client_ip(request),
        metadata={
            "reason": body.reason,
            "old_status": old_status,
            "retry_count": map_obj.retry_count,
        },
    )

    db.commit()

    # Queue for processing
    publisher = get_queue_publisher()
    publisher.enqueue_map_reprocess(
        map_id=str(map_uuid),
        storage_key=map_obj.storage_key,
        reason=body.reason,
        requested_by_id=current_user.id,
        priority=JobPriority(min(body.priority, 20)),
    )

    logger.info(
        "map_reprocess_requested",
        map_id=str(map_uuid),
        reason=body.reason,
    )

    return MapStatusResponse(
        id=str(map_obj.id),
        status=map_obj.status.value,
        progress=None,
        processing_started_at=None,
        processing_completed_at=None,
        processing_time_ms=None,
        error_message=None,
        retry_count=map_obj.retry_count,
        queue_position=1,
    )
