"""
NextGen Fiber AI Agent - Production Reports API
REST endpoints for production report processing
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import base64

from services import ProductionReportParser, ValidationEngine, PDFExtractor
from services.validator import QCReviewer
from models import ProductionReport, ValidationResult
from core import get_logger, get_settings

logger = get_logger(__name__)
settings = get_settings()

router = APIRouter()


class ExtractRequest(BaseModel):
    """Request body for extraction from base64"""
    base64_data: str
    filename: str
    mime_type: str = "application/pdf"


class ExtractResponse(BaseModel):
    """Response from extraction"""
    success: bool
    report_id: Optional[str] = None
    report: Optional[dict] = None
    validation: Optional[dict] = None
    message: Optional[str] = None


@router.post("/extract", response_model=ExtractResponse)
async def extract_production_report(request: ExtractRequest):
    """
    Extract and validate a production report from PDF

    1. Extracts data from PDF using Vision AI
    2. Parses into structured ProductionReport
    3. Validates against business rules
    4. Returns report with validation results
    """
    logger.info(
        "extract_request_received",
        filename=request.filename,
        data_length=len(request.base64_data)
    )

    try:
        # Determine AI provider based on config
        if settings.anthropic_api_key:
            provider = "anthropic"
        elif settings.google_api_key:
            provider = "google"
        else:
            raise HTTPException(
                status_code=500,
                detail="No AI provider configured. Set ANTHROPIC_API_KEY or GOOGLE_API_KEY"
            )

        # Extract from PDF
        extractor = PDFExtractor(provider=provider)
        extracted_data = await extractor.extract_from_base64(
            base64_data=request.base64_data,
            filename=request.filename,
            mime_type=request.mime_type
        )

        # Parse into model
        parser = ProductionReportParser()
        report = parser.parse(extracted_data, request.filename)

        # Validate
        validator = ValidationEngine()
        validation = validator.validate(report)

        # Run QC review
        reviewer = QCReviewer(validator)
        review_summary = reviewer.review(report)

        return ExtractResponse(
            success=True,
            report_id=report.id,
            report=report.dict(),
            validation=review_summary
        )

    except ValueError as e:
        logger.error("extraction_error", error=str(e))
        return ExtractResponse(
            success=False,
            message=str(e)
        )
    except Exception as e:
        logger.error("unexpected_error", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload")
async def upload_production_report(file: UploadFile = File(...)):
    """
    Upload and process a production report PDF file

    Accepts multipart/form-data with PDF file
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are accepted"
        )

    logger.info("file_upload_received", filename=file.filename)

    try:
        # Read file content
        content = await file.read()
        base64_data = base64.b64encode(content).decode('utf-8')

        # Process using extract endpoint logic
        request = ExtractRequest(
            base64_data=base64_data,
            filename=file.filename,
            mime_type="application/pdf"
        )

        return await extract_production_report(request)

    except Exception as e:
        logger.error("upload_error", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/validate")
async def validate_report(report_data: dict):
    """
    Validate a production report that's already parsed

    Useful for re-validating after manual corrections
    """
    try:
        # Convert dict to ProductionReport
        report = ProductionReport(**report_data)

        # Validate
        validator = ValidationEngine()
        validation = validator.validate(report)

        # Run QC review
        reviewer = QCReviewer(validator)
        review_summary = reviewer.review(report)

        return {
            "success": True,
            "report_id": report.id,
            "validation": review_summary
        }

    except Exception as e:
        logger.error("validation_error", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/health")
async def health():
    """Health check for production service"""
    return {
        "status": "healthy",
        "service": "production-reports",
        "ai_providers": {
            "anthropic": bool(settings.anthropic_api_key),
            "google": bool(settings.google_api_key)
        }
    }
