"""
Circuit Breaker
Protects external services (Claude API) from cascading failures
"""

import time
from enum import Enum
from typing import Optional, Callable, TypeVar, Generic
from dataclasses import dataclass, field
from threading import Lock
import logging

logger = logging.getLogger(__name__)

T = TypeVar("T")


class CircuitState(str, Enum):
    """Circuit breaker states."""
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, rejecting requests
    HALF_OPEN = "half_open"  # Testing if service recovered


@dataclass
class CircuitStats:
    """Circuit breaker statistics."""
    failures: int = 0
    successes: int = 0
    last_failure_time: Optional[float] = None
    last_success_time: Optional[float] = None
    state_changed_at: float = field(default_factory=time.time)


class CircuitBreakerError(Exception):
    """Raised when circuit is open."""
    def __init__(self, message: str, recovery_time: float):
        self.message = message
        self.recovery_time = recovery_time
        super().__init__(message)


class CircuitBreaker:
    """
    Circuit breaker implementation for external service protection.

    States:
    - CLOSED: Normal operation, requests pass through
    - OPEN: Too many failures, requests rejected immediately
    - HALF_OPEN: Testing recovery, one request allowed

    Usage:
        breaker = CircuitBreaker("claude_api", failure_threshold=5)

        @breaker
        def call_claude():
            return anthropic.messages.create(...)

        # Or manually:
        with breaker:
            result = call_claude()
    """

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        success_threshold: int = 2,
    ):
        """
        Initialize circuit breaker.

        Args:
            name: Identifier for this circuit
            failure_threshold: Failures before opening circuit
            recovery_timeout: Seconds to wait before testing recovery
            success_threshold: Successes in half-open to close circuit
        """
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.success_threshold = success_threshold

        self._state = CircuitState.CLOSED
        self._stats = CircuitStats()
        self._lock = Lock()
        self._half_open_successes = 0

    @property
    def state(self) -> CircuitState:
        """Get current circuit state."""
        self._check_recovery()
        return self._state

    @property
    def is_closed(self) -> bool:
        """Check if circuit is closed (healthy)."""
        return self.state == CircuitState.CLOSED

    @property
    def is_open(self) -> bool:
        """Check if circuit is open (failing)."""
        return self.state == CircuitState.OPEN

    def _check_recovery(self) -> None:
        """Check if circuit should transition to half-open."""
        with self._lock:
            if self._state == CircuitState.OPEN:
                elapsed = time.time() - self._stats.state_changed_at
                if elapsed >= self.recovery_timeout:
                    self._transition_to(CircuitState.HALF_OPEN)
                    logger.info(
                        f"Circuit {self.name} entering HALF_OPEN state for recovery test"
                    )

    def _transition_to(self, state: CircuitState) -> None:
        """Transition to a new state."""
        old_state = self._state
        self._state = state
        self._stats.state_changed_at = time.time()

        if state == CircuitState.HALF_OPEN:
            self._half_open_successes = 0

        logger.info(f"Circuit {self.name}: {old_state.value} -> {state.value}")

    def record_success(self) -> None:
        """Record a successful call."""
        with self._lock:
            self._stats.successes += 1
            self._stats.last_success_time = time.time()

            if self._state == CircuitState.HALF_OPEN:
                self._half_open_successes += 1
                if self._half_open_successes >= self.success_threshold:
                    self._transition_to(CircuitState.CLOSED)
                    self._stats.failures = 0
                    logger.info(f"Circuit {self.name} recovered to CLOSED state")

    def record_failure(self, error: Optional[Exception] = None) -> None:
        """Record a failed call."""
        with self._lock:
            self._stats.failures += 1
            self._stats.last_failure_time = time.time()

            if self._state == CircuitState.HALF_OPEN:
                # Single failure in half-open reopens circuit
                self._transition_to(CircuitState.OPEN)
                logger.warning(
                    f"Circuit {self.name} reopened after recovery test failure"
                )
            elif self._state == CircuitState.CLOSED:
                if self._stats.failures >= self.failure_threshold:
                    self._transition_to(CircuitState.OPEN)
                    logger.error(
                        f"Circuit {self.name} opened after {self._stats.failures} failures"
                    )

    def allow_request(self) -> bool:
        """Check if a request should be allowed."""
        state = self.state

        if state == CircuitState.CLOSED:
            return True
        elif state == CircuitState.OPEN:
            return False
        else:  # HALF_OPEN
            # Allow one test request
            return True

    def __enter__(self):
        """Context manager entry."""
        if not self.allow_request():
            recovery_time = self._stats.state_changed_at + self.recovery_timeout
            raise CircuitBreakerError(
                f"Circuit {self.name} is OPEN",
                recovery_time=recovery_time,
            )
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        if exc_type is None:
            self.record_success()
        else:
            self.record_failure(exc_val)
        return False

    def __call__(self, func: Callable[..., T]) -> Callable[..., T]:
        """Decorator to wrap a function with circuit breaker."""
        def wrapper(*args, **kwargs) -> T:
            with self:
                return func(*args, **kwargs)
        return wrapper

    def get_stats(self) -> dict:
        """Get circuit breaker statistics."""
        return {
            "name": self.name,
            "state": self._state.value,
            "failures": self._stats.failures,
            "successes": self._stats.successes,
            "last_failure": self._stats.last_failure_time,
            "last_success": self._stats.last_success_time,
            "state_changed_at": self._stats.state_changed_at,
        }

    def reset(self) -> None:
        """Reset circuit breaker to initial state."""
        with self._lock:
            self._state = CircuitState.CLOSED
            self._stats = CircuitStats()
            self._half_open_successes = 0
            logger.info(f"Circuit {self.name} manually reset")


# Global circuit breakers
_breakers: dict[str, CircuitBreaker] = {}


def get_circuit_breaker(
    name: str,
    failure_threshold: int = 5,
    recovery_timeout: float = 60.0,
) -> CircuitBreaker:
    """Get or create a named circuit breaker."""
    if name not in _breakers:
        _breakers[name] = CircuitBreaker(
            name,
            failure_threshold=failure_threshold,
            recovery_timeout=recovery_timeout,
        )
    return _breakers[name]
