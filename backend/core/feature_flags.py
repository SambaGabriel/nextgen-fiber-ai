"""
Feature Flags Service
Runtime feature flag evaluation with percentage rollout and targeting
"""

from typing import Optional, Dict, Any, List
from datetime import datetime
import hashlib

from sqlalchemy.orm import Session

from core.config import get_settings
from core.logging import get_logger

settings = get_settings()
logger = get_logger(__name__)


# =========================================
# Feature Flag Names
# =========================================

class Flags:
    """Constants for feature flag names."""
    V2_API_ENABLED = "v2_api_enabled"
    POSTGRES_PERSISTENCE = "postgres_persistence"
    OBJECT_STORAGE = "object_storage"
    ASYNC_MAP_PROCESSING = "async_map_processing"
    AUTO_PUBLISH_JOBS = "auto_publish_jobs"
    REDIS_QUEUE = "redis_queue"


# =========================================
# In-Memory Flag Cache
# =========================================

class FlagCache:
    """
    In-memory cache for feature flags.
    Reduces database queries for frequently checked flags.
    """

    _instance: Optional["FlagCache"] = None
    _cache: Dict[str, Dict[str, Any]] = {}
    _last_refresh: Optional[datetime] = None
    _ttl_seconds: int = 60  # Cache TTL

    def __new__(cls) -> "FlagCache":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._cache = {}
        return cls._instance

    def get(self, name: str) -> Optional[Dict[str, Any]]:
        """Get flag from cache."""
        return self._cache.get(name)

    def set(self, name: str, flag_data: Dict[str, Any]) -> None:
        """Set flag in cache."""
        self._cache[name] = flag_data

    def refresh(self, flags: List[Dict[str, Any]]) -> None:
        """Refresh entire cache from database."""
        self._cache = {f["name"]: f for f in flags}
        self._last_refresh = datetime.utcnow()
        logger.debug("flag_cache_refreshed", count=len(flags))

    def needs_refresh(self) -> bool:
        """Check if cache needs refreshing."""
        if self._last_refresh is None:
            return True
        age = (datetime.utcnow() - self._last_refresh).total_seconds()
        return age > self._ttl_seconds

    def clear(self) -> None:
        """Clear cache."""
        self._cache = {}
        self._last_refresh = None


_flag_cache = FlagCache()


# =========================================
# Feature Flag Service
# =========================================

