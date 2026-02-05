"""
Feature Flag Model
Feature flags with percentage-based rollout and user targeting
"""

from typing import Optional, List

from sqlalchemy import Column, String, Boolean, Integer, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY

from .base import Base, TimestampMixin, generate_uuid


class FeatureFlag(Base, TimestampMixin):
    """
    Feature flag for controlled rollout.

    Supports:
    - Global enable/disable
    - Percentage-based rollout
    - User targeting (specific user IDs)
    - Role targeting (enable for specific roles)
    - Environment targeting (dev, staging, prod)

    Attributes:
        id: Unique identifier (UUID)
        name: Flag name (unique, snake_case)
        description: Human-readable description
        is_enabled: Global enable/disable
        rollout_percentage: Percentage of users (0-100)
        targeted_users: List of user IDs to always include
        targeted_roles: List of roles to always include
        environments: List of environments where flag is active
        metadata: Additional configuration
    """
    __tablename__ = "feature_flags"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=generate_uuid,
    )
    name = Column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )
    description = Column(Text, nullable=True)

    # Toggle
    is_enabled = Column(Boolean, default=False, nullable=False)

    # Rollout
    rollout_percentage = Column(Integer, default=0, nullable=False)

    # Targeting
    targeted_users = Column(ARRAY(String), nullable=True, default=list)
    targeted_roles = Column(ARRAY(String), nullable=True, default=list)
    environments = Column(ARRAY(String), nullable=True, default=list)

    # Additional config
    metadata_ = Column("metadata", JSONB, nullable=True, default=dict)

    def is_enabled_for(
        self,
        user_id: Optional[str] = None,
        user_role: Optional[str] = None,
        environment: Optional[str] = None,
    ) -> bool:
        """
        Check if flag is enabled for a specific context.

        Args:
            user_id: User ID to check
            user_role: User role to check
            environment: Current environment

        Returns:
            True if flag is enabled for this context
        """
        # Global disable
        if not self.is_enabled:
            return False

        # Environment check
        if self.environments and environment:
            if environment not in self.environments:
                return False

        # User targeting (always include targeted users)
        if user_id and self.targeted_users:
            if user_id in self.targeted_users:
                return True

        # Role targeting (always include targeted roles)
        if user_role and self.targeted_roles:
            if user_role in self.targeted_roles:
                return True

        # Percentage rollout
        if self.rollout_percentage >= 100:
            return True
        if self.rollout_percentage <= 0:
            return False

        # Use user_id for consistent bucketing if available
        if user_id:
            # Simple hash-based bucketing
            bucket = hash(user_id) % 100
            return bucket < self.rollout_percentage

        # No user context, use percentage as probability
        import random
        return random.randint(0, 99) < self.rollout_percentage

    def __repr__(self) -> str:
        status = "enabled" if self.is_enabled else "disabled"
        return f"<FeatureFlag {self.name} ({status}, {self.rollout_percentage}%)>"


# Predefined flag names for the system
class FeatureFlagNames:
    """Constants for feature flag names."""
    V2_API_ENABLED = "v2_api_enabled"
    POSTGRES_PERSISTENCE = "postgres_persistence"
    OBJECT_STORAGE = "object_storage"
    ASYNC_MAP_PROCESSING = "async_map_processing"
    AUTO_PUBLISH_JOBS = "auto_publish_jobs"
    REDIS_QUEUE = "redis_queue"


# Default flag configurations
DEFAULT_FLAGS = [
    {
        "name": FeatureFlagNames.V2_API_ENABLED,
        "description": "Enable V2 API endpoints with database persistence",
        "is_enabled": False,
        "rollout_percentage": 0,
        "environments": ["development", "staging"],
    },
    {
        "name": FeatureFlagNames.POSTGRES_PERSISTENCE,
        "description": "Store data in PostgreSQL instead of localStorage",
        "is_enabled": False,
        "rollout_percentage": 0,
        "environments": ["development", "staging"],
    },
    {
        "name": FeatureFlagNames.OBJECT_STORAGE,
        "description": "Store files in S3/MinIO instead of base64",
        "is_enabled": False,
        "rollout_percentage": 0,
        "environments": ["development", "staging"],
    },
    {
        "name": FeatureFlagNames.ASYNC_MAP_PROCESSING,
        "description": "Process maps asynchronously via worker queue",
        "is_enabled": False,
        "rollout_percentage": 0,
        "environments": ["development", "staging"],
    },
    {
        "name": FeatureFlagNames.AUTO_PUBLISH_JOBS,
        "description": "Auto-create jobs when map processing completes",
        "is_enabled": False,
        "rollout_percentage": 0,
        "environments": ["development", "staging"],
    },
    {
        "name": FeatureFlagNames.REDIS_QUEUE,
        "description": "Use Redis for job queuing",
        "is_enabled": False,
        "rollout_percentage": 0,
        "environments": ["development", "staging"],
    },
]
