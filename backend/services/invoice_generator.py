"""
NextGen Fiber AI Agent - Invoice Generator Service
Generates invoices from validated production reports
"""

from typing import Optional, List, Dict, Any
from datetime import date, datetime, timezone
import uuid

from models.production import ProductionReport, ValidationResult
from models.invoice import (
    Invoice, LineItem, UnitRates, CompanyInfo,
    InvoiceStatus, PaymentTerms, InvoiceSummary
)
from core import get_logger, audit_logger

logger = get_logger("invoice_generator")


# Default company info for NextGen
DEFAULT_COMPANY_INFO = CompanyInfo(
    name="NextGen Fiber Construction LLC",
    address="1234 Fiber Lane",
    city="Ashburn",
    state="VA",
    zip_code="20147",
    phone="(703) 555-0100",
    email="billing@nextgenfiber.com",
    tax_id="XX-XXXXXXX"
)

# Default unit rates (can be overridden)
DEFAULT_RATES = UnitRates(
    fiber_per_foot=0.35,
    strand_per_foot=0.25,
    overlash_per_foot=0.30,
    anchor_each=18.00,
    coil_each=25.00,
    snowshoe_each=15.00
)


class InvoiceGenerator:
    """
    Generates invoices from production reports

    Business Rules:
    - Only generates invoices for validated reports (QC passed or reviewed)
    - Calculates line items based on unit rates
    - Supports multiple service types
    - Tracks invoice history for audit
    """

    def __init__(
        self,
        company_info: Optional[CompanyInfo] = None,
        rates: Optional[UnitRates] = None
    ):
        self.company_info = company_info or DEFAULT_COMPANY_INFO
        self.rates = rates or DEFAULT_RATES
        self._invoices: Dict[str, Invoice] = {}

    def generate_from_production_report(
        self,
        report: ProductionReport,
        validation: ValidationResult,
        customer_name: str,
        customer_address: Optional[str] = None,
        payment_terms: PaymentTerms = PaymentTerms.NET_30,
        tax_rate: float = 0.0,
        notes: Optional[str] = None
    ) -> Invoice:
        """
        Generate an invoice from a validated production report

        Args:
            report: The production report with extracted data
            validation: Validation result (must be PASSED or NEEDS_REVIEW)
            customer_name: Customer/client name for billing
            customer_address: Optional billing address
            payment_terms: Payment terms (default NET_30)
            tax_rate: Tax rate as decimal (e.g., 0.06 for 6%)
            notes: Optional notes to include on invoice

        Returns:
            Generated Invoice object

        Raises:
            ValueError: If validation failed
        """
        # Check validation status
        if validation.qc_status == "FAILED":
            raise ValueError(
                f"Cannot generate invoice for failed validation. "
                f"Errors: {[e.message for e in validation.errors]}"
            )

        logger.info(
            "generating_invoice",
            report_id=report.id,
            customer=customer_name,
            qc_status=validation.qc_status
        )

        # Create invoice
        invoice = Invoice(
            from_company=self.company_info,
            to_customer=customer_name,
            customer_address=customer_address,
            project_name=report.header.project_name,
            run_id=report.header.run_id,
            production_report_id=report.id,
            payment_terms=payment_terms,
            tax_rate=tax_rate,
            notes=notes
        )

        # Generate line items based on service type and report data
        self._add_line_items_from_report(invoice, report)

        # Calculate totals
        invoice.calculate_totals()

        # Store invoice
        self._invoices[invoice.id] = invoice

        # Audit log
        audit_logger.log_invoice_generated(
            invoice_id=invoice.id,
            production_report_id=report.id,
            total_amount=invoice.total,
            line_items=len(invoice.line_items)
        )

        logger.info(
            "invoice_generated",
            invoice_id=invoice.id,
            total=invoice.total,
            line_items=len(invoice.line_items)
        )

        return invoice

    def _add_line_items_from_report(
        self,
        invoice: Invoice,
        report: ProductionReport
    ) -> None:
        """Add line items based on production report data"""

        header = report.header
        service_type = header.service_type.lower()

        # Determine rate based on service type
        if "overlash" in service_type:
            footage_rate = self.rates.overlash_per_foot
            footage_desc = "Overlash Installation"
        elif "strand" in service_type or "fiber" in service_type:
            footage_rate = self.rates.fiber_per_foot
            footage_desc = "Fiber/Strand Installation"
        else:
            footage_rate = self.rates.fiber_per_foot
            footage_desc = "Cable Installation"

        # 1. Main footage line item (use calculated total for accuracy)
        if report.calculated_total_feet > 0:
            invoice.add_line_item(
                description=f"{footage_desc} - {header.fiber_count}F Cable",
                quantity=float(report.calculated_total_feet),
                unit="FT",
                rate=footage_rate,
                category="LABOR",
                reference=f"Run: {header.run_id}"
            )

        # 2. Anchors
        if report.total_anchors > 0:
            invoice.add_line_item(
                description="Down Guy / Anchor Assembly Installation",
                quantity=float(report.total_anchors),
                unit="EA",
                rate=self.rates.anchor_each,
                category="MATERIALS",
                reference=f"Run: {header.run_id}"
            )

        # 3. Coils / Splice Points
        if report.total_coils > 0:
            invoice.add_line_item(
                description="Slack Loop / Coil Installation",
                quantity=float(report.total_coils),
                unit="EA",
                rate=self.rates.coil_each,
                category="LABOR",
                reference=f"Run: {header.run_id}"
            )

        # 4. Snowshoes (emergency reserve loops)
        if report.total_snowshoes > 0:
            invoice.add_line_item(
                description="Snowshoe (Emergency Reserve) Installation",
                quantity=float(report.total_snowshoes),
                unit="EA",
                rate=self.rates.snowshoe_each,
                category="LABOR",
                reference=f"Run: {header.run_id}"
            )

        # 5. Splice points (additional labor for mid-span splices)
        if report.total_splice_points > 0:
            invoice.add_line_item(
                description="Mid-Span Splice Point Setup",
                quantity=float(report.total_splice_points),
                unit="EA",
                rate=self.rates.coil_each * 1.5,  # 50% premium for splice work
                category="LABOR",
                reference=f"Run: {header.run_id}"
            )

    def generate_quick_invoice(
        self,
        customer_name: str,
        project_name: str,
        run_id: str,
        total_feet: int,
        fiber_count: int,
        anchors: int = 0,
        coils: int = 0,
        snowshoes: int = 0,
        service_type: str = "Fiber Strand",
        tax_rate: float = 0.0
    ) -> Invoice:
        """
        Generate a quick invoice without full production report

        Useful for manual entry or corrections
        """
        invoice = Invoice(
            from_company=self.company_info,
            to_customer=customer_name,
            project_name=project_name,
            run_id=run_id,
            tax_rate=tax_rate
        )

        # Determine rate
        if "overlash" in service_type.lower():
            rate = self.rates.overlash_per_foot
        else:
            rate = self.rates.fiber_per_foot

        # Add footage
        if total_feet > 0:
            invoice.add_line_item(
                description=f"{service_type} Installation - {fiber_count}F Cable",
                quantity=float(total_feet),
                unit="FT",
                rate=rate,
                category="LABOR"
            )

        # Add extras
        if anchors > 0:
            invoice.add_line_item(
                description="Anchor Assembly",
                quantity=float(anchors),
                unit="EA",
                rate=self.rates.anchor_each,
                category="MATERIALS"
            )

        if coils > 0:
            invoice.add_line_item(
                description="Slack Loop / Coil",
                quantity=float(coils),
                unit="EA",
                rate=self.rates.coil_each,
                category="LABOR"
            )

        if snowshoes > 0:
            invoice.add_line_item(
                description="Snowshoe Reserve",
                quantity=float(snowshoes),
                unit="EA",
                rate=self.rates.snowshoe_each,
                category="LABOR"
            )

        invoice.calculate_totals()
        self._invoices[invoice.id] = invoice

        return invoice

    def get_invoice(self, invoice_id: str) -> Optional[Invoice]:
        """Get an invoice by ID"""
        return self._invoices.get(invoice_id)

    def list_invoices(
        self,
        status: Optional[InvoiceStatus] = None,
        customer: Optional[str] = None,
        limit: int = 50
    ) -> List[InvoiceSummary]:
        """List invoices with optional filtering"""
        invoices = list(self._invoices.values())

        # Filter by status
        if status:
            invoices = [inv for inv in invoices if inv.status == status]

        # Filter by customer
        if customer:
            invoices = [
                inv for inv in invoices
                if customer.lower() in inv.to_customer.lower()
            ]

        # Sort by created date (newest first)
        invoices.sort(key=lambda x: x.created_at, reverse=True)

        # Limit results
        invoices = invoices[:limit]

        # Convert to summaries
        return [
            InvoiceSummary(
                id=inv.id,
                invoice_number=inv.invoice_number,
                status=inv.status,
                customer=inv.to_customer,
                project=inv.project_name,
                run_id=inv.run_id,
                issue_date=inv.issue_date.isoformat(),
                due_date=inv.due_date.isoformat() if inv.due_date else "",
                total=inv.total,
                created_at=inv.created_at
            )
            for inv in invoices
        ]

    def update_status(
        self,
        invoice_id: str,
        new_status: InvoiceStatus
    ) -> Optional[Invoice]:
        """Update invoice status"""
        invoice = self._invoices.get(invoice_id)
        if invoice:
            invoice.status = new_status
            invoice.updated_at = datetime.now(timezone.utc).isoformat()
            logger.info(
                "invoice_status_updated",
                invoice_id=invoice_id,
                new_status=new_status.value
            )
        return invoice

    def update_rates(self, rates: UnitRates) -> None:
        """Update the unit rates used for calculations"""
        self.rates = rates
        logger.info("unit_rates_updated", rates=rates.dict())


# Singleton instance
invoice_generator = InvoiceGenerator()
