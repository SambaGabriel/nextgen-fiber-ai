"""
API V2 Router
Enterprise-grade endpoints with database persistence
"""

from fastapi import APIRouter

from .auth import router as auth_router
from .maps import router as maps_router
from .jobs import router as jobs_router
from .audit import router as audit_router

router = APIRouter()

# Include all v2 routers
router.include_router(auth_router, prefix="/auth", tags=["V2 Auth"])
router.include_router(maps_router, prefix="/maps", tags=["V2 Maps"])
router.include_router(jobs_router, prefix="/jobs", tags=["V2 Jobs"])
router.include_router(audit_router, prefix="/audit", tags=["V2 Audit"])
