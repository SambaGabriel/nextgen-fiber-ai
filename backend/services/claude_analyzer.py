"""
Claude-powered Fiber Map Analyzer
High-precision OSP map extraction using Anthropic Claude API
"""

import anthropic
import base64
import json
import time
import io
import tempfile
import os
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from enum import Enum

# PDF to image conversion using PyMuPDF (no external dependencies like poppler)
try:
    import fitz  # PyMuPDF
    PDF_SUPPORT = True
except ImportError:
    PDF_SUPPORT = False
    print("Warning: PyMuPDF not available, PDF support disabled")

from PIL import Image


# ============================================
# TYPES
# ============================================

class CableType(str, Enum):
    MULTI_TIER = "MULTI_TIER"
    TAIL = "TAIL"
    DROP = "DROP"
    FEEDER = "FEEDER"
    DISTRIBUTION = "DISTRIBUTION"


class EquipmentType(str, Enum):
    HUB = "HUB"
    SPLICE = "SPLICE"
    SLACKLOOP = "SLACKLOOP"
    PEDESTAL = "PEDESTAL"
    HANDHOLE = "HANDHOLE"
    CABINET = "CABINET"
    SPLITTER = "SPLITTER"
    RISER = "RISER"
    MST = "MST"
    ANCHOR = "ANCHOR"


class ProjectHeader(BaseModel):
    project_id: str = ""
    location: str = ""
    fsa: str = ""
    page_number: int = 0
    total_pages: int = 0
    permits: List[str] = []
    contractor: str = "All Points Broadband"
    confidence: int = 0


class CableSegment(BaseModel):
    id: str
    cable_type: str = "MULTI_TIER"
    fiber_count: int = 0
    category: str = "AERIAL"
    confidence: int = 50


class SpanMeasurement(BaseModel):
    length_ft: int
    start_pole: str = ""
    end_pole: str = ""
    grid_ref: str = ""
    is_long_span: bool = False
    confidence: int = 50


class EquipmentItem(BaseModel):
    id: str
    type: str
    sub_type: str = ""
    size: str = ""
    slack_length: Optional[int] = None
    dimensions: str = ""
    gps_lat: Optional[float] = None
    gps_lng: Optional[float] = None
    confidence: int = 50


class GPSPoint(BaseModel):
    lat: float
    lng: float
    label: str = ""
    confidence: int = 50


class PoleInfo(BaseModel):
    pole_id: str
    attachment_height: str = ""
    has_anchor: bool = False
    grid_ref: str = ""
    confidence: int = 50


class CalculatedTotals(BaseModel):
    total_aerial_ft: int = 0
    total_underground_ft: int = 0
    total_cable_ft: int = 0
    span_count: int = 0
    anchor_count: int = 0
    splice_count: int = 0
    hub_count: int = 0
    slackloop_count: int = 0
    pedestal_count: int = 0
    pole_count: int = 0


class ValidationCheck(BaseModel):
    name: str
    passed: bool
    message: str
    expected: Optional[str] = None
    actual: Optional[str] = None


class ValidationReport(BaseModel):
    is_valid: bool = True
    overall_confidence: int = 0
    checks: List[ValidationCheck] = []
    warnings: List[str] = []
    errors: List[str] = []


class AnalysisMetadata(BaseModel):
    analyzed_at: str
    engine_version: str = "2.0.0-claude"
    model_used: str = "claude-sonnet-4-20250514"
    processing_time_ms: int = 0
    page_count: int = 1


class FiberMapAnalysisResult(BaseModel):
    header: ProjectHeader
    cables: List[CableSegment] = []
    spans: List[SpanMeasurement] = []
    equipment: List[EquipmentItem] = []
    gps_points: List[GPSPoint] = []
    poles: List[PoleInfo] = []
    totals: CalculatedTotals
    validation: ValidationReport
    metadata: AnalysisMetadata


# ============================================
# ANALYZER
# ============================================

