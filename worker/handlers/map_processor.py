"""
Map Processor Handler
Processes maps using Claude Vision API
"""

import time
from typing import Dict, Any, Optional
from datetime import datetime
import logging
import uuid
import httpx

from config import get_worker_settings
from circuit_breaker import get_circuit_breaker, CircuitBreakerError
from retry import retry, RetryExhausted

# Conditional imports
try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

try:
    import boto3
    from botocore.client import Config
    S3_AVAILABLE = True
except ImportError:
    S3_AVAILABLE = False

try:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    DB_AVAILABLE = True
except ImportError:
    DB_AVAILABLE = False

logger = logging.getLogger(__name__)
settings = get_worker_settings()

# Claude API circuit breaker
claude_breaker = get_circuit_breaker(
    "claude_api",
    failure_threshold=settings.circuit_breaker_failures,
    recovery_timeout=settings.circuit_breaker_recovery_seconds,
)


def _get_db_session():
    """Get database session for worker."""
    if not DB_AVAILABLE:
        raise RuntimeError("SQLAlchemy not installed")

    engine = create_engine(settings.database_url)
    Session = sessionmaker(bind=engine)
    return Session()


def _get_s3_client():
    """Get S3/MinIO client."""
    if not S3_AVAILABLE:
        raise RuntimeError("boto3 not installed")

    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name=settings.s3_region,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


def _download_from_s3(storage_key: str) -> bytes:
    """Download file from S3/MinIO."""
    client = _get_s3_client()
    response = client.get_object(Bucket=settings.s3_bucket, Key=storage_key)
    return response["Body"].read()


@retry(max_attempts=3, base_delay=2.0, exceptions=(anthropic.APIError,) if ANTHROPIC_AVAILABLE else (Exception,))
def _call_claude_vision(image_base64: str, media_type: str = "image/png") -> Dict[str, Any]:
    """
    Call Claude Vision API with circuit breaker and retry.

    Args:
        image_base64: Base64-encoded image data
        media_type: Image MIME type

    Returns:
        Extracted data dictionary
    """
    if not ANTHROPIC_AVAILABLE:
        raise RuntimeError("anthropic package not installed")

    with claude_breaker:
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

        # System prompt for map extraction
        system_prompt = """You are an expert OSP (Outside Plant) Engineering Analyst specializing in fiber optic construction drawings.
Your task is to extract PRECISE, ACCURATE data from technical fiber construction maps.

CRITICAL RULES:
1. ACCURACY OVER SPEED: Read every label carefully. Do not guess or hallucinate.
2. Extract all spans with measurements in feet
3. Extract all equipment (HUB, SPLICE, SLACKLOOP, PEDESTAL, etc.)
4. Extract GPS coordinates when visible
5. Extract pole IDs
6. Rate confidence (0-100) for each item

Return your response as valid JSON."""

        extraction_prompt = """Analyze this fiber construction map and extract ALL data with HIGH PRECISION.

Extract and return as JSON:
1. header: {project_id, location, fsa, page_number, contractor, confidence}
2. cables: [{id, cable_type, fiber_count, category, confidence}]
3. spans: [{length_ft, start_pole, end_pole, grid_ref, is_long_span, confidence}]
4. equipment: [{id, type, sub_type, size, slack_length, dimensions, gps_lat, gps_lng, confidence}]
5. gps_points: [{lat, lng, label, confidence}]
6. poles: [{pole_id, attachment_height, has_anchor, grid_ref, confidence}]

Return ONLY valid JSON, no markdown code blocks."""

        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=8192,
            system=system_prompt,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_base64,
                            },
                        },
                        {
                            "type": "text",
                            "text": extraction_prompt,
                        },
                    ],
                }
            ],
        )

        # Parse response
        response_text = message.content[0].text

        # Extract JSON
        import json
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0]

        try:
            return json.loads(response_text)
        except json.JSONDecodeError:
            import re
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                return json.loads(json_match.group())
            raise ValueError("Failed to parse Claude response as JSON")


