"""
Event System
Simple event bus for decoupled component communication
"""

from typing import Callable, Dict, List, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import uuid
import logging
from threading import Lock

logger = logging.getLogger(__name__)


class EventType(str, Enum):
    """System event types."""
    # Map events
    MAP_UPLOADED = "map.uploaded"
    MAP_PROCESSING_STARTED = "map.processing_started"
    MAP_COMPLETED = "map.completed"
    MAP_FAILED = "map.failed"

    # Job events
    JOB_CREATED = "job.created"
    JOB_ASSIGNED = "job.assigned"
    JOB_STARTED = "job.started"
    JOB_SUBMITTED = "job.submitted"
    JOB_APPROVED = "job.approved"
    JOB_REJECTED = "job.rejected"
    JOB_COMPLETED = "job.completed"

    # User events
    USER_LOGIN = "user.login"
    USER_LOGOUT = "user.logout"

    # System events
    FEATURE_FLAG_CHANGED = "system.feature_flag_changed"


@dataclass
class Event:
    """Event data structure."""
    type: str
    payload: Dict[str, Any]
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    source: Optional[str] = None
    user_id: Optional[str] = None


# Type alias for event handlers
EventHandler = Callable[[Event], None]


class EventBus:
    """
    Simple in-process event bus.

    Supports:
    - Subscribe to specific event types
    - Subscribe to all events
    - Sync and async dispatch (sync only for now)
    - Handler error isolation
    """

    _instance: Optional["EventBus"] = None
    _lock = Lock()

    def __new__(cls) -> "EventBus":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._handlers: Dict[str, List[EventHandler]] = {}
                    cls._instance._global_handlers: List[EventHandler] = []
        return cls._instance

    def subscribe(self, event_type: str, handler: EventHandler) -> None:
        """
        Subscribe to a specific event type.

        Args:
            event_type: Event type to subscribe to
            handler: Callback function(event) -> None
        """
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)
        logger.debug(f"Handler subscribed to {event_type}")

    def subscribe_all(self, handler: EventHandler) -> None:
        """Subscribe to all events."""
        self._global_handlers.append(handler)
        logger.debug("Handler subscribed to all events")

    def unsubscribe(self, event_type: str, handler: EventHandler) -> None:
        """Unsubscribe from an event type."""
        if event_type in self._handlers:
            self._handlers[event_type] = [
                h for h in self._handlers[event_type] if h != handler
            ]

    def publish(self, event: Event) -> None:
        """
        Publish an event to all subscribers.

        Args:
            event: Event to publish
        """
        logger.info(f"Event published: {event.type}", extra={"event_id": event.event_id})

        # Call type-specific handlers
        handlers = self._handlers.get(event.type, [])
        for handler in handlers:
            try:
                handler(event)
            except Exception as e:
                logger.error(
                    f"Handler error for {event.type}: {e}",
                    extra={"event_id": event.event_id},
                )

        # Call global handlers
        for handler in self._global_handlers:
            try:
                handler(event)
            except Exception as e:
                logger.error(
                    f"Global handler error for {event.type}: {e}",
                    extra={"event_id": event.event_id},
                )

    def emit(
        self,
        event_type: str,
        payload: Dict[str, Any],
        source: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Event:
        """
        Convenience method to create and publish an event.

        Args:
            event_type: Type of event
            payload: Event data
            source: Source component
            user_id: User who triggered the event

        Returns:
            The created event
        """
        event = Event(
            type=event_type,
            payload=payload,
            source=source,
            user_id=user_id,
        )
        self.publish(event)
        return event

    def clear(self) -> None:
        """Clear all handlers (for testing)."""
        self._handlers.clear()
        self._global_handlers.clear()


# Global event bus instance
event_bus = EventBus()


# Convenience functions
def subscribe(event_type: str, handler: EventHandler) -> None:
    """Subscribe to an event type."""
    event_bus.subscribe(event_type, handler)


def emit(
    event_type: str,
    payload: Dict[str, Any],
    source: Optional[str] = None,
    user_id: Optional[str] = None,
) -> Event:
    """Emit an event."""
    return event_bus.emit(event_type, payload, source, user_id)


# =========================================
# Auto-Publish Handler
# =========================================

def setup_auto_publish_handler():
    """
    Set up the auto-publish handler that creates jobs when maps complete.

    This should be called at application startup.
    """
    from core.feature_flags import is_flag_enabled, Flags

    def on_map_completed(event: Event):
        """Handle map completed event - auto-create job if enabled."""
        map_id = event.payload.get("map_id")
        user_id = event.user_id

        # Check feature flag
        if not is_flag_enabled(Flags.AUTO_PUBLISH_JOBS, user_id=user_id):
            logger.debug(f"Auto-publish disabled for map {map_id}")
            return

        logger.info(f"Auto-publishing job for map {map_id}")

        try:
            # Import here to avoid circular imports
            from services.job_service import create_job_from_map
            job = create_job_from_map(map_id, user_id)

            if job:
                # Emit job created event
                emit(
                    EventType.JOB_CREATED.value,
                    {
                        "job_id": str(job.id),
                        "job_code": job.job_code,
                        "source_map_id": map_id,
                        "auto_published": True,
                    },
                    source="auto_publish",
                    user_id=user_id,
                )
                logger.info(f"Job {job.job_code} auto-created from map {map_id}")
            else:
                logger.warning(f"Failed to auto-create job for map {map_id}")

        except Exception as e:
            logger.error(f"Auto-publish failed for map {map_id}: {e}")

    # Subscribe to map completed events
    subscribe(EventType.MAP_COMPLETED.value, on_map_completed)
    logger.info("Auto-publish handler registered")