SYSTEM_PROMPT = """You are an expert OSP (Outside Plant) Engineering Analyst specializing in fiber optic construction drawings.
Your task is to extract PRECISE, ACCURATE data from technical fiber construction maps.

## CRITICAL RULES:

1. **ACCURACY OVER SPEED**: Read every label carefully. Do not guess or hallucinate.

2. **LEGEND FIRST**: Identify the map legend (APB LEGEND) to understand symbols:
   - Aerial lines (dashed)
   - Underground lines (solid with U marker)
   - Equipment symbols (HUB, SPLICE, SLACKLOOP, PEDESTAL, etc.)

3. **CABLE NOMENCLATURE**: Parse cable IDs precisely:
   - Format: LOUD04-[TYPE]_CABLE_[NUMBER]
   - Types: MULTI_TIER, TAIL, DROP
   - Extract fiber count from "Cable Size: XX" labels

4. **SPAN MEASUREMENTS**: Extract ALL span measurements in feet:
   - Look for "XXXft" labels on cable runs
   - Flag long spans (>300ft)

5. **POLE IDs**: Capture utility pole identifiers:
   - Format: B1929XXXXXX or similar

6. **GPS COORDINATES**: Extract from pedestals:
   - Format: XX.XXXXX, -XX.XXXXX

7. **EQUIPMENT**: Identify all equipment:
   - HUBs: LOUD04-T1_HUB_XXXX
   - Splices: LOUD04-T2_SPLICE_XXXX, LOUD04-MG_SPLICE_XXXX
   - SLACKLOOPs: Note size (288-C, 48-C, 24-C) and slack length

8. **HEADER INFO**: Extract from title block:
   - Project ID (VALOUD0409)
   - Location (LOUDOUN COUNTY)
   - FSA code (VA-LOUD-04)
   - Page number
   - Permit numbers

9. **CONFIDENCE SCORING**: Rate confidence (0-100) for each item:
   - 100: Clearly visible
   - 80-99: Mostly clear
   - 60-79: Partially visible
   - <60: Low confidence

10. **NO HALLUCINATIONS**: If you cannot read a value clearly, mark confidence as low. Do NOT invent data.

Return your response as valid JSON matching the requested schema."""


def convert_pdf_to_images(pdf_base64: str, max_pages: int = 10) -> List[str]:
    """
    Convert a PDF to a list of base64-encoded PNG images using PyMuPDF.
    No external dependencies like poppler required.
    """
    if not PDF_SUPPORT:
        raise ValueError("PDF support not available. Install PyMuPDF: pip install pymupdf")

    # Decode base64 PDF
    pdf_bytes = base64.b64decode(pdf_base64)

    # Open PDF with PyMuPDF
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    # Limit pages
    page_count = min(len(doc), max_pages)

    # Convert each page to image
    base64_images = []
    for page_num in range(page_count):
        page = doc[page_num]

        # Render at 150 DPI (zoom factor = 150/72 ≈ 2.08)
        zoom = 2.0
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat, alpha=False)

        # Convert to PIL Image for resizing if needed
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

        # Resize if too large (Claude has limits)
        max_dimension = 2048
        if img.width > max_dimension or img.height > max_dimension:
            ratio = min(max_dimension / img.width, max_dimension / img.height)
            new_size = (int(img.width * ratio), int(img.height * ratio))
            img = img.resize(new_size, Image.Resampling.LANCZOS)

        # Convert to base64
        buffer = io.BytesIO()
        img.save(buffer, format="PNG", optimize=True)
        base64_images.append(base64.b64encode(buffer.getvalue()).decode('utf-8'))

    doc.close()
    return base64_images


