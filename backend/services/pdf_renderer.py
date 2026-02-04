"""
NextGen Fiber AI Agent - PDF Invoice Renderer
Generates professional PDF invoices
"""

from typing import Optional, Dict, Any
from datetime import datetime
import io
import base64

from models.invoice import Invoice
from core import get_logger

logger = get_logger("pdf_renderer")


class PDFInvoiceRenderer:
    """
    Renders invoices to PDF format

    Uses ReportLab for PDF generation (server-side)
    For browser-side, returns data for jsPDF rendering
    """

    def __init__(self):
        self._check_reportlab()

    def _check_reportlab(self) -> bool:
        """Check if ReportLab is available"""
        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.pdfgen import canvas
            self._has_reportlab = True
        except ImportError:
            self._has_reportlab = False
            logger.warning("reportlab_not_installed", message="PDF generation will use JSON format for client-side rendering")
        return self._has_reportlab

    def render_to_bytes(self, invoice: Invoice) -> Optional[bytes]:
        """
        Render invoice to PDF bytes

        Returns None if ReportLab is not available
        """
        if not self._has_reportlab:
            return None

        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors
        from reportlab.lib.units import inch
        from reportlab.pdfgen import canvas
        from reportlab.platypus import Table, TableStyle

        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)
        width, height = letter

        # Company Header
        c.setFont("Helvetica-Bold", 20)
        c.drawString(0.75 * inch, height - 0.75 * inch, invoice.from_company.name)

        c.setFont("Helvetica", 10)
        y = height - 1.0 * inch
        if invoice.from_company.address:
            c.drawString(0.75 * inch, y, invoice.from_company.address)
            y -= 0.15 * inch
        if invoice.from_company.city:
            c.drawString(0.75 * inch, y, f"{invoice.from_company.city}, {invoice.from_company.state} {invoice.from_company.zip_code}")
            y -= 0.15 * inch
        if invoice.from_company.phone:
            c.drawString(0.75 * inch, y, f"Phone: {invoice.from_company.phone}")
            y -= 0.15 * inch
        if invoice.from_company.email:
            c.drawString(0.75 * inch, y, f"Email: {invoice.from_company.email}")

        # Invoice Title
        c.setFont("Helvetica-Bold", 28)
        c.setFillColor(colors.HexColor("#FF5500"))
        c.drawRightString(width - 0.75 * inch, height - 0.75 * inch, "INVOICE")

        # Invoice Details Box
        c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold", 10)
        details_x = width - 2.5 * inch
        details_y = height - 1.1 * inch

        c.drawString(details_x, details_y, f"Invoice #: {invoice.invoice_number}")
        details_y -= 0.18 * inch
        c.setFont("Helvetica", 10)
        c.drawString(details_x, details_y, f"Date: {invoice.issue_date.strftime('%B %d, %Y')}")
        details_y -= 0.18 * inch
        if invoice.due_date:
            c.drawString(details_x, details_y, f"Due: {invoice.due_date.strftime('%B %d, %Y')}")
            details_y -= 0.18 * inch
        c.drawString(details_x, details_y, f"Terms: {invoice.payment_terms.value.replace('_', ' ')}")

        # Bill To Section
        y = height - 2.2 * inch
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(colors.HexColor("#334155"))
        c.drawString(0.75 * inch, y, "BILL TO:")
        y -= 0.2 * inch

        c.setFillColor(colors.black)
        c.setFont("Helvetica", 10)
        c.drawString(0.75 * inch, y, invoice.to_customer)
        y -= 0.15 * inch
        if invoice.customer_address:
            c.drawString(0.75 * inch, y, invoice.customer_address)
            y -= 0.15 * inch

        # Project Info
        y -= 0.1 * inch
        c.setFont("Helvetica-Bold", 10)
        c.drawString(0.75 * inch, y, f"Project: {invoice.project_name}")
        y -= 0.15 * inch
        c.setFont("Helvetica", 10)
        c.drawString(0.75 * inch, y, f"Run ID: {invoice.run_id}")

        # Line Items Table
        y = height - 3.5 * inch

        # Table Header
        table_data = [["Description", "Qty", "Unit", "Rate", "Amount"]]

        # Add line items
        for item in invoice.line_items:
            table_data.append([
                item.description[:40] + "..." if len(item.description) > 40 else item.description,
                f"{item.quantity:,.2f}",
                item.unit,
                f"${item.rate:,.2f}",
                f"${item.amount:,.2f}"
            ])

        # Create table
        col_widths = [3.5 * inch, 0.8 * inch, 0.6 * inch, 0.9 * inch, 1.0 * inch]
        table = Table(table_data, colWidths=col_widths)

        # Style table
        table.setStyle(TableStyle([
            # Header
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0b1121")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('TOPPADDING', (0, 0), (-1, 0), 10),

            # Body
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
            ('TOPPADDING', (0, 1), (-1, -1), 8),

            # Alignment
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),

            # Grid
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),

            # Alternating rows
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ]))

        table.wrapOn(c, width, height)
        table.drawOn(c, 0.75 * inch, y - len(table_data) * 0.35 * inch)

        # Totals Section
        totals_y = y - len(table_data) * 0.35 * inch - 0.5 * inch
        totals_x = width - 2.5 * inch

        c.setFont("Helvetica", 10)
        c.drawString(totals_x, totals_y, "Subtotal:")
        c.drawRightString(width - 0.75 * inch, totals_y, f"${invoice.subtotal:,.2f}")
        totals_y -= 0.2 * inch

        if invoice.tax_rate > 0:
            c.drawString(totals_x, totals_y, f"Tax ({invoice.tax_rate * 100:.1f}%):")
            c.drawRightString(width - 0.75 * inch, totals_y, f"${invoice.tax_amount:,.2f}")
            totals_y -= 0.2 * inch

        # Total
        c.setFont("Helvetica-Bold", 12)
        c.setFillColor(colors.HexColor("#FF5500"))
        c.drawString(totals_x, totals_y, "TOTAL:")
        c.drawRightString(width - 0.75 * inch, totals_y, f"${invoice.total:,.2f}")

        # Notes
        if invoice.notes:
            c.setFillColor(colors.black)
            c.setFont("Helvetica-Bold", 9)
            notes_y = 1.5 * inch
            c.drawString(0.75 * inch, notes_y, "Notes:")
            c.setFont("Helvetica", 9)
            c.drawString(0.75 * inch, notes_y - 0.15 * inch, invoice.notes[:100])

        # Footer
        c.setFont("Helvetica", 8)
        c.setFillColor(colors.HexColor("#64748b"))
        c.drawCentredString(width / 2, 0.5 * inch, f"Generated by FieldSolutions.ai - {datetime.now().strftime('%Y-%m-%d %H:%M')}")

        c.save()
        buffer.seek(0)
        return buffer.read()

    def render_to_base64(self, invoice: Invoice) -> Optional[str]:
        """Render invoice to base64-encoded PDF"""
        pdf_bytes = self.render_to_bytes(invoice)
        if pdf_bytes:
            return base64.b64encode(pdf_bytes).decode('utf-8')
        return None

    def get_render_data(self, invoice: Invoice) -> Dict[str, Any]:
        """
        Get invoice data formatted for client-side PDF rendering

        This is used when ReportLab is not available or for
        browser-based PDF generation with jsPDF
        """
        return invoice.to_dict_for_pdf()


# Singleton instance
pdf_renderer = PDFInvoiceRenderer()
