"""
Jobs API V2
Job management endpoints with database persistence
"""

from datetime import datetime
from typing import Optional, List
import uuid
import math

from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session, joinedload
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
from core.logging import get_logger
from models.db import JobV2, JobStatusV2, WorkTypeV2, User, Map
from schemas.job import (
    JobCreateRequest,
    JobUpdateRequest,
    JobResponse,
    JobListResponse,
    JobStatusUpdateRequest,
    ProductionSubmitRequest,
    JobStatsResponse,
    LocationSchema,
    ProductionDataSchema,
    MapFileSchema,
)
from services.audit_service import AuditService, AuditAction

router = APIRouter()
logger = get_logger(__name__)


def _generate_job_code() -> str:
    """Generate unique job code."""
    year = datetime.utcnow().year
    random_part = uuid.uuid4().hex[:6].upper()
    return f"JOB-{year}-{random_part}"


def _job_to_response(job: JobV2) -> JobResponse:
    """Convert JobV2 model to JobResponse."""
    # Get assigned user name
    assigned_to_name = None
    if job.assigned_to:
        assigned_to_name = job.assigned_to.full_name

    created_by_name = None
    if job.created_by:
        created_by_name = job.created_by.full_name

    location = None
    if job.location:
        location = LocationSchema(**job.location)

    production_data = None
    if job.production_data:
        production_data = ProductionDataSchema(**job.production_data)

    map_file = None
    if job.map_file:
        map_file = MapFileSchema(**job.map_file)

    return JobResponse(
        id=str(job.id),
        job_code=job.job_code,
        title=job.title,
        source_map_id=str(job.source_map_id) if job.source_map_id else None,
        assigned_to_id=str(job.assigned_to_id) if job.assigned_to_id else None,
        assigned_to_name=assigned_to_name,
        assigned_at=job.assigned_at,
        created_by_id=str(job.created_by_id) if job.created_by_id else None,
        created_by_name=created_by_name,
        client_id=job.client_id,
        client_name=job.client_name,
        work_type=job.work_type.value,
        location=location,
        scheduled_date=str(job.scheduled_date) if job.scheduled_date else None,
        due_date=str(job.due_date) if job.due_date else None,
        estimated_footage=job.estimated_footage,
        actual_footage=job.actual_footage,
        status=job.status.value,
        status_changed_at=job.status_changed_at,
        supervisor_notes=job.supervisor_notes,
        lineman_notes=job.lineman_notes,
        review_notes=job.review_notes,
        production_data=production_data,
        map_file=map_file,
        submitted_at=job.submitted_at,
        approved_at=job.approved_at,
        completed_at=job.completed_at,
        created_at=job.created_at.isoformat() if job.created_at else "",
        updated_at=job.updated_at.isoformat() if job.updated_at else "",
        is_editable=job.is_editable,
        can_submit_production=job.can_submit_production,
        can_approve=job.can_approve,
    )


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    request: Request,
    body: JobCreateRequest,
    current_user: CurrentUser = Depends(require_permission(Permission.JOBS_CREATE)),
    db: Session = Depends(get_db),
):
    """
    Create a new job.

    - Only supervisors and admins can create jobs
    - Optionally link to a processed map
    - Optionally assign to a lineman
    """
    # Validate source map if provided
    source_map_id = None
    if body.source_map_id:
        try:
            source_map_id = uuid.UUID(body.source_map_id)
            map_obj = db.query(Map).filter(Map.id == source_map_id).first()
            if map_obj is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Source map not found",
                )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid source map ID format",
            )

    # Validate assigned user if provided
    assigned_to_id = None
    if body.assigned_to_id:
        try:
            assigned_to_id = uuid.UUID(body.assigned_to_id)
            user = db.query(User).filter(
                User.id == assigned_to_id,
                User.deleted_at.is_(None),
            ).first()
            if user is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Assigned user not found",
                )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid assigned user ID format",
            )

    # Create job
    job_id = uuid.uuid4()
    job = JobV2(
        id=job_id,
        job_code=_generate_job_code(),
        title=body.title,
        source_map_id=source_map_id,
        assigned_to_id=assigned_to_id,
        assigned_at=datetime.utcnow().isoformat() if assigned_to_id else None,
        created_by_id=uuid.UUID(current_user.id),
        client_id=body.client_id,
        client_name=body.client_name,
        work_type=WorkTypeV2(body.work_type),
        location=body.location.dict() if body.location else None,
        scheduled_date=body.scheduled_date,
        due_date=body.due_date,
        estimated_footage=body.estimated_footage,
        supervisor_notes=body.supervisor_notes,
        status=JobStatusV2.ASSIGNED,
        status_changed_at=datetime.utcnow().isoformat(),
    )
    db.add(job)

    # Audit log
    audit = AuditService(db)
    audit.log_job_operation(
        action=AuditAction.JOB_ASSIGN.value,
        job_id=str(job_id),
        new_status=JobStatusV2.ASSIGNED.value,
        user_id=current_user.id,
        user_email=current_user.email,
        user_role=current_user.role,
        ip_address=get_client_ip(request),
        metadata={
            "title": body.title,
            "assigned_to_id": str(assigned_to_id) if assigned_to_id else None,
        },
    )

    db.commit()
    db.refresh(job)

    logger.info(
        "job_created",
        job_id=str(job_id),
        job_code=job.job_code,
        assigned_to=str(assigned_to_id) if assigned_to_id else None,
    )

    return _job_to_response(job)


