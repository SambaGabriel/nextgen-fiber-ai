"""
Job Service
Business logic for job operations including auto-publish from maps
"""

from typing import Optional
from datetime import datetime
import uuid

from sqlalchemy.orm import Session

from core.logging import get_logger
from core.database import db_manager
from models.db import JobV2, JobStatusV2, WorkTypeV2, Map, MapStatus

logger = get_logger(__name__)


def _generate_job_code() -> str:
    """Generate unique job code."""
    year = datetime.utcnow().year
    random_part = uuid.uuid4().hex[:6].upper()
    return f"JOB-{year}-{random_part}"


def create_job_from_map(
    map_id: str,
    created_by_id: Optional[str] = None,
    assigned_to_id: Optional[str] = None,
    db: Optional[Session] = None,
) -> Optional[JobV2]:
    """
    Create a job from a processed map.

    Used for auto-publish when map processing completes.

    Args:
        map_id: ID of the processed map
        created_by_id: User who triggered the creation
        assigned_to_id: Optional lineman to assign
        db: Database session (optional, will create if not provided)

    Returns:
        Created JobV2 instance or None if failed
    """
    # Use provided session or create new one
    own_session = db is None
    if own_session:
        db = db_manager.get_session()

    try:
        # Get the map
        map_uuid = uuid.UUID(map_id)
        map_obj = db.query(Map).filter(Map.id == map_uuid).first()

        if map_obj is None:
            logger.warning(f"Map not found for job creation: {map_id}")
            return None

        if map_obj.status != MapStatus.COMPLETED:
            logger.warning(f"Map {map_id} not completed, status: {map_obj.status.value}")
            return None

        # Check if job already exists for this map
        existing = db.query(JobV2).filter(JobV2.source_map_id == map_uuid).first()
        if existing:
            logger.info(f"Job already exists for map {map_id}: {existing.job_code}")
            return existing

        # Extract data from map
        totals = map_obj.totals or {}
        estimated_footage = totals.get("total_cable_ft", 0)

        # Determine work type from spans
        # Default to AERIAL, could enhance to detect from actual data
        work_type = WorkTypeV2.AERIAL

        # Build location from map data
        location = {}
        if map_obj.location:
            location["address"] = map_obj.location
        if map_obj.fsa:
            location["state"] = map_obj.fsa[:2] if len(map_obj.fsa) >= 2 else None

        # Create job
        job_id = uuid.uuid4()
        job = JobV2(
            id=job_id,
            job_code=_generate_job_code(),
            title=f"Map Analysis - {map_obj.project_id or map_obj.filename}",
            source_map_id=map_uuid,
            assigned_to_id=uuid.UUID(assigned_to_id) if assigned_to_id else None,
            assigned_at=datetime.utcnow().isoformat() if assigned_to_id else None,
            created_by_id=uuid.UUID(created_by_id) if created_by_id else map_obj.uploaded_by_id,
            client_name=map_obj.contractor,
            work_type=work_type,
            location=location if location else None,
            estimated_footage=estimated_footage,
            status=JobStatusV2.ASSIGNED,
            status_changed_at=datetime.utcnow().isoformat(),
            supervisor_notes=f"Auto-created from map analysis. Project: {map_obj.project_id or 'N/A'}",
        )
        db.add(job)

        if own_session:
            db.commit()
            db.refresh(job)

        logger.info(
            f"Job created from map",
            extra={
                "job_id": str(job_id),
                "job_code": job.job_code,
                "map_id": map_id,
                "estimated_footage": estimated_footage,
            },
        )

        return job

    except Exception as e:
        logger.error(f"Failed to create job from map {map_id}: {e}")
        if own_session:
            db.rollback()
        raise

    finally:
        if own_session:
            db.close()


def get_job_by_map(map_id: str, db: Session) -> Optional[JobV2]:
    """Get job linked to a specific map."""
    try:
        map_uuid = uuid.UUID(map_id)
        return db.query(JobV2).filter(
            JobV2.source_map_id == map_uuid,
            JobV2.deleted_at.is_(None),
        ).first()
    except ValueError:
        return None


def sync_job_with_map(job_id: str, db: Session) -> bool:
    """
    Sync job data with its source map.

    Updates estimated footage and other fields from map analysis.
    """
    try:
        job_uuid = uuid.UUID(job_id)
        job = db.query(JobV2).filter(JobV2.id == job_uuid).first()

        if job is None or job.source_map_id is None:
            return False

        map_obj = db.query(Map).filter(Map.id == job.source_map_id).first()
        if map_obj is None or map_obj.status != MapStatus.COMPLETED:
            return False

        # Update job from map
        totals = map_obj.totals or {}
        job.estimated_footage = totals.get("total_cable_ft", job.estimated_footage)

        # Update location if not set
        if not job.location:
            location = {}
            if map_obj.location:
                location["address"] = map_obj.location
            if location:
                job.location = location

        db.commit()
        logger.info(f"Job {job_id} synced with map {job.source_map_id}")
        return True

    except Exception as e:
        logger.error(f"Failed to sync job {job_id}: {e}")
        db.rollback()
        return False
