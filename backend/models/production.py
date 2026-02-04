"""
NextGen Fiber AI Agent - Production Report Models
Pydantic models with strict validation for production data
"""

from pydantic import BaseModel, Field, validator, root_validator
from typing import Optional, List, List
from datetime import date
from enum import Enum
import re


class ServiceType(str, Enum):
    """Types of fiber construction services"""
    FIBER_STRAND = "fiber_strand"
    OVERLASH = "overlash"
    UNDERGROUND = "underground"
    AERIAL = "aerial"


class Customer(str, Enum):
    """Known customers"""
    SPECTRUM = "Spectrum"
    BRIGHT_SPEED = "Bright Speed"
    ALL_POINTS = "All Points"
    MASTERQUE = "Masterque"
    OTHER = "Other"


class PoleEntry(BaseModel):
    """
    Single pole/span entry from production report

    Business Rules:
    - pole_ids with format "XXXXX.XXXXX" indicates splice point with coil
    - snowshoe should be marked every 1000-1500 feet
    """

    span_feet: int = Field(..., ge=0, description="Span length in feet")
    anchor: bool = Field(default=False, description="Is this an anchor point")

    # Pole IDs - can be single or double (splice point)
    pole_id_raw: str = Field(..., description="Raw pole ID from PDF (e.g., '30054' or '24154.24235')")
    pole_ids: List[str] = Field(default_factory=list, description="Parsed pole IDs")

    # Splice point detection
    is_splice_point: bool = Field(default=False, description="True if coil left at splice")

    # Checkboxes
    coil: bool = Field(default=False, description="Coil checkbox marked")
    snowshoe: bool = Field(default=False, description="Snowshoe (emergency reserve) marked")

    # Notes
    notes: Optional[str] = Field(default=None, description="Any notes (e.g., 'deixamos uma figura 8')")

    # Calculated
    cumulative_feet: int = Field(default=0, description="Cumulative feet up to this point")

    @validator('pole_id_raw')
    def parse_pole_id(cls, v: str) -> str:
        """Clean and validate pole ID format"""
        # Remove extra whitespace
        v = v.strip()
        return v

    @root_validator
    def detect_splice_and_parse_ids(cls, values):
        """
        Parse pole_id_raw into pole_ids list and detect splice points

        Format: "XXXXX" = single pole
        Format: "XXXXX.XXXXX" = splice point (coil between two poles)
        Format: "XXXXX.nota aqui" = pole with note
        """
        raw = values.get('pole_id_raw', '')
        pole_ids = values.get('pole_ids', [])
        notes = values.get('notes')
        is_splice_point = values.get('is_splice_point', False)

        # Pattern: two 5-digit numbers separated by dot = splice point
        splice_pattern = r'^(\d{4,6})\.(\d{4,6})$'
        splice_match = re.match(splice_pattern, raw)

        if splice_match:
            # This is a splice point
            values['pole_ids'] = [splice_match.group(1), splice_match.group(2)]
            values['is_splice_point'] = True
        else:
            # Check for note pattern: "XXXXX.some note here"
            note_pattern = r'^(\d{4,6})\.(.+)$'
            note_match = re.match(note_pattern, raw, re.IGNORECASE)

            if note_match:
                values['pole_ids'] = [note_match.group(1)]
                if not notes:
                    values['notes'] = note_match.group(2).strip()
            else:
                # Simple pole ID
                id_match = re.match(r'^(\d{4,6})$', raw)
                if id_match:
                    values['pole_ids'] = [id_match.group(1)]
                else:
                    # Fallback - use raw value
                    values['pole_ids'] = [raw]

        return values