def _update_map_in_db(
    session,
    map_id: str,
    status: str,
    extraction_result: Optional[Dict[str, Any]] = None,
    error_message: Optional[str] = None,
    processing_time_ms: Optional[int] = None,
):
    """Update map record in database."""
    # Import model dynamically to avoid circular imports
    import sys
    sys.path.insert(0, '/Users/gabrielarevalo/teste-claude/backend')
    from models.db import Map, MapStatus, Span, Equipment, GPSPoint

    map_obj = session.query(Map).filter(Map.id == uuid.UUID(map_id)).first()
    if map_obj is None:
        raise ValueError(f"Map not found: {map_id}")

    map_obj.status = MapStatus(status)
    map_obj.processing_completed_at = datetime.utcnow().isoformat()
    map_obj.processing_time_ms = processing_time_ms
    map_obj.error_message = error_message

    if extraction_result:
        # Store raw extraction
        map_obj.raw_extraction = extraction_result

        # Extract header
        header = extraction_result.get("header", {})
        map_obj.project_id = header.get("project_id")
        map_obj.location = header.get("location")
        map_obj.fsa = header.get("fsa")
        map_obj.contractor = header.get("contractor")
        map_obj.overall_confidence = header.get("confidence", 0)

        # Calculate totals
        spans_data = extraction_result.get("spans", [])
        equipment_data = extraction_result.get("equipment", [])

        totals = {
            "total_cable_ft": sum(s.get("length_ft", 0) for s in spans_data),
            "total_aerial_ft": sum(s.get("length_ft", 0) for s in spans_data),
            "span_count": len(spans_data),
            "hub_count": sum(1 for e in equipment_data if e.get("type") == "HUB"),
            "splice_count": sum(1 for e in equipment_data if e.get("type") == "SPLICE"),
            "slackloop_count": sum(1 for e in equipment_data if e.get("type") == "SLACKLOOP"),
            "pedestal_count": sum(1 for e in equipment_data if e.get("type") == "PEDESTAL"),
            "anchor_count": sum(1 for e in equipment_data if e.get("type") == "ANCHOR"),
        }
        map_obj.totals = totals

        # Create span records
        for span_data in spans_data:
            span = Span(
                id=uuid.uuid4(),
                map_id=map_obj.id,
                length_ft=span_data.get("length_ft", 0),
                start_pole=span_data.get("start_pole"),
                end_pole=span_data.get("end_pole"),
                grid_ref=span_data.get("grid_ref"),
                is_long_span=span_data.get("is_long_span", False),
                confidence=span_data.get("confidence", 50),
            )
            session.add(span)

        # Create equipment records
        for eq_data in equipment_data:
            equipment = Equipment(
                id=uuid.uuid4(),
                map_id=map_obj.id,
                equipment_id=eq_data.get("id"),
                equipment_type=eq_data.get("type", "UNKNOWN"),
                sub_type=eq_data.get("sub_type"),
                size=eq_data.get("size"),
                slack_length=eq_data.get("slack_length"),
                dimensions=eq_data.get("dimensions"),
                lat=eq_data.get("gps_lat"),
                lng=eq_data.get("gps_lng"),
                confidence=eq_data.get("confidence", 50),
            )
            session.add(equipment)

        # Create GPS point records
        for gps_data in extraction_result.get("gps_points", []):
            gps_point = GPSPoint(
                id=uuid.uuid4(),
                map_id=map_obj.id,
                lat=gps_data.get("lat"),
                lng=gps_data.get("lng"),
                label=gps_data.get("label"),
                confidence=gps_data.get("confidence", 50),
            )
            session.add(gps_point)

    session.commit()


def _notify_callback(callback_url: str, map_id: str, status: str, data: Optional[Dict] = None):
    """Send callback notification to API."""
    if not callback_url:
        return

    try:
        payload = {
            "map_id": map_id,
            "status": status,
            "data": data or {},
            "timestamp": datetime.utcnow().isoformat(),
        }

        headers = {}
        if settings.api_callback_token:
            headers["Authorization"] = f"Bearer {settings.api_callback_token}"

        with httpx.Client(timeout=10.0) as client:
            response = client.post(callback_url, json=payload, headers=headers)
            response.raise_for_status()

        logger.info(f"Callback sent to {callback_url}")
    except Exception as e:
        logger.warning(f"Callback failed: {e}")


