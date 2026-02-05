"""
Database Configuration
SQLAlchemy + PostgreSQL with PostGIS support
"""

from typing import Generator, Optional
from contextlib import contextmanager

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool

from core.config import get_settings
from core.logging import get_logger

settings = get_settings()
logger = get_logger(__name__)


class DatabaseManager:
    """
    Database connection manager with connection pooling.
    Singleton pattern ensures single engine per application.
    """

    _instance: Optional["DatabaseManager"] = None
    _engine = None
    _session_factory = None

    def __new__(cls) -> "DatabaseManager":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def initialize(self, database_url: str) -> None:
        """
        Initialize database engine with connection pooling.
        Should be called once at application startup.
        """
        if self._engine is not None:
            logger.warning("database_already_initialized")
            return

        # Create engine with connection pool
        self._engine = create_engine(
            database_url,
            poolclass=QueuePool,
            pool_size=5,
            max_overflow=10,
            pool_timeout=30,
            pool_recycle=1800,  # Recycle connections after 30 minutes
            pool_pre_ping=True,  # Verify connections before use
            echo=settings.debug,
        )

        # Create session factory
        self._session_factory = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self._engine,
            expire_on_commit=False,
        )

        # Log connection events in debug mode
        if settings.debug:
            @event.listens_for(self._engine, "connect")
            def on_connect(dbapi_connection, connection_record):
                logger.debug("database_connection_created")

            @event.listens_for(self._engine, "checkout")
            def on_checkout(dbapi_connection, connection_record, connection_proxy):
                logger.debug("database_connection_checkout")

        logger.info(
            "database_initialized",
            pool_size=5,
            max_overflow=10,
        )

    @property
    def engine(self):
        """Get SQLAlchemy engine."""
        if self._engine is None:
            raise RuntimeError("Database not initialized. Call initialize() first.")
        return self._engine

    @property
    def session_factory(self):
        """Get session factory."""
        if self._session_factory is None:
            raise RuntimeError("Database not initialized. Call initialize() first.")
        return self._session_factory

    def get_session(self) -> Session:
        """Get a new database session."""
        return self.session_factory()

    @contextmanager
    def session_scope(self) -> Generator[Session, None, None]:
        """
        Context manager for database sessions.
        Automatically handles commit/rollback and cleanup.
        """
        session = self.get_session()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error("database_session_error", error=str(e))
            raise
        finally:
            session.close()

    def close(self) -> None:
        """Close database connections. Call at application shutdown."""
        if self._engine is not None:
            self._engine.dispose()
            logger.info("database_connections_closed")


# Global database manager instance
db_manager = DatabaseManager()


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency for database sessions.
    Usage:
        @app.get("/items")
        def get_items(db: Session = Depends(get_db)):
            ...
    """
    session = db_manager.get_session()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_database(database_url: str) -> None:
    """Initialize database at application startup."""
    db_manager.initialize(database_url)


def close_database() -> None:
    """Close database at application shutdown."""
    db_manager.close()
