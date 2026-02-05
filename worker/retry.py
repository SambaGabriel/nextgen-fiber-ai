"""
Retry Module
Exponential backoff retry logic for worker operations
"""

import time
import random
from typing import TypeVar, Callable, Optional, Type, Tuple, Any
from functools import wraps
import logging

logger = logging.getLogger(__name__)

T = TypeVar("T")


class RetryExhausted(Exception):
    """Raised when all retry attempts are exhausted."""
    def __init__(self, message: str, last_exception: Optional[Exception] = None):
        self.message = message
        self.last_exception = last_exception
        super().__init__(message)


def exponential_backoff(
    attempt: int,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    jitter: bool = True,
) -> float:
    """
    Calculate exponential backoff delay.

    Args:
        attempt: Current attempt number (1-based)
        base_delay: Base delay in seconds
        max_delay: Maximum delay cap
        jitter: Add random jitter to prevent thundering herd

    Returns:
        Delay in seconds
    """
    delay = base_delay * (2 ** (attempt - 1))
    delay = min(delay, max_delay)

    if jitter:
        # Add up to 25% random jitter
        jitter_range = delay * 0.25
        delay += random.uniform(-jitter_range, jitter_range)

    return max(0, delay)


def retry(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    exceptions: Tuple[Type[Exception], ...] = (Exception,),
    on_retry: Optional[Callable[[int, Exception], None]] = None,
    should_retry: Optional[Callable[[Exception], bool]] = None,
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """
    Decorator for retry with exponential backoff.

    Args:
        max_attempts: Maximum number of attempts
        base_delay: Base delay between retries
        max_delay: Maximum delay cap
        exceptions: Tuple of exceptions to catch and retry
        on_retry: Callback called before each retry (attempt, exception)
        should_retry: Function to determine if error is retryable

    Usage:
        @retry(max_attempts=3, exceptions=(ConnectionError,))
        def fetch_data():
            ...
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args, **kwargs) -> T:
            last_exception = None

            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e

                    # Check if we should retry this specific error
                    if should_retry and not should_retry(e):
                        raise

                    if attempt == max_attempts:
                        logger.error(
                            f"Retry exhausted for {func.__name__} "
                            f"after {max_attempts} attempts: {e}"
                        )
                        raise RetryExhausted(
                            f"Failed after {max_attempts} attempts",
                            last_exception=e,
                        )

                    delay = exponential_backoff(attempt, base_delay, max_delay)

                    logger.warning(
                        f"Attempt {attempt}/{max_attempts} failed for {func.__name__}: {e}. "
                        f"Retrying in {delay:.2f}s"
                    )

                    if on_retry:
                        on_retry(attempt, e)

                    time.sleep(delay)

            # Should not reach here, but just in case
            raise RetryExhausted(
                f"Failed after {max_attempts} attempts",
                last_exception=last_exception,
            )

        return wrapper
    return decorator


class RetryContext:
    """
    Context manager for manual retry control.

    Usage:
        with RetryContext(max_attempts=3) as ctx:
            while ctx.should_continue():
                try:
                    result = risky_operation()
                    ctx.success()
                except Exception as e:
                    ctx.fail(e)
    """

    def __init__(
        self,
        max_attempts: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        exceptions: Tuple[Type[Exception], ...] = (Exception,),
    ):
        self.max_attempts = max_attempts
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.exceptions = exceptions

        self._attempt = 0
        self._succeeded = False
        self._last_exception: Optional[Exception] = None

    def __enter__(self) -> "RetryContext":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type and issubclass(exc_type, self.exceptions):
            if self._attempt >= self.max_attempts:
                raise RetryExhausted(
                    f"Failed after {self.max_attempts} attempts",
                    last_exception=exc_val,
                )
            return True  # Suppress exception for retry
        return False

    def should_continue(self) -> bool:
        """Check if we should try (again)."""
        if self._succeeded:
            return False
        if self._attempt >= self.max_attempts:
            if self._last_exception:
                raise RetryExhausted(
                    f"Failed after {self.max_attempts} attempts",
                    last_exception=self._last_exception,
                )
            return False
        return True

    def fail(self, exception: Exception) -> None:
        """Record a failure and wait before next attempt."""
        self._last_exception = exception
        self._attempt += 1

        if self._attempt < self.max_attempts:
            delay = exponential_backoff(self._attempt, self.base_delay, self.max_delay)
            logger.warning(
                f"Attempt {self._attempt}/{self.max_attempts} failed: {exception}. "
                f"Retrying in {delay:.2f}s"
            )
            time.sleep(delay)
        else:
            logger.error(f"Retry exhausted after {self.max_attempts} attempts")

    def success(self) -> None:
        """Record success."""
        self._succeeded = True
        self._attempt += 1

    @property
    def attempt(self) -> int:
        """Current attempt number."""
        return self._attempt + 1

    @property
    def attempts_remaining(self) -> int:
        """Number of attempts remaining."""
        return max(0, self.max_attempts - self._attempt)