class ProductionReportHeader(BaseModel):
    """Header section of production report (Produção Diária)"""

    lineman_name: str = Field(..., min_length=1, description="Lineman name(s)")
    start_date: date = Field(..., description="Data de Inicio")
    end_date: date = Field(..., description="Data de Termino")
    city: str = Field(..., description="Cidade/Location")
    project_name: str = Field(..., description="Nome do Projeto")
    fiber_count: int = Field(..., ge=1, description="Fiber count (e.g., 48, 72)")
    run_id: str = Field(..., description="Corrida identificação (e.g., BSPD01.05)")
    declared_total_feet: int = Field(..., ge=0, description="Total pés de span (declared)")
    service_type: str = Field(..., description="Serviço (Fiber Stran, Overlash, etc)")

    # Optional metadata
    customer: Optional[str] = Field(default=None)
    olt_cabinet: Optional[str] = Field(default=None)
    feeder_id: Optional[str] = Field(default=None)

    @validator('lineman_name')
    def normalize_lineman_name(cls, v: str) -> str:
        """Normalize lineman name format"""
        return v.strip().title()

    @validator('run_id')
    def normalize_run_id(cls, v: str) -> str:
        """Normalize run ID to uppercase"""
        return v.strip().upper()


class ProductionReport(BaseModel):
    """
    Complete production report with header and pole entries

    This is the main data structure extracted from PDF
    """

    # Identification
    id: str = Field(..., description="Unique report ID")
    source_file: str = Field(..., description="Original PDF filename")

    # Header data
    header: ProductionReportHeader

    # Pole entries (table rows)
    entries: List[PoleEntry] = Field(default_factory=list)

    # Calculated totals
    calculated_total_feet: int = Field(default=0, description="Sum of all span_feet")
    total_anchors: int = Field(default=0)
    total_coils: int = Field(default=0)
    total_snowshoes: int = Field(default=0)
    total_splice_points: int = Field(default=0)

    # Extraction metadata
    extraction_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    extraction_timestamp: str = Field(default="")
    extracted_by: str = Field(default="ai_agent")

    @root_validator
    def calculate_totals(cls, values):
        """Calculate derived totals from entries"""
        entries = values.get('entries', [])
        cumulative = 0
        for entry in entries:
            cumulative += entry.span_feet
            entry.cumulative_feet = cumulative

        values['calculated_total_feet'] = cumulative
        values['total_anchors'] = sum(1 for e in entries if e.anchor)
        values['total_coils'] = sum(1 for e in entries if e.coil)
        values['total_snowshoes'] = sum(1 for e in entries if e.snowshoe)
        values['total_splice_points'] = sum(1 for e in entries if e.is_splice_point)

        return values


class ValidationError(BaseModel):
    """Critical validation error that must be resolved"""

    code: str = Field(..., description="Error code (e.g., 'TOTAL_MISMATCH')")
    message: str = Field(..., description="Human-readable error message")
    field: Optional[str] = Field(default=None, description="Field that caused the error")
    expected: Optional[str] = Field(default=None)
    actual: Optional[str] = Field(default=None)
    entry_index: Optional[int] = Field(default=None, description="Index of problematic entry")


class ValidationWarning(BaseModel):
    """Non-critical warning that should be reviewed"""

    code: str = Field(..., description="Warning code")
    message: str = Field(..., description="Human-readable warning message")
    field: Optional[str] = Field(default=None)
    suggestion: Optional[str] = Field(default=None)
    entry_index: Optional[int] = Field(default=None)


class ValidationResult(BaseModel):
    """Result of validating a production report"""

    report_id: str
    is_valid: bool = Field(default=False, description="True if no critical errors")
    errors: List[ValidationError] = Field(default_factory=list)
    warnings: List[ValidationWarning] = Field(default_factory=list)

    # Metrics
    total_discrepancy_feet: int = Field(default=0, description="Difference between declared and calculated")
    discrepancy_percentage: float = Field(default=0.0)

    # QC Status
    qc_status: str = Field(default="PENDING", description="PENDING|PASSED|FAILED|NEEDS_REVIEW")

    @root_validator
    def determine_status(cls, values):
        """Determine QC status based on errors/warnings"""
        errors = values.get('errors', [])
        warnings = values.get('warnings', [])

        if errors:
            values['is_valid'] = False
            values['qc_status'] = "FAILED"
        elif warnings:
            values['is_valid'] = True
            values['qc_status'] = "NEEDS_REVIEW"
        else:
            values['is_valid'] = True
            values['qc_status'] = "PASSED"

        return values
