"""Core module - Configuration, logging, database, security, and events"""

from .config import Settings, get_settings
from .logging import setup_logging, get_logger, audit_logger

__all__ = [
    # Config
    "Settings",
    "get_settings",
    # Logging
    "setup_logging",
    "get_logger",
    "audit_logger",
]

# Lazy imports for optional modules
def __getattr__(name):
    if name == "get_db":
        from .database import get_db
        return get_db
    if name == "init_database":
        from .database import init_database
        return init_database
    if name == "close_database":
        from .database import close_database
        return close_database
    if name == "get_current_user":
        from .security import get_current_user
        return get_current_user
    if name == "require_role":
        from .security import require_role
        return require_role
    if name == "require_permission":
        from .security import require_permission
        return require_permission
    if name == "is_flag_enabled":
        from .feature_flags import is_flag_enabled
        return is_flag_enabled
    if name == "Flags":
        from .feature_flags import Flags
        return Flags
    if name == "emit":
        from .events import emit
        return emit
    if name == "subscribe":
        from .events import subscribe
        return subscribe
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
