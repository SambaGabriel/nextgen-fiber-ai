"""
Security Module
JWT authentication, password hashing, and RBAC
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Set, List
from enum import Enum

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from core.config import get_settings
from core.logging import get_logger

# JWT and password hashing imports
try:
    import jwt
    from passlib.context import CryptContext
    SECURITY_AVAILABLE = True
except ImportError:
    SECURITY_AVAILABLE = False
    jwt = None
    CryptContext = None

settings = get_settings()
logger = get_logger(__name__)


# =========================================
# Password Hashing
# =========================================

if SECURITY_AVAILABLE:
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
else:
    pwd_context = None


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    if not SECURITY_AVAILABLE:
        raise RuntimeError("Security packages not installed")
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    if not SECURITY_AVAILABLE:
        raise RuntimeError("Security packages not installed")
    return pwd_context.verify(plain_password, hashed_password)


# =========================================
# JWT Tokens
# =========================================

class TokenType(str, Enum):
    """JWT token types."""
    ACCESS = "access"
    REFRESH = "refresh"


class TokenPayload(BaseModel):
    """JWT token payload structure."""
    sub: str  # User ID
    email: str
    role: str
    type: str  # Token type
    exp: datetime
    iat: datetime
    jti: Optional[str] = None  # JWT ID for revocation


class TokenPair(BaseModel):
    """Access and refresh token pair."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # Seconds until access token expires


