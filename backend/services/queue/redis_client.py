"""
Redis Client
Connection management and job serialization for async processing
"""

import json
from typing import Optional, Any, Dict, List
from datetime import datetime
import uuid

from core.config import get_settings
from core.logging import get_logger

# Redis import with fallback
try:
    import redis
    from redis import Redis
    from redis.connection import ConnectionPool
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    Redis = None
    ConnectionPool = None

settings = get_settings()
logger = get_logger(__name__)


class RedisClient:
    """
    Redis client with connection pooling and job serialization.

    Provides:
    - Connection pool management
    - JSON serialization for jobs
    - Health checking
    - Graceful degradation when Redis unavailable
    """

    _instance: Optional["RedisClient"] = None
    _pool: Optional[ConnectionPool] = None
    _client: Optional[Redis] = None

    def __new__(cls) -> "RedisClient":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def initialize(self, redis_url: str) -> bool:
        """
        Initialize Redis connection pool.

        Args:
            redis_url: Redis connection URL (redis://host:port/db)

        Returns:
            True if connection successful, False otherwise
        """
        if not REDIS_AVAILABLE:
            logger.warning("redis_not_available", message="Redis package not installed")
            return False

        if self._client is not None:
            logger.warning("redis_already_initialized")
            return True

        try:
            # Create connection pool
            self._pool = ConnectionPool.from_url(
                redis_url,
                max_connections=10,
                socket_timeout=5.0,
                socket_connect_timeout=5.0,
                retry_on_timeout=True,
            )

            # Create client
            self._client = Redis(connection_pool=self._pool)

            # Test connection
            self._client.ping()

            logger.info("redis_initialized", url=redis_url.split("@")[-1])  # Log without credentials
            return True

        except Exception as e:
            logger.error("redis_initialization_failed", error=str(e))
            self._pool = None
            self._client = None
            return False

    @property
    def client(self) -> Optional[Redis]:
        """Get Redis client instance."""
        return self._client

    @property
    def is_available(self) -> bool:
        """Check if Redis is available."""
        if self._client is None:
            return False
        try:
            self._client.ping()
            return True
        except Exception:
            return False

    def close(self) -> None:
        """Close Redis connections."""
        if self._pool is not None:
            self._pool.disconnect()
            logger.info("redis_connections_closed")

    # =========================================
    # Job Queue Operations
    # =========================================

    def enqueue(self, queue_name: str, job_data: Dict[str, Any], priority: int = 0) -> Optional[str]:
        """
        Add a job to the queue.

        Args:
            queue_name: Name of the queue
            job_data: Job payload
            priority: Job priority (higher = more urgent)

        Returns:
            Job ID if successful, None otherwise
        """
        if not self.is_available:
            logger.warning("redis_enqueue_skipped", reason="not_available")
            return None

        job_id = str(uuid.uuid4())
        job = {
            "id": job_id,
            "data": job_data,
            "priority": priority,
            "created_at": datetime.utcnow().isoformat(),
            "attempts": 0,
            "status": "pending",
        }

        try:
            # Use sorted set for priority queue
            score = -priority + (datetime.utcnow().timestamp() / 1_000_000_000)
            self._client.zadd(f"queue:{queue_name}", {json.dumps(job): score})

            logger.info(
                "job_enqueued",
                queue=queue_name,
                job_id=job_id,
                priority=priority,
            )
            return job_id

        except Exception as e:
            logger.error("job_enqueue_failed", queue=queue_name, error=str(e))
            return None

    def dequeue(self, queue_name: str, timeout: int = 0) -> Optional[Dict[str, Any]]:
        """
        Get next job from queue.

        Args:
            queue_name: Name of the queue
            timeout: Blocking timeout in seconds (0 = non-blocking)

        Returns:
            Job data if available, None otherwise
        """
        if not self.is_available:
            return None

        try:
            # Get highest priority job (lowest score)
            result = self._client.zpopmin(f"queue:{queue_name}", count=1)
            if result:
                job_json, _ = result[0]
                return json.loads(job_json)
            return None

        except Exception as e:
            logger.error("job_dequeue_failed", queue=queue_name, error=str(e))
            return None

    def get_queue_length(self, queue_name: str) -> int:
        """Get number of jobs in queue."""
        if not self.is_available:
            return 0
        try:
            return self._client.zcard(f"queue:{queue_name}")
        except Exception:
            return 0

    # =========================================
    # Dead Letter Queue
    # =========================================

    def move_to_dlq(self, queue_name: str, job: Dict[str, Any], error: str) -> bool:
        """
        Move failed job to dead letter queue.

        Args:
            queue_name: Original queue name
            job: Failed job data
            error: Error message

        Returns:
            True if successful
        """
        if not self.is_available:
            return False

        try:
            dlq_job = {
                **job,
                "failed_at": datetime.utcnow().isoformat(),
                "error": error,
                "original_queue": queue_name,
            }
            self._client.lpush(f"dlq:{queue_name}", json.dumps(dlq_job))
            logger.info("job_moved_to_dlq", queue=queue_name, job_id=job.get("id"))
            return True

        except Exception as e:
            logger.error("dlq_move_failed", error=str(e))
            return False

    def get_dlq_jobs(self, queue_name: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Get jobs from dead letter queue."""
        if not self.is_available:
            return []
        try:
            jobs = self._client.lrange(f"dlq:{queue_name}", 0, limit - 1)
            return [json.loads(j) for j in jobs]
        except Exception:
            return []

    # =========================================
    # Job Status Tracking
    # =========================================

    def set_job_status(self, job_id: str, status: str, data: Optional[Dict] = None) -> bool:
        """
        Update job status.

        Args:
            job_id: Job identifier
            status: New status
            data: Additional status data
        """
        if not self.is_available:
            return False

        try:
            status_data = {
                "status": status,
                "updated_at": datetime.utcnow().isoformat(),
            }
            if data:
                status_data.update(data)

            self._client.hset(f"job_status:{job_id}", mapping={
                k: json.dumps(v) if isinstance(v, (dict, list)) else str(v)
                for k, v in status_data.items()
            })
            # Expire after 24 hours
            self._client.expire(f"job_status:{job_id}", 86400)
            return True

        except Exception as e:
            logger.error("job_status_update_failed", job_id=job_id, error=str(e))
            return False

    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get job status."""
        if not self.is_available:
            return None
        try:
            status = self._client.hgetall(f"job_status:{job_id}")
            if status:
                return {k.decode(): v.decode() for k, v in status.items()}
            return None
        except Exception:
            return None


# Global client instance
_redis_client: Optional[RedisClient] = None


def get_redis_client() -> RedisClient:
    """Get global Redis client instance."""
    global _redis_client
    if _redis_client is None:
        _redis_client = RedisClient()
    return _redis_client


def init_redis(redis_url: str) -> bool:
    """Initialize Redis at application startup."""
    client = get_redis_client()
    return client.initialize(redis_url)


def close_redis() -> None:
    """Close Redis at application shutdown."""
    client = get_redis_client()
    client.close()
