"""
NextGen Fiber AI Agent - Production Report Parser
Converts extracted data into validated ProductionReport models
"""

from datetime import datetime, timezone
from typing import Optional
import uuid
import re

from models import (
    ProductionReport,
    ProductionReportHeader,
    PoleEntry
)
from core import get_logger

logger = get_logger(__name__)


class ProductionReportParser:
    """
    Parse extracted PDF data into ProductionReport models

    Handles data normalization and initial structure validation
    """

    def parse(
        self,
        extracted_data: dict,
        source_file: str
    ) -> ProductionReport:
        """
        Parse extracted data into ProductionReport model

        Args:
            extracted_data: Raw extracted data from PDFExtractor
            source_file: Original filename

        Returns:
            ProductionReport model with all fields populated
        """
        report_id = f"PR-{uuid.uuid4().hex[:12].upper()}"

        logger.info(
            "parsing_started",
            report_id=report_id,
            source_file=source_file,
            row_count=extracted_data.get("row_count", 0)
        )

        # Parse header
        header = self._parse_header(extracted_data.get("header", {}))

        # Parse entries
        entries = self._parse_entries(extracted_data.get("entries", []))

        # Get extraction metadata
        metadata = extracted_data.get("_extraction_metadata", {})

        # Create report
        report = ProductionReport(
            id=report_id,
            source_file=source_file,
            header=header,
            entries=entries,
            extraction_confidence=self._calculate_confidence(extracted_data),
            extraction_timestamp=metadata.get("timestamp", datetime.now(timezone.utc).isoformat()),
            extracted_by=metadata.get("provider", "unknown")
        )

        logger.info(
            "parsing_completed",
            report_id=report_id,
            entries_count=len(entries),
            calculated_total=report.calculated_total_feet,
            declared_total=header.declared_total_feet
        )

        return report

    def _parse_header(self, header_data: dict) -> ProductionReportHeader:
        """Parse header section"""

        # Parse dates - handle multiple formats
        start_date = self._parse_date(header_data.get("start_date", ""))
        end_date = self._parse_date(header_data.get("end_date", ""))

        return ProductionReportHeader(
            lineman_name=header_data.get("lineman_name", "Unknown"),
            start_date=start_date,
            end_date=end_date,
            city=header_data.get("city", "Unknown"),
            project_name=header_data.get("project_name", "Unknown"),
            fiber_count=int(header_data.get("fiber_count", 0)),
            run_id=header_data.get("run_id", "UNKNOWN"),
            declared_total_feet=int(header_data.get("declared_total_feet", 0)),
            service_type=header_data.get("service_type", "Unknown"),
            customer=header_data.get("customer"),
            olt_cabinet=header_data.get("olt_cabinet"),
            feeder_id=header_data.get("feeder_id")
        )

    def _parse_entries(self, entries_data: list) -> list[PoleEntry]:
        """Parse table entries"""

        entries = []
        for i, entry in enumerate(entries_data):
            try:
                pole_entry = PoleEntry(
                    span_feet=int(entry.get("span_feet", 0)),
                    anchor=bool(entry.get("anchor", False)),
                    pole_id_raw=str(entry.get("pole_id_raw", "")),
                    coil=bool(entry.get("coil", False)),
                    snowshoe=bool(entry.get("snowshoe", False)),
                    notes=entry.get("notes")
                )
                entries.append(pole_entry)
            except Exception as e:
                logger.warning(
                    "entry_parse_error",
                    entry_index=i,
                    error=str(e),
                    raw_data=entry
                )

        return entries

    def _parse_date(self, date_str: str) -> datetime:
        """
        Parse date from various formats

        Supports:
        - MM.DD.YYYY (from PDF)
        - YYYY-MM-DD (ISO)
        - MM/DD/YYYY
        """
        if not date_str:
            return datetime.now().date()

        date_str = date_str.strip()

        # Try different formats
        formats = [
            "%m.%d.%Y",   # 08.19.2024
            "%Y-%m-%d",   # 2024-08-19
            "%m/%d/%Y",   # 08/19/2024
            "%d.%m.%Y",   # 19.08.2024 (European)
        ]

        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue

        # If all fail, try to extract numbers and make best guess
        numbers = re.findall(r'\d+', date_str)
        if len(numbers) >= 3:
            # Assume MM.DD.YYYY format
            month, day, year = int(numbers[0]), int(numbers[1]), int(numbers[2])
            if year < 100:
                year += 2000
            try:
                return datetime(year, month, day).date()
            except ValueError:
                pass

        logger.warning("date_parse_failed", date_str=date_str)
        return datetime.now().date()

    def _calculate_confidence(self, extracted_data: dict) -> float:
        """
        Calculate extraction confidence score

        Based on:
        - Completeness of header fields
        - Presence of entries
        - Absence of extraction notes/warnings
        """
        score = 1.0

        header = extracted_data.get("header", {})
        entries = extracted_data.get("entries", [])
        notes = extracted_data.get("extraction_notes", [])

        # Header completeness
        required_fields = [
            "lineman_name", "start_date", "end_date",
            "project_name", "fiber_count", "run_id",
            "declared_total_feet", "service_type"
        ]
        missing_fields = sum(1 for f in required_fields if not header.get(f))
        score -= (missing_fields * 0.05)

        # Entries presence
        if not entries:
            score -= 0.3
        elif len(entries) < 3:
            score -= 0.1

        # Extraction notes (warnings)
        score -= (len(notes) * 0.05)

        return max(0.0, min(1.0, score))