@router.get("", response_model=JobListResponse)
async def list_jobs(
    status_filter: Optional[str] = Query(None, alias="status"),
    assigned_to_id: Optional[str] = None,
    client_id: Optional[str] = None,
    source_map_id: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: CurrentUser = Depends(require_permission(Permission.JOBS_READ)),
    db: Session = Depends(get_db),
):
    """
    List jobs with pagination and filtering.
    """
    query = db.query(JobV2).options(
        joinedload(JobV2.assigned_to),
        joinedload(JobV2.created_by),
    ).filter(JobV2.deleted_at.is_(None))

    # Apply filters
    if status_filter:
        try:
            status_enum = JobStatusV2(status_filter)
            query = query.filter(JobV2.status == status_enum)
        except ValueError:
            pass

    if assigned_to_id:
        try:
            query = query.filter(JobV2.assigned_to_id == uuid.UUID(assigned_to_id))
        except ValueError:
            pass

    if client_id:
        query = query.filter(JobV2.client_id == client_id)

    if source_map_id:
        try:
            query = query.filter(JobV2.source_map_id == uuid.UUID(source_map_id))
        except ValueError:
            pass

    # Count total
    total = query.count()

    # Paginate
    offset = (page - 1) * page_size
    jobs = query.order_by(JobV2.created_at.desc()).offset(offset).limit(page_size).all()

    items = [_job_to_response(j) for j in jobs]

    return JobListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 1,
    )


@router.get("/my-jobs", response_model=JobListResponse)
async def get_my_jobs(
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: CurrentUser = Depends(require_permission(Permission.JOBS_READ_OWN)),
    db: Session = Depends(get_db),
):
    """
    Get jobs assigned to current user (lineman view).
    """
    query = db.query(JobV2).options(
        joinedload(JobV2.created_by),
    ).filter(
        JobV2.assigned_to_id == uuid.UUID(current_user.id),
        JobV2.deleted_at.is_(None),
    )

    if status_filter:
        try:
            status_enum = JobStatusV2(status_filter)
            query = query.filter(JobV2.status == status_enum)
        except ValueError:
            pass

    total = query.count()
    offset = (page - 1) * page_size
    jobs = query.order_by(JobV2.created_at.desc()).offset(offset).limit(page_size).all()

    items = [_job_to_response(j) for j in jobs]

    return JobListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=math.ceil(total / page_size) if total > 0 else 1,
    )