def analyze_fiber_map(
    image_base64: str,
    media_type: str = "application/pdf",
    api_key: Optional[str] = None,
    max_pages: int = 10
) -> FiberMapAnalysisResult:
    """
    Analyze a fiber construction map using Claude's vision capabilities.
    Supports both images (PNG/JPG) and PDFs (converted to images).
    """
    start_time = time.time()

    if not api_key:
        raise ValueError("Anthropic API key is required")

    client = anthropic.Anthropic(api_key=api_key)

    # Clean base64 if it has data URL prefix
    if "base64," in image_base64:
        image_base64 = image_base64.split("base64,")[1]

    # Handle PDF conversion
    if media_type == "application/pdf":
        print(f"[ClaudeAnalyzer] Converting PDF to images (max {max_pages} pages)...")
        page_images = convert_pdf_to_images(image_base64, max_pages)
        print(f"[ClaudeAnalyzer] Converted {len(page_images)} pages")
    else:
        # Single image
        page_images = [image_base64]

    extraction_prompt = """Analyze this fiber construction map page and extract ALL data with HIGH PRECISION.

Extract and return as JSON:

1. **header**: Project info from title block (if visible)
   - project_id, location, fsa, page_number, total_pages, permits[], contractor, confidence

2. **cables**: All cable segments visible on this page
   - id (e.g., "LOUD04-MULTI_TIER_CABLE_024")
   - cable_type ("MULTI_TIER", "TAIL", "DROP")
   - fiber_count (number from "Cable Size: XX")
   - category ("AERIAL" or "UNDERGROUND")
   - confidence (0-100)

3. **spans**: All span measurements (XXXft labels)
   - length_ft (integer)
   - start_pole (pole ID if visible)
   - end_pole (pole ID if visible)
   - grid_ref (e.g., "GD 22")
   - is_long_span (true if > 300ft)
   - confidence (0-100)

4. **equipment**: All equipment items
   - id (e.g., "LOUD04-T1_HUB_0354")
   - type ("HUB", "SPLICE", "SLACKLOOP", "PEDESTAL", "ANCHOR", etc.)
   - sub_type (e.g., "T2_SPLICE", "MG_SPLICE")
   - size (for slackloops: "288-C", "48-C", etc.)
   - slack_length (e.g., 100 for "Slack: 100'")
   - dimensions (for pedestals: "15.75x14.75x47")
   - gps_lat, gps_lng (if coordinates shown)
   - confidence (0-100)

5. **gps_points**: All GPS coordinates found
   - lat, lng, label, confidence

6. **poles**: All pole IDs (format B1929XXXXXX)
   - pole_id, attachment_height, has_anchor, grid_ref, confidence

Return ONLY valid JSON, no markdown code blocks."""

    try:
        # Process all pages
        all_results = []

        for page_num, page_image in enumerate(page_images, 1):
            print(f"[ClaudeAnalyzer] Processing page {page_num}/{len(page_images)}...")

            message = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=8192,
                system=SYSTEM_PROMPT,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": page_image,
                                },
                            },
                            {
                                "type": "text",
                                "text": f"Page {page_num} of {len(page_images)}.\n\n{extraction_prompt}"
                            }
                        ],
                    }
                ],
            )

            # Parse response
            response_text = message.content[0].text

            # Try to extract JSON from response
            try:
                # Remove markdown code blocks if present
                if "```json" in response_text:
                    response_text = response_text.split("```json")[1].split("```")[0]
                elif "```" in response_text:
                    response_text = response_text.split("```")[1].split("```")[0]

                page_result = json.loads(response_text)
                page_result["_page_number"] = page_num
                all_results.append(page_result)
            except json.JSONDecodeError:
                # Try to find JSON in the response
                import re
                json_match = re.search(r'\{[\s\S]*\}', response_text)
                if json_match:
                    page_result = json.loads(json_match.group())
                    page_result["_page_number"] = page_num
                    all_results.append(page_result)
                else:
                    print(f"[ClaudeAnalyzer] Warning: Could not parse page {page_num}")
                    continue

        # Consolidate results from all pages
        print(f"[ClaudeAnalyzer] Consolidating results from {len(all_results)} pages...")
        consolidated = consolidate_page_results(all_results)

        # Build final result
        processing_time = int((time.time() - start_time) * 1000)
        result = post_process_results(consolidated, processing_time)
        result.metadata.page_count = len(page_images)

        return result

    except anthropic.APIError as e:
        import traceback
        print(f"Anthropic API error: {str(e)}")
        traceback.print_exc()
        raise ValueError(f"Anthropic API error: {str(e)}")
    except Exception as e:
        import traceback
        print(f"Analysis failed: {str(e)}")
        traceback.print_exc()
        raise ValueError(f"Analysis failed: {str(e)}")


