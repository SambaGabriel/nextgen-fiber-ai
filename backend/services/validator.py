"""
NextGen Fiber AI Agent - Validation Engine
Business rules validation with zero tolerance for errors
"""

from typing import Optional
from models import (
    ProductionReport,
    ValidationResult,
    ValidationError,
    ValidationWarning
)
from core import get_settings, get_logger, audit_logger

logger = get_logger(__name__)
settings = get_settings()


class ValidationEngine:
    """
    Validate production reports against business rules

    Rules:
    1. Total declared vs calculated must match
    2. Splice points (numero.numero) must have coil marked
    3. Snowshoe every 1000-1500 feet
    4. Data integrity checks
    """

    def __init__(
        self,
        snowshoe_min_ft: int = None,
        snowshoe_max_ft: int = None,
        tolerance_percentage: float = 0.01  # 1% tolerance for totals
    ):
        self.snowshoe_min_ft = snowshoe_min_ft or settings.snowshoe_min_interval_ft
        self.snowshoe_max_ft = snowshoe_max_ft or settings.snowshoe_max_interval_ft
        self.tolerance_percentage = tolerance_percentage

    def validate(self, report: ProductionReport) -> ValidationResult:
        """
        Run all validations on a production report

        Args:
            report: ProductionReport to validate

        Returns:
            ValidationResult with errors and warnings
        """
        logger.info(
            "validation_started",
            report_id=report.id,
            declared_total=report.header.declared_total_feet,
            calculated_total=report.calculated_total_feet
        )

        errors: list[ValidationError] = []
        warnings: list[ValidationWarning] = []

        # Run all validation rules
        errors.extend(self._validate_totals(report))
        errors.extend(self._validate_splice_points(report))
        warnings.extend(self._validate_snowshoe_intervals(report))
        warnings.extend(self._validate_data_integrity(report))

        # Calculate discrepancy
        discrepancy = abs(report.header.declared_total_feet - report.calculated_total_feet)
        discrepancy_pct = (discrepancy / report.header.declared_total_feet * 100) if report.header.declared_total_feet > 0 else 0

        result = ValidationResult(
            report_id=report.id,
            errors=errors,
            warnings=warnings,
            total_discrepancy_feet=discrepancy,
            discrepancy_percentage=round(discrepancy_pct, 2)
        )

        # Log for audit
        audit_logger.log_validation(
            document_id=report.id,
            validation_passed=result.is_valid,
            errors=[e.message for e in errors],
            warnings=[w.message for w in warnings]
        )

        logger.info(
            "validation_completed",
            report_id=report.id,
            is_valid=result.is_valid,
            qc_status=result.qc_status,
            error_count=len(errors),
            warning_count=len(warnings),
            discrepancy_ft=discrepancy
        )

        return result

    def _validate_totals(self, report: ProductionReport) -> list[ValidationError]:
        """
        Rule: Declared total must match calculated total

        Zero tolerance by default, configurable tolerance for rounding
        """
        errors = []

        declared = report.header.declared_total_feet
        calculated = report.calculated_total_feet
        difference = abs(declared - calculated)

        # Allow small tolerance for rounding
        tolerance = int(declared * self.tolerance_percentage)

        if difference > tolerance:
            errors.append(ValidationError(
                code="TOTAL_MISMATCH",
                message=f"Total mismatch: declared {declared} ft, calculated {calculated} ft (difference: {difference} ft)",
                field="declared_total_feet",
                expected=str(declared),
                actual=str(calculated)
            ))

        return errors

    def _validate_splice_points(self, report: ProductionReport) -> list[ValidationError]:
        """
        Rule: Splice points (numero.numero format) MUST have coil marked

        This is a critical error - splice points always require coil
        """
        errors = []

        for i, entry in enumerate(report.entries):
            if entry.is_splice_point and not entry.coil:
                errors.append(ValidationError(
                    code="SPLICE_NO_COIL",
                    message=f"Splice point at {entry.pole_id_raw} has no coil marked",
                    field="coil",
                    expected="true",
                    actual="false",
                    entry_index=i
                ))

        return errors

    def _validate_snowshoe_intervals(self, report: ProductionReport) -> list[ValidationWarning]:
        """
        Rule: Snowshoe every 1000-1500 feet

        This is a warning - QC should review but not auto-reject
        """
        warnings = []

        last_snowshoe_at = 0  # Cumulative feet at last snowshoe

        for i, entry in enumerate(report.entries):
            if entry.snowshoe:
                # Check if too early
                feet_since_last = entry.cumulative_feet - last_snowshoe_at
                if feet_since_last < self.snowshoe_min_ft and last_snowshoe_at > 0:
                    warnings.append(ValidationWarning(
                        code="SNOWSHOE_TOO_EARLY",
                        message=f"Snowshoe at pole {entry.pole_id_raw} only {feet_since_last} ft from previous (min: {self.snowshoe_min_ft} ft)",
                        field="snowshoe",
                        entry_index=i,
                        suggestion="Verify if snowshoe placement is intentional"
                    ))
                last_snowshoe_at = entry.cumulative_feet
            else:
                # Check if overdue
                feet_since_last = entry.cumulative_feet - last_snowshoe_at
                if feet_since_last > self.snowshoe_max_ft:
                    warnings.append(ValidationWarning(
                        code="SNOWSHOE_OVERDUE",
                        message=f"No snowshoe for {feet_since_last} ft (at pole {entry.pole_id_raw}). Max interval: {self.snowshoe_max_ft} ft",
                        field="snowshoe",
                        entry_index=i,
                        suggestion=f"Consider adding snowshoe - last one was {feet_since_last} ft ago"
                    ))
                    # Reset to avoid cascading warnings
                    last_snowshoe_at = entry.cumulative_feet

        return warnings

    def _validate_data_integrity(self, report: ProductionReport) -> list[ValidationWarning]:
        """
        Additional data integrity checks
        """
        warnings = []

        # Check for empty entries
        empty_entries = sum(1 for e in report.entries if e.span_feet == 0)
        if empty_entries > 0:
            warnings.append(ValidationWarning(
                code="EMPTY_ENTRIES",
                message=f"{empty_entries} entries have 0 span feet",
                suggestion="Verify if these entries should be removed or corrected"
            ))

        # Check for unusually long spans (> 500 ft is rare)
        long_spans = [(i, e) for i, e in enumerate(report.entries) if e.span_feet > 500]
        for i, entry in long_spans:
            warnings.append(ValidationWarning(
                code="LONG_SPAN",
                message=f"Unusually long span: {entry.span_feet} ft at pole {entry.pole_id_raw}",
                field="span_feet",
                entry_index=i,
                suggestion="Verify measurement accuracy"
            ))

        # Check for duplicate pole IDs
        all_pole_ids = []
        for entry in report.entries:
            all_pole_ids.extend(entry.pole_ids)

        seen = set()
        duplicates = set()
        for pid in all_pole_ids:
            if pid in seen:
                duplicates.add(pid)
            seen.add(pid)

        if duplicates:
            warnings.append(ValidationWarning(
                code="DUPLICATE_POLE_IDS",
                message=f"Duplicate pole IDs found: {', '.join(duplicates)}",
                suggestion="Verify pole ID entries"
            ))

        # Check date consistency
        if report.header.start_date > report.header.end_date:
            warnings.append(ValidationWarning(
                code="DATE_ORDER",
                message="Start date is after end date",
                field="start_date",
                suggestion="Verify date entries"
            ))

        return warnings