@router.get("/stats", response_model=JobStatsResponse)
async def get_job_stats(
    assigned_to_id: Optional[str] = None,
    current_user: CurrentUser = Depends(require_permission(Permission.JOBS_READ)),
    db: Session = Depends(get_db),
):
    """
    Get job statistics.
    """
    query = db.query(JobV2).filter(JobV2.deleted_at.is_(None))

    if assigned_to_id:
        try:
            query = query.filter(JobV2.assigned_to_id == uuid.UUID(assigned_to_id))
        except ValueError:
            pass

    # Count by status
    status_counts = db.query(
        JobV2.status,
        func.count(JobV2.id),
    ).filter(JobV2.deleted_at.is_(None))

    if assigned_to_id:
        try:
            status_counts = status_counts.filter(JobV2.assigned_to_id == uuid.UUID(assigned_to_id))
        except ValueError:
            pass

    status_counts = dict(status_counts.group_by(JobV2.status).all())

    return JobStatsResponse(
        total=sum(status_counts.values()),
        assigned=status_counts.get(JobStatusV2.ASSIGNED, 0),
        in_progress=status_counts.get(JobStatusV2.IN_PROGRESS, 0),
        submitted=status_counts.get(JobStatusV2.SUBMITTED, 0),
        approved=status_counts.get(JobStatusV2.APPROVED, 0),
        needs_revision=status_counts.get(JobStatusV2.NEEDS_REVISION, 0),
        completed=status_counts.get(JobStatusV2.COMPLETED, 0),
        cancelled=status_counts.get(JobStatusV2.CANCELLED, 0),
    )


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get job details.
    """
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid job ID format",
        )

    job = db.query(JobV2).options(
        joinedload(JobV2.assigned_to),
        joinedload(JobV2.created_by),
    ).filter(
        JobV2.id == job_uuid,
        JobV2.deleted_at.is_(None),
    ).first()

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    # Check access: linemen can only see their own jobs
    if current_user.role == "lineman" and str(job.assigned_to_id) != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    return _job_to_response(job)


@router.patch("/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: str,
    request: Request,
    body: JobUpdateRequest,
    current_user: CurrentUser = Depends(require_permission(Permission.JOBS_UPDATE)),
    db: Session = Depends(get_db),
):
    """
    Update job details.
    """
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid job ID format",
        )

    job = db.query(JobV2).filter(
        JobV2.id == job_uuid,
        JobV2.deleted_at.is_(None),
    ).first()

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    # Store old values for audit
    old_values = {
        "title": job.title,
        "assigned_to_id": str(job.assigned_to_id) if job.assigned_to_id else None,
        "client_id": job.client_id,
        "work_type": job.work_type.value,
    }

    # Apply updates
    if body.title is not None:
        job.title = body.title
    if body.assigned_to_id is not None:
        try:
            job.assigned_to_id = uuid.UUID(body.assigned_to_id)
            job.assigned_at = datetime.utcnow().isoformat()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid assigned user ID",
            )
    if body.client_id is not None:
        job.client_id = body.client_id
    if body.client_name is not None:
        job.client_name = body.client_name
    if body.work_type is not None:
        job.work_type = WorkTypeV2(body.work_type)
    if body.location is not None:
        job.location = body.location.dict()
    if body.scheduled_date is not None:
        job.scheduled_date = body.scheduled_date
    if body.due_date is not None:
        job.due_date = body.due_date
    if body.estimated_footage is not None:
        job.estimated_footage = body.estimated_footage
    if body.supervisor_notes is not None:
        job.supervisor_notes = body.supervisor_notes
    if body.lineman_notes is not None:
        job.lineman_notes = body.lineman_notes

    job.updated_by_id = uuid.UUID(current_user.id)

    # Audit log
    audit = AuditService(db)
    audit.log_update(
        entity_type="job",
        entity_id=str(job_uuid),
        old_values=old_values,
        new_values=body.dict(exclude_unset=True),
        user_id=current_user.id,
        user_email=current_user.email,
        user_role=current_user.role,
        ip_address=get_client_ip(request),
    )

    db.commit()
    db.refresh(job)

    return _job_to_response(job)


@router.patch("/{job_id}/status", response_model=JobResponse)
async def update_job_status(
    job_id: str,
    request: Request,
    body: JobStatusUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update job status.

    Status transitions:
    - Lineman: assigned -> in_progress, in_progress -> submitted
    - Supervisor: submitted -> approved/needs_revision, approved -> completed
    """
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid job ID format",
        )

    job = db.query(JobV2).filter(
        JobV2.id == job_uuid,
        JobV2.deleted_at.is_(None),
    ).first()

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    old_status = job.status.value
    new_status = JobStatusV2(body.status)

    # Validate status transition and permissions
    allowed = False
    action = AuditAction.UPDATE.value

    if current_user.role == "lineman":
        # Lineman can only update their own jobs
        if str(job.assigned_to_id) != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied",
            )
        # Allowed transitions
        if job.status == JobStatusV2.ASSIGNED and new_status == JobStatusV2.IN_PROGRESS:
            allowed = True
            action = AuditAction.JOB_START.value
        elif job.status == JobStatusV2.NEEDS_REVISION and new_status == JobStatusV2.IN_PROGRESS:
            allowed = True
            action = AuditAction.JOB_START.value
    else:
        # Supervisor/Admin
        if job.status == JobStatusV2.SUBMITTED:
            if new_status == JobStatusV2.APPROVED:
                allowed = True
                action = AuditAction.JOB_APPROVE.value
                job.approved_at = datetime.utcnow().isoformat()
                job.approved_by_id = uuid.UUID(current_user.id)
            elif new_status == JobStatusV2.NEEDS_REVISION:
                allowed = True
                action = AuditAction.JOB_REJECT.value
        elif job.status == JobStatusV2.APPROVED and new_status == JobStatusV2.COMPLETED:
            allowed = True
            action = AuditAction.JOB_COMPLETE.value
            job.completed_at = datetime.utcnow().isoformat()
        elif new_status == JobStatusV2.CANCELLED:
            allowed = True
            action = AuditAction.JOB_CANCEL.value

    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status transition: {old_status} -> {new_status.value}",
        )

    job.status = new_status
    job.status_changed_at = datetime.utcnow().isoformat()
    if body.notes:
        job.review_notes = body.notes
    job.updated_by_id = uuid.UUID(current_user.id)

    # Audit log
    audit = AuditService(db)
    audit.log_job_operation(
        action=action,
        job_id=str(job_uuid),
        old_status=old_status,
        new_status=new_status.value,
        user_id=current_user.id,
        user_email=current_user.email,
        user_role=current_user.role,
        ip_address=get_client_ip(request),
        metadata={"notes": body.notes} if body.notes else None,
    )

    db.commit()
    db.refresh(job)

    logger.info(
        "job_status_updated",
        job_id=str(job_uuid),
        old_status=old_status,
        new_status=new_status.value,
    )

    return _job_to_response(job)


