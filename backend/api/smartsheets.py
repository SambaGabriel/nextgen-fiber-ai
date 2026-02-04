"""
NextGen Fiber AI Agent - SmartSheets API
REST endpoints for SmartSheets integration
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from services import SmartSheetsClient, SmartSheetsSync
from services.integrations.smartsheets import ColumnMapping
from models import ProductionReport
from core import get_logger, get_settings

logger = get_logger(__name__)
settings = get_settings()

router = APIRouter()


# Request/Response Models

class ConnectionTestResponse(BaseModel):
    connected: bool
    user_id: Optional[int] = None
    email: Optional[str] = None
    name: Optional[str] = None
    error: Optional[str] = None


class SheetInfo(BaseModel):
    id: int
    name: str
    permalink: Optional[str] = None
    created_at: Optional[str] = None
    modified_at: Optional[str] = None
    total_row_count: int = 0


class ColumnInfo(BaseModel):
    id: int
    title: str
    type: str
    index: int
    primary: bool = False


class SyncRequest(BaseModel):
    sheet_id: int
    report: dict  # ProductionReport as dict
    update_existing: bool = True


class SyncResponse(BaseModel):
    success: bool
    operation: Optional[str] = None
    row_id: Optional[int] = None
    run_id: Optional[str] = None
    sheet_id: Optional[int] = None
    error: Optional[str] = None


class BatchSyncRequest(BaseModel):
    sheet_id: int
    reports: list[dict]


class BatchSyncResponse(BaseModel):
    total: int
    success_count: int
    error_count: int
    results: list[SyncResponse]


class MappingConfig(BaseModel):
    header: Optional[dict[str, str]] = None
    production: Optional[dict[str, str]] = None


class SyncStatusRequest(BaseModel):
    sheet_id: int
    run_id: str


# Helper to get client

def get_smartsheets_client() -> SmartSheetsClient:
    """Get SmartSheets client, raises if not configured"""
    if not settings.smartsheet_api_key:
        raise HTTPException(
            status_code=503,
            detail="SmartSheets API key not configured. Set SMARTSHEET_API_KEY in environment."
        )
    return SmartSheetsClient()


# Endpoints

@router.get("/test-connection", response_model=ConnectionTestResponse)
async def test_connection():
    """
    Test SmartSheets API connection

    Returns user info if successful
    """
    try:
        client = get_smartsheets_client()
        result = client.test_connection()
        return ConnectionTestResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("connection_test_failed", error=str(e))
        return ConnectionTestResponse(connected=False, error=str(e))


@router.get("/sheets", response_model=list[SheetInfo])
async def list_sheets():
    """
    List all accessible SmartSheets

    Returns list of sheet metadata
    """
    try:
        client = get_smartsheets_client()
        sheets = client.list_sheets()
        return [SheetInfo(**s) for s in sheets]
    except HTTPException:
        raise
    except Exception as e:
        logger.error("list_sheets_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sheets/{sheet_id}")
async def get_sheet(sheet_id: int):
    """
    Get full sheet data including columns and rows

    Args:
        sheet_id: SmartSheets sheet ID
    """
    try:
        client = get_smartsheets_client()
        sheet = client.get_sheet(sheet_id)
        return sheet
    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_sheet_failed", sheet_id=sheet_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sheets/{sheet_id}/columns", response_model=list[ColumnInfo])
async def get_columns(sheet_id: int):
    """
    Get column definitions for a sheet

    Useful for configuring column mappings
    """
    try:
        client = get_smartsheets_client()
        columns = client.get_columns(sheet_id)
        return [ColumnInfo(**c) for c in columns]
    except HTTPException:
        raise
    except Exception as e:
        logger.error("get_columns_failed", sheet_id=sheet_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync", response_model=SyncResponse)
async def sync_production_report(request: SyncRequest):
    """
    Sync a production report to SmartSheets

    Creates new row or updates existing if run_id matches
    """
    try:
        client = get_smartsheets_client()
        sync = SmartSheetsSync(client)

        # Convert dict to ProductionReport
        report = ProductionReport(**request.report)

        result = sync.sync_production_report(
            report=report,
            sheet_id=request.sheet_id,
            update_existing=request.update_existing
        )

        return SyncResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("sync_failed", error=str(e))
        return SyncResponse(success=False, error=str(e))


@router.post("/sync/batch", response_model=BatchSyncResponse)
async def batch_sync_reports(request: BatchSyncRequest):
    """
    Sync multiple production reports in batch

    More efficient for bulk operations
    """
    try:
        client = get_smartsheets_client()
        sync = SmartSheetsSync(client)

        # Convert dicts to ProductionReports
        reports = [ProductionReport(**r) for r in request.reports]

        result = sync.batch_sync_reports(reports, request.sheet_id)

        return BatchSyncResponse(
            total=result["total"],
            success_count=result["success_count"],
            error_count=result["error_count"],
            results=[SyncResponse(**r) for r in result["results"]]
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("batch_sync_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync/status")
async def get_sync_status(request: SyncStatusRequest):
    """
    Check if a run_id is already synced to the sheet

    Returns row info if found
    """
    try:
        client = get_smartsheets_client()
        sync = SmartSheetsSync(client)

        status = sync.get_sync_status(request.sheet_id, request.run_id)
        return status

    except HTTPException:
        raise
    except Exception as e:
        logger.error("sync_status_failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/mapping/default")
async def get_default_mapping():
    """
    Get default column mapping configuration

    Returns the default field-to-column mappings
    """
    mapping = ColumnMapping()
    return {
        "header_mapping": mapping.header_mapping,
        "production_mapping": mapping.production_mapping
    }


@router.post("/mapping/preview")
async def preview_mapping(report: dict, mapping: Optional[MappingConfig] = None):
    """
    Preview how a report would be mapped to sheet columns

    Useful for verifying mapping before sync
    """
    try:
        custom_mapping = None
        if mapping:
            custom_mapping = {
                "header": mapping.header,
                "production": mapping.production
            }

        col_mapping = ColumnMapping(custom_mapping)
        prod_report = ProductionReport(**report)

        row_data = col_mapping.map_report_to_row(prod_report)

        return {
            "preview": row_data,
            "field_count": len(row_data)
        }

    except Exception as e:
        logger.error("mapping_preview_failed", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/health")
async def health():
    """Health check for SmartSheets service"""
    configured = bool(settings.smartsheet_api_key)

    if configured:
        try:
            client = SmartSheetsClient()
            connection = client.test_connection()
            connected = connection.get("connected", False)
        except Exception:
            connected = False
    else:
        connected = False

    return {
        "status": "healthy" if connected else "degraded",
        "service": "smartsheets",
        "configured": configured,
        "connected": connected
    }
