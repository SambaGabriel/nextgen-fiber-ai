"""
Map Analyzer API Endpoint
Uses Claude for high-precision fiber map analysis
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import os

from services.claude_analyzer import analyze_fiber_map, FiberMapAnalysisResult
from core.config import get_settings

router = APIRouter(prefix="/map-analyzer", tags=["Map Analyzer"])


class AnalyzeMapRequest(BaseModel):
    image_base64: str
    media_type: str = "image/png"
    api_key: Optional[str] = None
    max_pages: int = 10  # Maximum pages to process from PDF


class AnalyzeMapResponse(BaseModel):
    success: bool
    result: Optional[FiberMapAnalysisResult] = None
    error: Optional[str] = None


@router.post("/analyze", response_model=AnalyzeMapResponse)
async def analyze_map(request: AnalyzeMapRequest):
    """
    Analyze a fiber construction map using Claude AI.

    The image should be base64 encoded. Supports PNG, JPG, and PDF (as images).
    """
    import traceback

    try:
        # Get API key from request, settings, or environment
        settings = get_settings()
        api_key = request.api_key or settings.anthropic_api_key or os.getenv("ANTHROPIC_API_KEY")

        print(f"[MapAnalyzer] API key present: {bool(api_key)}")
        print(f"[MapAnalyzer] Image size: {len(request.image_base64)} chars")
        print(f"[MapAnalyzer] Media type: {request.media_type}")

        if not api_key:
            raise HTTPException(
                status_code=400,
                detail="Anthropic API key is required. Provide it in the request or set ANTHROPIC_API_KEY environment variable."
            )

        result = analyze_fiber_map(
            image_base64=request.image_base64,
            media_type=request.media_type,
            api_key=api_key,
            max_pages=request.max_pages
        )

        print(f"[MapAnalyzer] Analysis completed successfully")
        return AnalyzeMapResponse(success=True, result=result)

    except ValueError as e:
        print(f"[MapAnalyzer] ValueError: {str(e)}")
        traceback.print_exc()
        return AnalyzeMapResponse(success=False, error=str(e))
    except Exception as e:
        print(f"[MapAnalyzer] Exception: {type(e).__name__}: {str(e)}")
        traceback.print_exc()
        return AnalyzeMapResponse(success=False, error=f"Analysis failed: {type(e).__name__}: {str(e)}")


@router.get("/health")
async def health_check():
    """Check if the map analyzer service is running."""
    return {"status": "healthy", "engine": "claude-sonnet-4-20250514"}