@router.post("/{job_id}/submit-production", response_model=JobResponse)
async def submit_production(
    job_id: str,
    request: Request,
    body: ProductionSubmitRequest,
    current_user: CurrentUser = Depends(require_permission(Permission.JOBS_SUBMIT)),
    db: Session = Depends(get_db),
):
    """
    Submit production data for a job.

    Only the assigned lineman can submit production.
    """
    try:
        job_uuid = uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid job ID format",
        )

    job = db.query(JobV2).filter(
        JobV2.id == job_uuid,
        JobV2.deleted_at.is_(None),
    ).first()

    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    # Verify ownership
    if str(job.assigned_to_id) != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only submit production for your own jobs",
        )

    # Verify status allows submission
    if not job.can_submit_production:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot submit production for job in status: {job.status.value}",
        )

    # Store old values
    old_status = job.status.value

    # Update job
    production_dict = body.production_data.dict()
    production_dict["submitted_at"] = datetime.utcnow().isoformat()
    job.production_data = production_dict
    job.actual_footage = body.production_data.total_footage
    job.lineman_notes = body.notes
    job.status = JobStatusV2.SUBMITTED
    job.status_changed_at = datetime.utcnow().isoformat()
    job.submitted_at = datetime.utcnow().isoformat()
    job.updated_by_id = uuid.UUID(current_user.id)

    # Audit log
    audit = AuditService(db)
    audit.log_job_operation(
        action=AuditAction.JOB_SUBMIT.value,
        job_id=str(job_uuid),
        old_status=old_status,
        new_status=JobStatusV2.SUBMITTED.value,
        user_id=current_user.id,
        user_email=current_user.email,
        user_role=current_user.role,
        ip_address=get_client_ip(request),
        metadata={
            "total_footage": body.production_data.total_footage,
            "anchor_count": body.production_data.anchor_count,
            "coil_count": body.production_data.coil_count,
        },
    )

    db.commit()
    db.refresh(job)

    logger.info(
        "production_submitted",
        job_id=str(job_uuid),
        total_footage=body.production_data.total_footage,
    )

    return _job_to_response(job)