class FeatureFlagService:
    """
    Service for evaluating feature flags.

    Supports:
    - Global enable/disable
    - Percentage-based rollout (consistent hashing)
    - User targeting
    - Role targeting
    - Environment targeting
    """

    def __init__(self, db: Optional[Session] = None):
        self._db = db

    def is_enabled(
        self,
        flag_name: str,
        user_id: Optional[str] = None,
        user_role: Optional[str] = None,
        default: bool = False,
    ) -> bool:
        """
        Check if a feature flag is enabled.

        Args:
            flag_name: Name of the flag
            user_id: Current user ID (for targeting/rollout)
            user_role: Current user role (for targeting)
            default: Default value if flag not found

        Returns:
            True if flag is enabled for this context
        """
        flag_data = self._get_flag(flag_name)
        if flag_data is None:
            logger.debug("flag_not_found", name=flag_name, default=default)
            return default

        return self._evaluate(flag_data, user_id, user_role)

    def get_all_flags(
        self,
        user_id: Optional[str] = None,
        user_role: Optional[str] = None,
    ) -> Dict[str, bool]:
        """
        Get all flag values for a user context.

        Returns:
            Dictionary of flag_name -> is_enabled
        """
        flags = self._load_all_flags()
        return {
            name: self._evaluate(data, user_id, user_role)
            for name, data in flags.items()
        }

    def _get_flag(self, name: str) -> Optional[Dict[str, Any]]:
        """Get flag data from cache or database."""
        # Check cache first
        cached = _flag_cache.get(name)
        if cached is not None and not _flag_cache.needs_refresh():
            return cached

        # Load from database if available
        if self._db is not None:
            try:
                self._refresh_cache()
                return _flag_cache.get(name)
            except Exception as e:
                logger.error("flag_load_failed", name=name, error=str(e))

        # Fall back to hardcoded defaults
        return self._get_default_flag(name)

    def _load_all_flags(self) -> Dict[str, Dict[str, Any]]:
        """Load all flags from database or cache."""
        if _flag_cache.needs_refresh() and self._db is not None:
            self._refresh_cache()
        return _flag_cache._cache or self._get_default_flags()

    def _refresh_cache(self) -> None:
        """Refresh flag cache from database."""
        if self._db is None:
            return

        try:
            from models.db import FeatureFlag

            flags = self._db.query(FeatureFlag).all()
            flag_list = [
                {
                    "name": f.name,
                    "is_enabled": f.is_enabled,
                    "rollout_percentage": f.rollout_percentage,
                    "targeted_users": f.targeted_users or [],
                    "targeted_roles": f.targeted_roles or [],
                    "environments": f.environments or [],
                }
                for f in flags
            ]
            _flag_cache.refresh(flag_list)

        except Exception as e:
            logger.error("flag_cache_refresh_failed", error=str(e))

    def _evaluate(
        self,
        flag_data: Dict[str, Any],
        user_id: Optional[str],
        user_role: Optional[str],
    ) -> bool:
        """Evaluate flag for given context."""
        # Global disable
        if not flag_data.get("is_enabled", False):
            return False

        # Environment check
        environments = flag_data.get("environments", [])
        if environments and settings.environment not in environments:
            return False

        # User targeting (always include)
        targeted_users = flag_data.get("targeted_users", [])
        if user_id and targeted_users and user_id in targeted_users:
            return True

        # Role targeting (always include)
        targeted_roles = flag_data.get("targeted_roles", [])
        if user_role and targeted_roles and user_role in targeted_roles:
            return True

        # Percentage rollout
        percentage = flag_data.get("rollout_percentage", 0)
        if percentage >= 100:
            return True
        if percentage <= 0:
            return False

        # Consistent hash based on user_id for stable bucketing
        if user_id:
            bucket = self._get_bucket(user_id, flag_data.get("name", ""))
            return bucket < percentage

        # No user context, use percentage as probability
        import random
        return random.randint(0, 99) < percentage

    @staticmethod
    def _get_bucket(user_id: str, flag_name: str) -> int:
        """
        Get consistent bucket (0-99) for user/flag combination.
        Uses MD5 for speed - not cryptographic.
        """
        key = f"{flag_name}:{user_id}"
        hash_value = hashlib.md5(key.encode()).hexdigest()
        return int(hash_value[:8], 16) % 100

    def _get_default_flag(self, name: str) -> Optional[Dict[str, Any]]:
        """Get hardcoded default flag config."""
        defaults = self._get_default_flags()
        return defaults.get(name)

    @staticmethod
    def _get_default_flags() -> Dict[str, Dict[str, Any]]:
        """Get all hardcoded default flags."""
        return {
            Flags.V2_API_ENABLED: {
                "name": Flags.V2_API_ENABLED,
                "is_enabled": False,
                "rollout_percentage": 0,
                "targeted_users": [],
                "targeted_roles": [],
                "environments": ["development", "staging"],
            },
            Flags.POSTGRES_PERSISTENCE: {
                "name": Flags.POSTGRES_PERSISTENCE,
                "is_enabled": False,
                "rollout_percentage": 0,
                "targeted_users": [],
                "targeted_roles": [],
                "environments": ["development", "staging"],
            },
            Flags.OBJECT_STORAGE: {
                "name": Flags.OBJECT_STORAGE,
                "is_enabled": False,
                "rollout_percentage": 0,
                "targeted_users": [],
                "targeted_roles": [],
                "environments": ["development", "staging"],
            },
            Flags.ASYNC_MAP_PROCESSING: {
                "name": Flags.ASYNC_MAP_PROCESSING,
                "is_enabled": False,
                "rollout_percentage": 0,
                "targeted_users": [],
                "targeted_roles": [],
                "environments": ["development", "staging"],
            },
            Flags.AUTO_PUBLISH_JOBS: {
                "name": Flags.AUTO_PUBLISH_JOBS,
                "is_enabled": False,
                "rollout_percentage": 0,
                "targeted_users": [],
                "targeted_roles": [],
                "environments": ["development", "staging"],
            },
            Flags.REDIS_QUEUE: {
                "name": Flags.REDIS_QUEUE,
                "is_enabled": False,
                "rollout_percentage": 0,
                "targeted_users": [],
                "targeted_roles": [],
                "environments": ["development", "staging"],
            },
        }


# =========================================
# FastAPI Dependency
# =========================================

def get_feature_flags(db: Session = None) -> FeatureFlagService:
    """FastAPI dependency for feature flag service."""
    return FeatureFlagService(db)


# =========================================
# Convenience Functions
# =========================================

def is_flag_enabled(
    flag_name: str,
    user_id: Optional[str] = None,
    user_role: Optional[str] = None,
    db: Optional[Session] = None,
) -> bool:
    """
    Quick check if a flag is enabled.

    Usage:
        if is_flag_enabled(Flags.V2_API_ENABLED, user.id, user.role):
            # Use v2 logic
    """
    service = FeatureFlagService(db)
    return service.is_enabled(flag_name, user_id, user_role)


def get_enabled_flags(
    user_id: Optional[str] = None,
    user_role: Optional[str] = None,
    db: Optional[Session] = None,
) -> Dict[str, bool]:
    """Get all flag states for a user."""
    service = FeatureFlagService(db)
    return service.get_all_flags(user_id, user_role)