def consolidate_page_results(page_results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Consolidate extraction results from multiple pages into a single result.
    """
    if not page_results:
        return {}

    # Use header from first page that has it
    header = {}
    for pr in page_results:
        if pr.get("header") and pr["header"].get("project_id"):
            header = pr["header"]
            break

    # Merge all arrays, using sets to avoid duplicates
    all_cables = {}
    all_spans = []
    all_equipment = {}
    all_gps_points = []
    all_poles = {}

    for pr in page_results:
        page_num = pr.get("_page_number", 0)

        # Cables (dedupe by ID)
        for cable in pr.get("cables", []):
            cable_id = cable.get("id", "")
            if cable_id and cable_id not in all_cables:
                all_cables[cable_id] = cable

        # Spans (keep all, add page reference)
        for span in pr.get("spans", []):
            span["_page"] = page_num
            all_spans.append(span)

        # Equipment (dedupe by ID)
        for eq in pr.get("equipment", []):
            eq_id = eq.get("id", "")
            if eq_id and eq_id not in all_equipment:
                all_equipment[eq_id] = eq

        # GPS points (keep all unique coordinates)
        for gps in pr.get("gps_points", []):
            # Check for duplicate coordinates
            is_dup = any(
                abs(g["lat"] - gps.get("lat", 0)) < 0.0001 and
                abs(g["lng"] - gps.get("lng", 0)) < 0.0001
                for g in all_gps_points
            )
            if not is_dup and gps.get("lat") and gps.get("lng"):
                all_gps_points.append(gps)

        # Poles (dedupe by ID)
        for pole in pr.get("poles", []):
            pole_id = pole.get("pole_id", "")
            if pole_id and pole_id not in all_poles:
                all_poles[pole_id] = pole

    return {
        "header": header,
        "cables": list(all_cables.values()),
        "spans": all_spans,
        "equipment": list(all_equipment.values()),
        "gps_points": all_gps_points,
        "poles": list(all_poles.values())
    }


def post_process_results(raw: Dict[str, Any], processing_time_ms: int) -> FiberMapAnalysisResult:
    """Post-process and validate extracted data."""

    # Parse header
    header_data = raw.get("header") or {}
    header = ProjectHeader(
        project_id=header_data.get("project_id") or "UNKNOWN",
        location=header_data.get("location") or "UNKNOWN",
        fsa=header_data.get("fsa") or "",
        page_number=header_data.get("page_number") or 0,
        total_pages=header_data.get("total_pages") or 0,
        permits=header_data.get("permits") or [],
        contractor=header_data.get("contractor") or "All Points Broadband",
        confidence=header_data.get("confidence") or 0
    )

    # Parse cables
    cables = []
    for c in raw.get("cables", []):
        cables.append(CableSegment(
            id=c.get("id") or f"CABLE_{len(cables)}",
            cable_type=c.get("cable_type") or "MULTI_TIER",
            fiber_count=c.get("fiber_count") or 0,
            category=c.get("category") or "AERIAL",
            confidence=c.get("confidence") or 50
        ))

    # Parse spans
    spans = []
    for s in raw.get("spans", []):
        length = s.get("length_ft") or 0
        spans.append(SpanMeasurement(
            length_ft=length,
            start_pole=s.get("start_pole") or "",
            end_pole=s.get("end_pole") or "",
            grid_ref=s.get("grid_ref") or "",
            is_long_span=length > 300,
            confidence=s.get("confidence") or 50
        ))

    # Parse equipment
    equipment = []
    for e in raw.get("equipment", []):
        equipment.append(EquipmentItem(
            id=e.get("id") or f"EQ_{len(equipment)}",
            type=e.get("type") or "HUB",
            sub_type=e.get("sub_type") or "",
            size=e.get("size") or "",
            slack_length=e.get("slack_length"),
            dimensions=e.get("dimensions") or "",
            gps_lat=e.get("gps_lat"),
            gps_lng=e.get("gps_lng"),
            confidence=e.get("confidence") or 50
        ))

    # Parse GPS points
    gps_points = []
    for g in raw.get("gps_points", []):
        if g.get("lat") and g.get("lng"):
            gps_points.append(GPSPoint(
                lat=g["lat"],
                lng=g["lng"],
                label=g.get("label") or "",
                confidence=g.get("confidence") or 50
            ))

    # Parse poles
    poles = []
    for p in raw.get("poles", []):
        if p.get("pole_id"):
            poles.append(PoleInfo(
                pole_id=p["pole_id"],
                attachment_height=p.get("attachment_height") or "",
                has_anchor=bool(p.get("has_anchor")),
                grid_ref=p.get("grid_ref") or "",
                confidence=p.get("confidence") or 50
            ))

    # Calculate totals
    totals = CalculatedTotals(
        total_cable_ft=sum(s.length_ft for s in spans),
        total_aerial_ft=sum(s.length_ft for s in spans),  # Simplified
        span_count=len(spans),
        pole_count=len(poles),
        anchor_count=sum(1 for p in poles if p.has_anchor) + sum(1 for e in equipment if e.type == "ANCHOR"),
        hub_count=sum(1 for e in equipment if e.type == "HUB"),
        splice_count=sum(1 for e in equipment if e.type == "SPLICE"),
        slackloop_count=sum(1 for e in equipment if e.type == "SLACKLOOP"),
        pedestal_count=sum(1 for e in equipment if e.type == "PEDESTAL")
    )

    # Run validation
    validation = run_validation(header, cables, spans, equipment, poles, gps_points, totals)

    # Build metadata
    metadata = AnalysisMetadata(
        analyzed_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        processing_time_ms=processing_time_ms
    )

    return FiberMapAnalysisResult(
        header=header,
        cables=cables,
        spans=spans,
        equipment=equipment,
        gps_points=gps_points,
        poles=poles,
        totals=totals,
        validation=validation,
        metadata=metadata
    )


def run_validation(
    header: ProjectHeader,
    cables: List[CableSegment],
    spans: List[SpanMeasurement],
    equipment: List[EquipmentItem],
    poles: List[PoleInfo],
    gps_points: List[GPSPoint],
    totals: CalculatedTotals
) -> ValidationReport:
    """Run validation checks on extracted data."""

    checks = []
    warnings = []
    errors = []

    # Check 1: Header completeness
    header_complete = bool(header.project_id and header.project_id != "UNKNOWN")
    checks.append(ValidationCheck(
        name="Header Completeness",
        passed=header_complete,
        message="Project ID extracted" if header_complete else "Missing project header info"
    ))

    # Check 2: Span count
    span_ok = 0 < totals.span_count < 500
    checks.append(ValidationCheck(
        name="Span Count",
        passed=span_ok,
        expected="1-500",
        actual=str(totals.span_count),
        message=f"{totals.span_count} spans extracted"
    ))

    # Check 3: Long spans warning
    long_spans = [s for s in spans if s.is_long_span]
    if long_spans:
        warnings.append(f"{len(long_spans)} spans exceed 300ft - verify accuracy")

    # Check 4: GPS validity
    valid_gps = [g for g in gps_points if abs(g.lat) <= 90 and abs(g.lng) <= 180]
    gps_valid = len(valid_gps) == len(gps_points)
    checks.append(ValidationCheck(
        name="GPS Validity",
        passed=gps_valid or len(gps_points) == 0,
        expected=str(len(gps_points)),
        actual=str(len(valid_gps)),
        message="All GPS coordinates valid" if gps_valid else "Some GPS coordinates invalid"
    ))

    # Check 5: Equipment IDs
    equipment_with_ids = [e for e in equipment if e.id and len(e.id) > 3]
    checks.append(ValidationCheck(
        name="Equipment IDs",
        passed=len(equipment_with_ids) > 0 or len(equipment) == 0,
        actual=str(len(equipment_with_ids)),
        message=f"{len(equipment_with_ids)} equipment items with valid IDs"
    ))

    # Calculate overall confidence
    all_confidences = (
        [c.confidence for c in cables] +
        [s.confidence for s in spans] +
        [e.confidence for e in equipment] +
        [p.confidence for p in poles]
    )
    overall_confidence = int(sum(all_confidences) / len(all_confidences)) if all_confidences else 0

    passed_checks = sum(1 for c in checks if c.passed)
    is_valid = passed_checks >= len(checks) * 0.7 and len(errors) == 0

    return ValidationReport(
        is_valid=is_valid,
        overall_confidence=overall_confidence,
        checks=checks,
        warnings=warnings,
        errors=errors
    )