class QCReviewer:
    """
    Quality Control review orchestrator

    Combines validation with human review workflow
    """

    def __init__(self, validator: ValidationEngine = None):
        self.validator = validator or ValidationEngine()

    def review(self, report: ProductionReport) -> dict:
        """
        Perform full QC review

        Returns:
            Review summary with validation results and recommendations
        """
        validation = self.validator.validate(report)

        # Generate review summary
        summary = {
            "report_id": report.id,
            "lineman": report.header.lineman_name,
            "project": report.header.project_name,
            "run_id": report.header.run_id,
            "date": report.header.start_date.isoformat(),
            "qc_status": validation.qc_status,
            "is_valid": validation.is_valid,
            "metrics": {
                "declared_total_ft": report.header.declared_total_feet,
                "calculated_total_ft": report.calculated_total_feet,
                "discrepancy_ft": validation.total_discrepancy_feet,
                "discrepancy_pct": validation.discrepancy_percentage,
                "entry_count": len(report.entries),
                "anchor_count": report.total_anchors,
                "coil_count": report.total_coils,
                "snowshoe_count": report.total_snowshoes,
                "splice_point_count": report.total_splice_points
            },
            "errors": [
                {
                    "code": e.code,
                    "message": e.message,
                    "entry_index": e.entry_index
                }
                for e in validation.errors
            ],
            "warnings": [
                {
                    "code": w.code,
                    "message": w.message,
                    "suggestion": w.suggestion,
                    "entry_index": w.entry_index
                }
                for w in validation.warnings
            ],
            "recommendations": self._generate_recommendations(validation)
        }

        return summary

    def _generate_recommendations(self, validation: ValidationResult) -> list[str]:
        """Generate actionable recommendations based on validation"""
        recommendations = []

        if validation.qc_status == "FAILED":
            recommendations.append("CRITICAL: Resolve all errors before approving this report")

        if validation.total_discrepancy_feet > 0:
            recommendations.append(f"Verify total footage - {validation.total_discrepancy_feet} ft discrepancy detected")

        error_codes = {e.code for e in validation.errors}
        warning_codes = {w.code for w in validation.warnings}

        if "SPLICE_NO_COIL" in error_codes:
            recommendations.append("Confirm coil placement at all splice points")

        if "SNOWSHOE_OVERDUE" in warning_codes:
            recommendations.append("Review snowshoe placement intervals")

        if "LONG_SPAN" in warning_codes:
            recommendations.append("Double-check unusually long span measurements")

        if not recommendations:
            recommendations.append("Report passed all validations - ready for approval")

        return recommendations
