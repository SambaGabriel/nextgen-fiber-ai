"""API Routes"""

from fastapi import APIRouter
from .production import router as production_router
from .smartsheets import router as smartsheets_router
from .invoices import router as invoices_router
from .map_analyzer import router as map_analyzer_router
from .email import router as email_router

router = APIRouter()
router.include_router(production_router, prefix="/production", tags=["Production Reports"])
router.include_router(smartsheets_router, prefix="/smartsheets", tags=["SmartSheets Integration"])
router.include_router(invoices_router, tags=["Invoices"])
router.include_router(map_analyzer_router, tags=["Map Analyzer"])
router.include_router(email_router, prefix="/email", tags=["Email Service"])
