"""
Auth Schemas
Request/Response models for authentication
"""

from typing import Optional, List, Set
from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    """Login request payload."""
    email: EmailStr = Field(..., description="User email")
    password: str = Field(..., min_length=1, description="User password")


class LoginResponse(BaseModel):
    """Login response with tokens."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # Seconds
    user: "UserResponse"


class RefreshRequest(BaseModel):
    """Token refresh request."""
    refresh_token: str = Field(..., description="Valid refresh token")


class RefreshResponse(BaseModel):
    """Token refresh response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    """User information response."""
    id: str
    email: str
    first_name: str
    last_name: str
    full_name: str
    role: str
    is_active: bool
    is_verified: bool
    last_login_at: Optional[str] = None
    created_at: str

    class Config:
        from_attributes = True


class PermissionsResponse(BaseModel):
    """User permissions response."""
    user_id: str
    role: str
    permissions: List[str]


class PasswordChangeRequest(BaseModel):
    """Password change request."""
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)


class UserCreateRequest(BaseModel):
    """User creation request (admin only)."""
    email: EmailStr
    password: str = Field(..., min_length=8)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    role: str = Field(default="lineman", pattern="^(admin|supervisor|lineman)$")
    phone: Optional[str] = None


class UserUpdateRequest(BaseModel):
    """User update request."""
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    phone: Optional[str] = None
    role: Optional[str] = Field(None, pattern="^(admin|supervisor|lineman)$")
    is_active: Optional[bool] = None


# Update forward reference
LoginResponse.update_forward_refs()