def handle_map_processing(job_data: Dict[str, Any]) -> None:
    """
    Handle map processing job.

    Args:
        job_data: Job payload with map_id, storage_key, etc.
    """
    map_id = job_data.get("map_id")
    storage_key = job_data.get("storage_key")
    callback_url = job_data.get("callback_url")

    if not map_id or not storage_key:
        raise ValueError("Missing map_id or storage_key")

    logger.info(f"Processing map {map_id} from {storage_key}")
    start_time = time.time()

    session = _get_db_session()
    try:
        # Update status to processing
        _update_map_in_db(session, map_id, "processing")

        # Download file from S3
        logger.info(f"Downloading file from S3: {storage_key}")
        file_data = _download_from_s3(storage_key)

        # Convert to base64
        import base64
        file_base64 = base64.b64encode(file_data).decode("utf-8")

        # Determine media type
        media_type = "application/pdf" if storage_key.endswith(".pdf") else "image/png"

        # For PDFs, convert to images first
        if media_type == "application/pdf":
            # Import PDF conversion
            import sys
            sys.path.insert(0, '/Users/gabrielarevalo/teste-claude/backend')
            from services.claude_analyzer import convert_pdf_to_images

            page_images = convert_pdf_to_images(file_base64, max_pages=10)
            logger.info(f"Converted PDF to {len(page_images)} images")

            # Process each page and consolidate
            all_results = []
            for page_num, page_image in enumerate(page_images, 1):
                logger.info(f"Processing page {page_num}/{len(page_images)}")
                try:
                    result = _call_claude_vision(page_image, "image/png")
                    result["_page_number"] = page_num
                    all_results.append(result)
                except CircuitBreakerError:
                    logger.error("Circuit breaker open, aborting processing")
                    raise
                except Exception as e:
                    logger.warning(f"Failed to process page {page_num}: {e}")
                    continue

            # Consolidate results
            from services.claude_analyzer import consolidate_page_results
            extraction_result = consolidate_page_results(all_results)

        else:
            # Single image
            extraction_result = _call_claude_vision(file_base64, media_type)

        processing_time = int((time.time() - start_time) * 1000)

        # Update database
        _update_map_in_db(
            session,
            map_id,
            "completed",
            extraction_result=extraction_result,
            processing_time_ms=processing_time,
        )

        logger.info(f"Map {map_id} processed successfully in {processing_time}ms")

        # Send callback
        _notify_callback(callback_url, map_id, "completed", {
            "processing_time_ms": processing_time,
            "span_count": len(extraction_result.get("spans", [])),
            "equipment_count": len(extraction_result.get("equipment", [])),
        })

    except CircuitBreakerError as e:
        logger.error(f"Map {map_id} failed due to circuit breaker: {e}")
        _update_map_in_db(
            session,
            map_id,
            "failed",
            error_message=f"Service temporarily unavailable: {e.message}",
        )
        _notify_callback(callback_url, map_id, "failed", {"error": str(e)})
        raise

    except Exception as e:
        logger.error(f"Map {map_id} processing failed: {e}")
        _update_map_in_db(
            session,
            map_id,
            "failed",
            error_message=str(e),
            processing_time_ms=int((time.time() - start_time) * 1000),
        )
        _notify_callback(callback_url, map_id, "failed", {"error": str(e)})
        raise

    finally:
        session.close()


def handle_map_reprocess(job_data: Dict[str, Any]) -> None:
    """
    Handle map reprocessing job.

    Same as processing but with additional logging.
    """
    map_id = job_data.get("map_id")
    reason = job_data.get("reason", "Manual reprocess")
    requested_by = job_data.get("requested_by_id")

    logger.info(f"Reprocessing map {map_id}. Reason: {reason}. Requested by: {requested_by}")

    # Use same processing logic
    handle_map_processing(job_data)
