"""
NextGen Fiber AI Agent - Structured Logging
Audit-grade logging with full traceability
"""

import structlog
import logging
import sys
from datetime import datetime, timezone
from typing import Any, Optional, Dict, List
from .config import get_settings


def setup_logging() -> None:
    """Configure structured logging for production"""
    settings = get_settings()

    # Configure structlog
    processors = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]

    if settings.log_format == "json":
        processors.append(structlog.processors.JSONRenderer())
    else:
        processors.append(structlog.dev.ConsoleRenderer(colors=True))

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, settings.log_level.upper())
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.BoundLogger:
    """Get a logger instance with context"""
    return structlog.get_logger(name)


class AuditLogger:
    """
    Specialized logger for audit trail
    All business-critical operations must be logged here
    """

    def __init__(self):
        self._logger = get_logger("audit")

    def log_extraction(
        self,
        document_id: str,
        document_name: str,
        extraction_result: Dict[str, Any],
        user_id: Optional[str] = None
    ) -> None:
        """Log document extraction event"""
        self._logger.info(
            "document_extraction",
            event_type="EXTRACTION",
            document_id=document_id,
            document_name=document_name,
            extracted_fields=list(extraction_result.keys()),
            user_id=user_id,
            timestamp=datetime.now(timezone.utc).isoformat()
        )

    def log_validation(
        self,
        document_id: str,
        validation_passed: bool,
        errors: List[str],
        warnings: List[str]
    ) -> None:
        """Log validation event"""
        self._logger.info(
            "validation_result",
            event_type="VALIDATION",
            document_id=document_id,
            passed=validation_passed,
            error_count=len(errors),
            warning_count=len(warnings),
            errors=errors,
            warnings=warnings,
            timestamp=datetime.now(timezone.utc).isoformat()
        )

    def log_integration(
        self,
        target_system: str,
        operation: str,
        record_id: str,
        success: bool,
        details: Optional[Dict[str, Any]] = None
    ) -> None:
        """Log external integration event"""
        self._logger.info(
            "integration_event",
            event_type="INTEGRATION",
            target_system=target_system,
            operation=operation,
            record_id=record_id,
            success=success,
            details=details or {},
            timestamp=datetime.now(timezone.utc).isoformat()
        )

    def log_invoice_generated(
        self,
        invoice_id: str,
        production_report_id: str,
        total_amount: float,
        line_items: int
    ) -> None:
        """Log invoice generation event"""
        self._logger.info(
            "invoice_generated",
            event_type="INVOICE",
            invoice_id=invoice_id,
            production_report_id=production_report_id,
            total_amount=total_amount,
            line_items=line_items,
            timestamp=datetime.now(timezone.utc).isoformat()
        )


# Singleton audit logger
audit_logger = AuditLogger()
