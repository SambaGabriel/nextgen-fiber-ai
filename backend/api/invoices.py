"""
NextGen Fiber AI Agent - Invoice API Endpoints
REST API for invoice generation and management
"""

from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date
import io

from models.invoice import (
    Invoice, InvoiceSummary, UnitRates,
    InvoiceStatus, PaymentTerms
)
from models.production import ProductionReport, ValidationResult
from services.invoice_generator import invoice_generator
from services.pdf_renderer import pdf_renderer
from core import get_logger

logger = get_logger("api.invoices")
router = APIRouter(prefix="/invoices", tags=["Invoices"])


# --- Request/Response Models ---

class QuickInvoiceRequest(BaseModel):
    """Request model for quick invoice generation"""
    customer_name: str = Field(..., min_length=1)
    project_name: str = Field(..., min_length=1)
    run_id: str = Field(..., min_length=1)
    total_feet: int = Field(..., ge=0)
    fiber_count: int = Field(..., ge=1)
    anchors: int = Field(default=0, ge=0)
    coils: int = Field(default=0, ge=0)
    snowshoes: int = Field(default=0, ge=0)
    service_type: str = Field(default="Fiber Strand")
    tax_rate: float = Field(default=0.0, ge=0.0, le=1.0)


class InvoiceFromReportRequest(BaseModel):
    """Request model for generating invoice from production report"""
    report_id: str
    customer_name: str
    customer_address: Optional[str] = None
    payment_terms: PaymentTerms = PaymentTerms.NET_30
    tax_rate: float = Field(default=0.0, ge=0.0, le=1.0)
    notes: Optional[str] = None


class UpdateStatusRequest(BaseModel):
    """Request model for updating invoice status"""
    status: InvoiceStatus


class InvoiceResponse(BaseModel):
    """Standard invoice response"""
    success: bool
    invoice: Optional[dict] = None
    message: Optional[str] = None


class InvoiceListResponse(BaseModel):
    """Response for invoice list"""
    success: bool
    invoices: List[InvoiceSummary]
    total: int


# --- Endpoints ---

@router.post("/quick", response_model=InvoiceResponse)
async def create_quick_invoice(request: QuickInvoiceRequest):
    """
    Generate a quick invoice without full production report

    Useful for manual entry or corrections
    """
    try:
        invoice = invoice_generator.generate_quick_invoice(
            customer_name=request.customer_name,
            project_name=request.project_name,
            run_id=request.run_id,
            total_feet=request.total_feet,
            fiber_count=request.fiber_count,
            anchors=request.anchors,
            coils=request.coils,
            snowshoes=request.snowshoes,
            service_type=request.service_type,
            tax_rate=request.tax_rate
        )

        logger.info("quick_invoice_created", invoice_id=invoice.id)

        return InvoiceResponse(
            success=True,
            invoice=invoice.dict(),
            message=f"Invoice {invoice.invoice_number} created successfully"
        )

    except Exception as e:
        logger.error("quick_invoice_failed", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=InvoiceListResponse)
async def list_invoices(
    status: Optional[InvoiceStatus] = Query(None, description="Filter by status"),
    customer: Optional[str] = Query(None, description="Filter by customer name"),
    limit: int = Query(50, ge=1, le=200, description="Max results to return")
):
    """List all invoices with optional filtering"""
    invoices = invoice_generator.list_invoices(
        status=status,
        customer=customer,
        limit=limit
    )

    return InvoiceListResponse(
        success=True,
        invoices=invoices,
        total=len(invoices)
    )


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(invoice_id: str):
    """Get a specific invoice by ID"""
    invoice = invoice_generator.get_invoice(invoice_id)

    if not invoice:
        raise HTTPException(status_code=404, detail=f"Invoice {invoice_id} not found")

    return InvoiceResponse(
        success=True,
        invoice=invoice.dict()
    )


@router.patch("/{invoice_id}/status", response_model=InvoiceResponse)
async def update_invoice_status(invoice_id: str, request: UpdateStatusRequest):
    """Update invoice status"""
    invoice = invoice_generator.update_status(invoice_id, request.status)

    if not invoice:
        raise HTTPException(status_code=404, detail=f"Invoice {invoice_id} not found")

    return InvoiceResponse(
        success=True,
        invoice=invoice.dict(),
        message=f"Invoice status updated to {request.status.value}"
    )


@router.get("/{invoice_id}/pdf")
async def download_invoice_pdf(invoice_id: str):
    """
    Download invoice as PDF

    Returns PDF file or JSON data for client-side rendering
    """
    invoice = invoice_generator.get_invoice(invoice_id)

    if not invoice:
        raise HTTPException(status_code=404, detail=f"Invoice {invoice_id} not found")

    # Try server-side PDF generation
    pdf_bytes = pdf_renderer.render_to_bytes(invoice)

    if pdf_bytes:
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=invoice_{invoice.invoice_number}.pdf"
            }
        )
    else:
        # Return JSON for client-side rendering
        return {
            "render_mode": "client",
            "data": pdf_renderer.get_render_data(invoice)
        }


@router.get("/{invoice_id}/render-data")
async def get_invoice_render_data(invoice_id: str):
    """
    Get invoice data formatted for client-side PDF rendering

    Use this with jsPDF on the frontend
    """
    invoice = invoice_generator.get_invoice(invoice_id)

    if not invoice:
        raise HTTPException(status_code=404, detail=f"Invoice {invoice_id} not found")

    return {
        "success": True,
        "data": pdf_renderer.get_render_data(invoice)
    }


@router.get("/rates/current")
async def get_current_rates():
    """Get current unit rates"""
    return {
        "success": True,
        "rates": invoice_generator.rates.dict()
    }


@router.put("/rates")
async def update_rates(rates: UnitRates):
    """Update unit rates for invoice calculations"""
    invoice_generator.update_rates(rates)
    return {
        "success": True,
        "message": "Rates updated successfully",
        "rates": rates.dict()
    }