def create_token(
    user_id: str,
    email: str,
    role: str,
    token_type: TokenType,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Create a JWT token.

    Args:
        user_id: User UUID
        email: User email
        role: User role
        token_type: Access or refresh token
        expires_delta: Custom expiration time

    Returns:
        Encoded JWT token
    """
    if not SECURITY_AVAILABLE:
        raise RuntimeError("Security packages not installed")

    now = datetime.utcnow()

    if expires_delta is None:
        if token_type == TokenType.ACCESS:
            expires_delta = timedelta(hours=settings.jwt_expiry_hours)
        else:
            expires_delta = timedelta(days=7)

    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "type": token_type.value,
        "exp": now + expires_delta,
        "iat": now,
    }

    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def create_token_pair(user_id: str, email: str, role: str) -> TokenPair:
    """Create access and refresh token pair."""
    access_expires = timedelta(hours=settings.jwt_expiry_hours)
    access_token = create_token(user_id, email, role, TokenType.ACCESS, access_expires)
    refresh_token = create_token(user_id, email, role, TokenType.REFRESH, timedelta(days=7))

    return TokenPair(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=int(access_expires.total_seconds()),
    )


def decode_token(token: str) -> Optional[TokenPayload]:
    """
    Decode and validate a JWT token.

    Args:
        token: JWT token string

    Returns:
        TokenPayload if valid, None otherwise
    """
    if not SECURITY_AVAILABLE:
        raise RuntimeError("Security packages not installed")

    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        return TokenPayload(
            sub=payload["sub"],
            email=payload["email"],
            role=payload["role"],
            type=payload["type"],
            exp=datetime.fromtimestamp(payload["exp"]),
            iat=datetime.fromtimestamp(payload["iat"]),
            jti=payload.get("jti"),
        )
    except jwt.ExpiredSignatureError:
        logger.warning("token_expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning("token_invalid", error=str(e))
        return None


# =========================================
# Permissions Matrix
# =========================================

class Permission(str, Enum):
    """Available permissions in the system."""
    # Map permissions
    MAPS_READ = "maps:read"
    MAPS_CREATE = "maps:create"
    MAPS_UPDATE = "maps:update"
    MAPS_DELETE = "maps:delete"
    MAPS_REPROCESS = "maps:reprocess"

    # Job permissions
    JOBS_READ = "jobs:read"
    JOBS_READ_OWN = "jobs:read_own"
    JOBS_CREATE = "jobs:create"
    JOBS_UPDATE = "jobs:update"
    JOBS_DELETE = "jobs:delete"
    JOBS_APPROVE = "jobs:approve"
    JOBS_SUBMIT = "jobs:submit"

    # User permissions
    USERS_READ = "users:read"
    USERS_CREATE = "users:create"
    USERS_UPDATE = "users:update"
    USERS_DELETE = "users:delete"

    # Audit permissions
    AUDIT_READ = "audit:read"

    # System permissions
    FEATURE_FLAGS_READ = "feature_flags:read"
    FEATURE_FLAGS_UPDATE = "feature_flags:update"


# Role-based permission matrix
ROLE_PERMISSIONS: Dict[str, Set[str]] = {
    "admin": {
        # Full access to everything
        Permission.MAPS_READ,
        Permission.MAPS_CREATE,
        Permission.MAPS_UPDATE,
        Permission.MAPS_DELETE,
        Permission.MAPS_REPROCESS,
        Permission.JOBS_READ,
        Permission.JOBS_CREATE,
        Permission.JOBS_UPDATE,
        Permission.JOBS_DELETE,
        Permission.JOBS_APPROVE,
        Permission.JOBS_SUBMIT,
        Permission.USERS_READ,
        Permission.USERS_CREATE,
        Permission.USERS_UPDATE,
        Permission.USERS_DELETE,
        Permission.AUDIT_READ,
        Permission.FEATURE_FLAGS_READ,
        Permission.FEATURE_FLAGS_UPDATE,
    },
    "supervisor": {
        # Maps: full access except delete
        Permission.MAPS_READ,
        Permission.MAPS_CREATE,
        Permission.MAPS_UPDATE,
        Permission.MAPS_REPROCESS,
        # Jobs: full access except delete
        Permission.JOBS_READ,
        Permission.JOBS_CREATE,
        Permission.JOBS_UPDATE,
        Permission.JOBS_APPROVE,
        # Users: read only
        Permission.USERS_READ,
        # Feature flags: read only
        Permission.FEATURE_FLAGS_READ,
    },
    "lineman": {
        # Maps: read only
        Permission.MAPS_READ,
        # Jobs: own jobs only
        Permission.JOBS_READ_OWN,
        Permission.JOBS_SUBMIT,
    },
}


def get_permissions_for_role(role: str) -> Set[str]:
    """Get all permissions for a role."""
    return ROLE_PERMISSIONS.get(role, set())


def has_permission(role: str, permission: str) -> bool:
    """Check if role has a specific permission."""
    return permission in ROLE_PERMISSIONS.get(role, set())


# =========================================
# FastAPI Dependencies
# =========================================

# Bearer token scheme
bearer_scheme = HTTPBearer(auto_error=False)


class CurrentUser(BaseModel):
    """Current authenticated user context."""
    id: str
    email: str
    role: str
    permissions: Set[str]


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CurrentUser:
    """
    FastAPI dependency to get current authenticated user.

    Usage:
        @app.get("/protected")
        async def protected_route(user: CurrentUser = Depends(get_current_user)):
            ...
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token_payload = decode_token(credentials.credentials)
    if token_payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if token_payload.type != TokenType.ACCESS.value:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    return CurrentUser(
        id=token_payload.sub,
        email=token_payload.email,
        role=token_payload.role,
        permissions=get_permissions_for_role(token_payload.role),
    )


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> Optional[CurrentUser]:
    """Get current user if authenticated, None otherwise."""
    if credentials is None:
        return None

    token_payload = decode_token(credentials.credentials)
    if token_payload is None or token_payload.type != TokenType.ACCESS.value:
        return None

    return CurrentUser(
        id=token_payload.sub,
        email=token_payload.email,
        role=token_payload.role,
        permissions=get_permissions_for_role(token_payload.role),
    )


def require_role(*allowed_roles: str):
    """
    Dependency factory to require specific roles.

    Usage:
        @app.get("/admin-only")
        async def admin_only(user: CurrentUser = Depends(require_role("admin"))):
            ...
    """
    async def role_checker(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required roles: {allowed_roles}",
            )
        return user
    return role_checker


def require_permission(*required_permissions: str):
    """
    Dependency factory to require specific permissions.

    Usage:
        @app.delete("/maps/{id}")
        async def delete_map(
            id: str,
            user: CurrentUser = Depends(require_permission("maps:delete"))
        ):
            ...
    """
    async def permission_checker(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        missing = set(required_permissions) - user.permissions
        if missing:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permissions: {missing}",
            )
        return user
    return permission_checker


def require_admin():
    """Require admin role."""
    return require_role("admin")


def require_supervisor():
    """Require supervisor or admin role."""
    return require_role("admin", "supervisor")


def require_any_authenticated():
    """Require any authenticated user."""
    return get_current_user


# =========================================
# Request Context
# =========================================

def get_client_ip(request: Request) -> str:
    """Extract client IP from request, handling proxies."""
    # Check for forwarded headers
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()

    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip

    # Fall back to direct client
    if request.client:
        return request.client.host

    return "unknown"


def get_user_agent(request: Request) -> str:
    """Extract user agent from request."""
    return request.headers.get("User-Agent", "unknown")
