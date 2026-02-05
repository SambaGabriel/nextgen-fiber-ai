"""
Queue Consumer
Consumes jobs from Redis queue and dispatches to handlers
"""

import time
import signal
import threading
from typing import Dict, Any, Optional, Callable, List
from concurrent.futures import ThreadPoolExecutor, Future
import logging

from config import WorkerSettings

# Redis import with fallback
try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

logger = logging.getLogger(__name__)


class QueueConsumer:
    """
    Redis queue consumer with concurrent job processing.

    Features:
    - Concurrent job processing with thread pool
    - Graceful shutdown handling
    - Dead letter queue for failed jobs
    - Job status tracking
    """

    def __init__(
        self,
        settings: WorkerSettings,
        handlers: Dict[str, Callable[[Dict[str, Any]], None]],
    ):
        """
        Initialize queue consumer.

        Args:
            settings: Worker settings
            handlers: Map of job type to handler function
        """
        self.settings = settings
        self.handlers = handlers
        self._running = False
        self._redis: Optional[redis.Redis] = None
        self._executor: Optional[ThreadPoolExecutor] = None
        self._active_jobs: Dict[str, Future] = {}
        self._shutdown_event = threading.Event()

    def _connect_redis(self) -> bool:
        """Connect to Redis."""
        if not REDIS_AVAILABLE:
            logger.error("Redis package not installed")
            return False

        try:
            self._redis = redis.from_url(
                self.settings.redis_url,
                socket_timeout=5.0,
                socket_connect_timeout=5.0,
            )
            self._redis.ping()
            logger.info(f"Connected to Redis at {self.settings.redis_url}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            return False

    def _dequeue_job(self, queue_name: str) -> Optional[Dict[str, Any]]:
        """Get next job from queue."""
        try:
            # Use ZPOPMIN for priority queue
            result = self._redis.zpopmin(f"queue:{queue_name}", count=1)
            if result:
                job_json, _ = result[0]
                import json
                return json.loads(job_json)
            return None
        except Exception as e:
            logger.error(f"Failed to dequeue from {queue_name}: {e}")
            return None

    def _move_to_dlq(self, queue_name: str, job: Dict[str, Any], error: str) -> None:
        """Move failed job to dead letter queue."""
        try:
            import json
            dlq_job = {
                **job,
                "failed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "error": error,
                "original_queue": queue_name,
            }
            self._redis.lpush(f"dlq:{queue_name}", json.dumps(dlq_job))
            logger.info(f"Moved job {job.get('id')} to DLQ")
        except Exception as e:
            logger.error(f"Failed to move job to DLQ: {e}")

    def _update_job_status(self, job_id: str, status: str, data: Optional[Dict] = None) -> None:
        """Update job status in Redis."""
        try:
            import json
            status_data = {
                "status": status,
                "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
            if data:
                status_data.update(data)

            self._redis.hset(f"job_status:{job_id}", mapping={
                k: json.dumps(v) if isinstance(v, (dict, list)) else str(v)
                for k, v in status_data.items()
            })
            self._redis.expire(f"job_status:{job_id}", 86400)  # 24h TTL
        except Exception as e:
            logger.error(f"Failed to update job status: {e}")

    def _process_job(self, queue_name: str, job: Dict[str, Any]) -> None:
        """Process a single job."""
        job_id = job.get("id", "unknown")
        job_data = job.get("data", {})
        job_type = job_data.get("type", "unknown")

        logger.info(f"Processing job {job_id} (type: {job_type})")
        self._update_job_status(job_id, "processing")

        try:
            # Find handler
            handler = self.handlers.get(job_type)
            if handler is None:
                raise ValueError(f"No handler for job type: {job_type}")

            # Execute handler
            start_time = time.time()
            handler(job_data)
            processing_time = int((time.time() - start_time) * 1000)

            # Success
            self._update_job_status(job_id, "completed", {
                "processing_time_ms": processing_time,
            })
            logger.info(f"Job {job_id} completed in {processing_time}ms")

        except Exception as e:
            logger.error(f"Job {job_id} failed: {e}")

            # Update attempt count
            attempts = job.get("attempts", 0) + 1
            job["attempts"] = attempts

            if attempts >= self.settings.max_retries:
                # Move to DLQ
                self._update_job_status(job_id, "failed", {"error": str(e)})
                self._move_to_dlq(queue_name, job, str(e))
            else:
                # Re-queue for retry
                self._update_job_status(job_id, "retry", {
                    "attempt": attempts,
                    "error": str(e),
                })
                # Add back to queue with lower priority
                import json
                score = time.time() + (self.settings.retry_delay_seconds * attempts)
                self._redis.zadd(f"queue:{queue_name}", {json.dumps(job): score})
                logger.info(f"Job {job_id} re-queued for retry (attempt {attempts})")

    def _poll_queue(self, queue_name: str) -> None:
        """Poll a single queue for jobs."""
        job = self._dequeue_job(queue_name)
        if job:
            job_id = job.get("id", "unknown")

            # Submit to thread pool
            future = self._executor.submit(self._process_job, queue_name, job)
            self._active_jobs[job_id] = future

            # Clean up completed futures
            completed = [jid for jid, f in self._active_jobs.items() if f.done()]
            for jid in completed:
                del self._active_jobs[jid]

    def _run_loop(self, queues: List[str]) -> None:
        """Main consumer loop."""
        logger.info(f"Starting consumer loop for queues: {queues}")

        while self._running and not self._shutdown_event.is_set():
            try:
                for queue_name in queues:
                    if not self._running:
                        break

                    # Don't exceed max concurrent jobs
                    active_count = len([f for f in self._active_jobs.values() if not f.done()])
                    if active_count >= self.settings.max_concurrent_jobs:
                        time.sleep(0.1)
                        continue

                    self._poll_queue(queue_name)

                # Small delay between poll cycles
                time.sleep(0.1)

            except Exception as e:
                logger.error(f"Error in consumer loop: {e}")
                time.sleep(1)

    def start(self, queues: List[str]) -> None:
        """
        Start consuming from queues.

        Args:
            queues: List of queue names to consume from
        """
        if not self._connect_redis():
            raise RuntimeError("Failed to connect to Redis")

        self._executor = ThreadPoolExecutor(
            max_workers=self.settings.max_concurrent_jobs,
            thread_name_prefix="job-worker",
        )

        self._running = True
        self._run_loop(queues)

    def stop(self, wait: bool = True, timeout: float = 30.0) -> None:
        """
        Stop the consumer.

        Args:
            wait: Wait for active jobs to complete
            timeout: Maximum time to wait for shutdown
        """
        logger.info("Stopping consumer...")
        self._running = False
        self._shutdown_event.set()

        if wait and self._executor:
            # Wait for active jobs
            logger.info(f"Waiting for {len(self._active_jobs)} active jobs...")
            self._executor.shutdown(wait=True, cancel_futures=False)

        if self._redis:
            self._redis.close()

        logger.info("Consumer stopped")


def create_consumer(
    settings: WorkerSettings,
    handlers: Dict[str, Callable[[Dict[str, Any]], None]],
) -> QueueConsumer:
    """Create a queue consumer instance."""
    return QueueConsumer(settings, handlers)
