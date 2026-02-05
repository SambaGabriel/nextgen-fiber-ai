"""
NextGen Fiber AI Agent - Main Application
Enterprise-grade FastAPI application
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from core import get_settings, setup_logging, get_logger
from api import router as api_router
from api.v2 import router as api_v2_router


settings = get_settings()
logger = get_logger(__name__)


def _init_infrastructure():
    """Initialize optional infrastructure services."""
    # Initialize database if configured
    if settings.database_url:
        try:
            from core.database import init_database
            init_database(settings.database_url)
            logger.info("database_connected")
        except Exception as e:
            logger.warning("database_connection_failed", error=str(e))

    # Initialize Redis if configured
    if settings.redis_url:
        try:
            from services.queue import init_redis
            if init_redis(settings.redis_url):
                logger.info("redis_connected")
        except Exception as e:
            logger.warning("redis_connection_failed", error=str(e))

    # Initialize object storage if configured
    if settings.s3_endpoint and settings.s3_access_key:
        try:
            from services.storage import init_object_storage
            if init_object_storage(
                settings.s3_endpoint,
                settings.s3_access_key,
                settings.s3_secret_key,
                settings.s3_bucket,
            ):
                logger.info("object_storage_connected")
        except Exception as e:
            logger.warning("object_storage_connection_failed", error=str(e))

    # Setup event handlers
    try:
        from core.events import setup_auto_publish_handler
        setup_auto_publish_handler()
        logger.info("event_handlers_registered")
    except Exception as e:
        logger.warning("event_handlers_setup_failed", error=str(e))


def _cleanup_infrastructure():
    """Cleanup infrastructure on shutdown."""
    # Close database connections
    if settings.database_url:
        try:
            from core.database import close_database
            close_database()
        except Exception:
            pass

    # Close Redis
    if settings.redis_url:
        try:
            from services.queue import close_redis
            close_redis()
        except Exception:
            pass

    # Close object storage
    if settings.s3_endpoint:
        try:
            from services.storage import close_object_storage
            close_object_storage()
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle management"""
    # Startup
    setup_logging()
    logger.info(
        "application_startup",
        app_name=settings.app_name,
        version=settings.app_version,
        environment=settings.environment
    )

    # Initialize infrastructure
    _init_infrastructure()

    yield

    # Shutdown
    _cleanup_infrastructure()
    logger.info("application_shutdown")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="AI Agent for fiber optic construction management",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes - V1 (existing API)
app.include_router(api_router, prefix=settings.api_prefix)

# Routes - V2 (new enterprise API with database persistence)
app.include_router(api_v2_router, prefix=settings.api_v2_prefix)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    # Check infrastructure status
    db_status = "not_configured"
    redis_status = "not_configured"
    storage_status = "not_configured"

    if settings.database_url:
        try:
            from core.database import db_manager
            db_status = "healthy" if db_manager._engine else "disconnected"
        except Exception:
            db_status = "error"

    if settings.redis_url:
        try:
            from services.queue import get_redis_client
            client = get_redis_client()
            redis_status = "healthy" if client.is_available else "disconnected"
        except Exception:
            redis_status = "error"

    if settings.s3_endpoint:
        try:
            from services.storage import get_object_storage
            storage = get_object_storage()
            storage_status = "healthy" if storage.is_available else "disconnected"
        except Exception:
            storage_status = "error"

    return {
        "status": "healthy",
        "version": settings.app_version,
        "environment": settings.environment,
        "services": {
            "database": db_status,
            "redis": redis_status,
            "object_storage": storage_status,
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug
    )
