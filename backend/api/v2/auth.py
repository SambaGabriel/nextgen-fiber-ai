"""
Auth API V2
Authentication endpoints with JWT tokens
"""

from datetime import datetime
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import (
    hash_password,
    verify_password,
    create_token_pair,
    decode_token,
    TokenType,
    get_current_user,
    get_permissions_for_role,
    CurrentUser,
    get_client_ip,
    get_user_agent,
)
from core.logging import get_logger
from models.db import User
from schemas.auth import (
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    RefreshResponse,
    UserResponse,
    PermissionsResponse,
    UserCreateRequest,
    PasswordChangeRequest,
)
from services.audit_service import AuditService

router = APIRouter()
logger = get_logger(__name__)


def _user_to_response(user: User) -> UserResponse:
    """Convert User model to UserResponse."""
    return UserResponse(
        id=str(user.id),
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        full_name=user.full_name,
        role=user.role.value,
        is_active=user.is_active,
        is_verified=user.is_verified,
        last_login_at=user.last_login_at,
        created_at=user.created_at.isoformat() if user.created_at else "",
    )


@router.post("/login", response_model=LoginResponse)
async def login(
    request: Request,
    body: LoginRequest,
    db: Session = Depends(get_db),
):
    """
    Authenticate user and return JWT tokens.

    Returns access token (short-lived) and refresh token (long-lived).
    """
    audit = AuditService(db)

    # Find user by email
    user = db.query(User).filter(
        User.email == body.email,
        User.deleted_at.is_(None),
    ).first()

    if user is None:
        audit.log_login(
            user_id="",
            user_email=body.email,
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            is_success=False,
            error_message="User not found",
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Verify password
    if not verify_password(body.password, user.password_hash):
        audit.log_login(
            user_id=str(user.id),
            user_email=body.email,
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            is_success=False,
            error_message="Invalid password",
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Check if user is active
    if not user.is_active:
        audit.log_login(
            user_id=str(user.id),
            user_email=body.email,
            ip_address=get_client_ip(request),
            user_agent=get_user_agent(request),
            is_success=False,
            error_message="Account disabled",
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    # Create tokens
    tokens = create_token_pair(str(user.id), user.email, user.role.value)

    # Update last login
    user.last_login_at = datetime.utcnow().isoformat()
    user.last_login_ip = get_client_ip(request)

    # Log successful login
    audit.log_login(
        user_id=str(user.id),
        user_email=user.email,
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
        is_success=True,
    )

    db.commit()

    logger.info(
        "user_login_success",
        user_id=str(user.id),
        email=user.email,
    )

    return LoginResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        token_type=tokens.token_type,
        expires_in=tokens.expires_in,
        user=_user_to_response(user),
    )


@router.post("/refresh", response_model=RefreshResponse)
async def refresh_token(
    body: RefreshRequest,
    db: Session = Depends(get_db),
):
    """
    Refresh access token using refresh token.
    """
    # Decode refresh token
    payload = decode_token(body.refresh_token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    if payload.type != TokenType.REFRESH.value:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    # Verify user still exists and is active
    user = db.query(User).filter(
        User.id == uuid.UUID(payload.sub),
        User.deleted_at.is_(None),
    ).first()

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or disabled",
        )

    # Create new token pair
    tokens = create_token_pair(str(user.id), user.email, user.role.value)

    return RefreshResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        token_type=tokens.token_type,
        expires_in=tokens.expires_in,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get current authenticated user's information.
    """
    user = db.query(User).filter(User.id == uuid.UUID(current_user.id)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return _user_to_response(user)


@router.get("/permissions", response_model=PermissionsResponse)
async def get_permissions(
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Get current user's permissions.
    """
    permissions = get_permissions_for_role(current_user.role)
    return PermissionsResponse(
        user_id=current_user.id,
        role=current_user.role,
        permissions=list(permissions),
    )


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    request: Request,
    body: PasswordChangeRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Change current user's password.
    """
    user = db.query(User).filter(User.id == uuid.UUID(current_user.id)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Verify current password
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    # Update password
    user.password_hash = hash_password(body.new_password)

    # Audit log
    audit = AuditService(db)
    audit.log(
        action="password_change",
        entity_type="user",
        entity_id=str(user.id),
        user_id=str(user.id),
        user_email=user.email,
        user_role=user.role.value,
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )

    db.commit()

    logger.info("password_changed", user_id=str(user.id))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Logout current user.

    Note: With JWT, logout is client-side (discard tokens).
    This endpoint logs the event for audit purposes.
    """
    audit = AuditService(db)
    audit.log(
        action="logout",
        entity_type="user",
        entity_id=current_user.id,
        user_id=current_user.id,
        user_email=current_user.email,
        user_role=current_user.role,
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
    )
    db.commit()

    logger.info("user_logout", user_id=current_user.id)
