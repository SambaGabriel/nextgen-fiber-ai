"""
Audit API V2
Audit log query endpoints (admin only)
"""

from typing import Optional, List
from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from core.database import get_db
from core.security import require_permission, CurrentUser, Permission
from core.logging import get_logger
from models.db import AuditLog
from services.audit_service import AuditService

router = APIRouter()
logger = get_logger(__name__)


class AuditLogResponse(BaseModel):
    """Audit log entry response."""
    id: str
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    user_role: Optional[str] = None
    ip_address: Optional[str] = None
    old_values: Optional[dict] = None
    new_values: Optional[dict] = None
    metadata: Optional[dict] = None
    is_success: bool = True
    error_message: Optional[str] = None
    created_at: str


class AuditLogListResponse(BaseModel):
    """Paginated audit log list."""
    items: List[AuditLogResponse]
    total: int
    page: int
    page_size: int


def _audit_to_response(log: AuditLog) -> AuditLogResponse:
    """Convert AuditLog model to response."""
    return AuditLogResponse(
        id=str(log.id),
        action=log.action,
        entity_type=log.entity_type,
        entity_id=log.entity_id,
        user_id=str(log.user_id) if log.user_id else None,
        user_email=log.user_email,
        user_role=log.user_role,
        ip_address=log.ip_address,
        old_values=log.old_values,
        new_values=log.new_values,
        metadata=log.metadata_,
        is_success=log.is_success == "true",
        error_message=log.error_message,
        created_at=log.created_at.isoformat() if log.created_at else "",
    )


@router.get("", response_model=AuditLogListResponse)
async def list_audit_logs(
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    user_id: Optional[str] = None,
    created_after: Optional[datetime] = None,
    created_before: Optional[datetime] = None,
    success_only: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: CurrentUser = Depends(require_permission(Permission.AUDIT_READ)),
    db: Session = Depends(get_db),
):
    """
    Query audit logs with filtering.

    Admin only.
    """
    query = db.query(AuditLog)

    # Apply filters
    if action:
        query = query.filter(AuditLog.action == action)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if entity_id:
        query = query.filter(AuditLog.entity_id == entity_id)
    if user_id:
        try:
            query = query.filter(AuditLog.user_id == uuid.UUID(user_id))
        except ValueError:
            pass
    if created_after:
        query = query.filter(AuditLog.created_at >= created_after)
    if created_before:
        query = query.filter(AuditLog.created_at <= created_before)
    if success_only is not None:
        query = query.filter(AuditLog.is_success == ("true" if success_only else "false"))

    # Count total
    total = query.count()

    # Paginate
    offset = (page - 1) * page_size
    logs = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(page_size).all()

    items = [_audit_to_response(log) for log in logs]

    return AuditLogListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/entity/{entity_type}/{entity_id}", response_model=List[AuditLogResponse])
async def get_entity_audit_trail(
    entity_type: str,
    entity_id: str,
    limit: int = Query(100, ge=1, le=500),
    current_user: CurrentUser = Depends(require_permission(Permission.AUDIT_READ)),
    db: Session = Depends(get_db),
):
    """
    Get complete audit trail for an entity.
    """
    audit = AuditService(db)
    logs = audit.get_by_entity(entity_type, entity_id, limit=limit)
    return [_audit_to_response(log) for log in logs]


@router.get("/user/{user_id}", response_model=List[AuditLogResponse])
async def get_user_audit_trail(
    user_id: str,
    limit: int = Query(100, ge=1, le=500),
    current_user: CurrentUser = Depends(require_permission(Permission.AUDIT_READ)),
    db: Session = Depends(get_db),
):
    """
    Get audit trail for a specific user's actions.
    """
    audit = AuditService(db)
    logs = audit.get_by_user(user_id, limit=limit)
    return [_audit_to_response(log) for log in logs]


@router.get("/failed", response_model=List[AuditLogResponse])
async def get_failed_operations(
    limit: int = Query(100, ge=1, le=500),
    current_user: CurrentUser = Depends(require_permission(Permission.AUDIT_READ)),
    db: Session = Depends(get_db),
):
    """
    Get recent failed operations for monitoring.
    """
    audit = AuditService(db)
    logs = audit.get_failed_operations(limit=limit)
    return [_audit_to_response(log) for log in logs]
