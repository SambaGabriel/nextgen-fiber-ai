"""
NextGen Fiber AI Agent - Invoice Models
Pydantic models for invoice generation and management
"""

from pydantic import BaseModel, Field
from typing import Optional, List, List
from datetime import date, datetime, timezone, timedelta
from enum import Enum
from decimal import Decimal, ROUND_HALF_UP
import uuid


class InvoiceStatus(str, Enum):
    """Invoice lifecycle status"""
    DRAFT = "draft"
    PENDING = "pending"
    SENT = "sent"
    APPROVED = "approved"
    PAID = "paid"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class PaymentTerms(str, Enum):
    """Standard payment terms"""
    NET_15 = "NET_15"
    NET_30 = "NET_30"
    NET_45 = "NET_45"
    NET_60 = "NET_60"
    DUE_ON_RECEIPT = "DUE_ON_RECEIPT"


class Customer(str, Enum):
    """Known customers"""
    SPECTRUM = "Spectrum"
    BRIGHT_SPEED = "Bright Speed"
    ALL_POINTS = "All Points"
    MASTERQUE = "Masterque"
    OTHER = "Other"


class UnitRates(BaseModel):
    """Unit rates for calculating invoice amounts"""
    fiber_per_foot: float = Field(default=0.35, description="$ per foot of fiber")
    strand_per_foot: float = Field(default=0.25, description="$ per foot of strand")
    overlash_per_foot: float = Field(default=0.30, description="$ per foot of overlash")
    anchor_each: float = Field(default=18.00, description="$ per anchor")
    coil_each: float = Field(default=25.00, description="$ per coil/splice")
    snowshoe_each: float = Field(default=15.00, description="$ per snowshoe")


class LineItem(BaseModel):
    """Single line item on an invoice"""
    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8].upper())
    description: str
    quantity: float = Field(ge=0)
    unit: str
    rate: float = Field(ge=0)
    amount: float = Field(default=0.0)
    category: Optional[str] = None
    reference: Optional[str] = None

    def calculate_amount(self) -> float:
        """Calculate and return line item amount"""
        self.amount = round(self.quantity * self.rate, 2)
        return self.amount


class CompanyInfo(BaseModel):
    """Company information for invoice headers"""
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    tax_id: Optional[str] = None
    logo_url: Optional[str] = None


class Invoice(BaseModel):
    """Complete invoice model"""

    # Identification
    id: str = Field(default_factory=lambda: f"INV-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}")
    invoice_number: str = Field(default="")

    # Status
    status: InvoiceStatus = Field(default=InvoiceStatus.DRAFT)

    # Dates
    issue_date: date = Field(default_factory=date.today)
    due_date: Optional[date] = None
    payment_terms: PaymentTerms = Field(default=PaymentTerms.NET_30)

    # Parties
    from_company: CompanyInfo
    to_customer: str
    customer_address: Optional[str] = None

    # Reference
    project_name: str = Field(default="")
    run_id: str = Field(default="")
    production_report_id: str = Field(default="")

    # Line items
    line_items: List[LineItem] = Field(default_factory=list)

    # Totals
    subtotal: float = Field(default=0.0)
    tax_rate: float = Field(default=0.0)
    tax_amount: float = Field(default=0.0)
    total: float = Field(default=0.0)

    # Notes
    notes: Optional[str] = None
    internal_notes: Optional[str] = None

    # Audit
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    created_by: str = Field(default="system")
    updated_at: Optional[str] = None

    def calculate_totals(self) -> None:
        """Calculate invoice totals from line items"""
        # Calculate each line item
        for item in self.line_items:
            item.calculate_amount()

        # Subtotal
        self.subtotal = round(sum(item.amount for item in self.line_items), 2)

        # Tax
        self.tax_amount = round(self.subtotal * self.tax_rate, 2)

        # Total
        self.total = round(self.subtotal + self.tax_amount, 2)

        # Generate invoice number if not set
        if not self.invoice_number:
            self.invoice_number = self.id.replace("INV-", "")

        # Calculate due date based on payment terms
        if not self.due_date:
            days_map = {
                PaymentTerms.NET_15: 15,
                PaymentTerms.NET_30: 30,
                PaymentTerms.NET_45: 45,
                PaymentTerms.NET_60: 60,
                PaymentTerms.DUE_ON_RECEIPT: 0
            }
            self.due_date = self.issue_date + timedelta(days=days_map.get(self.payment_terms, 30))

    def add_line_item(
        self,
        description: str,
        quantity: float,
        unit: str,
        rate: float,
        category: str = None,
        reference: str = None
    ) -> None:
        """Add a line item"""
        item = LineItem(
            description=description,
            quantity=quantity,
            unit=unit,
            rate=rate,
            category=category,
            reference=reference
        )
        item.calculate_amount()
        self.line_items.append(item)

    def to_dict_for_pdf(self) -> dict:
        """Convert to dictionary format for PDF rendering"""
        self.calculate_totals()
        return {
            "invoice_number": self.invoice_number,
            "status": self.status.value,
            "issue_date": self.issue_date.strftime("%B %d, %Y"),
            "due_date": self.due_date.strftime("%B %d, %Y") if self.due_date else "",
            "payment_terms": self.payment_terms.value.replace("_", " "),
            "from_company": self.from_company.dict(),
            "to_customer": self.to_customer,
            "customer_address": self.customer_address,
            "project_name": self.project_name,
            "run_id": self.run_id,
            "line_items": [
                {
                    "description": item.description,
                    "quantity": f"{item.quantity:,.2f}",
                    "unit": item.unit,
                    "rate": f"${item.rate:,.2f}",
                    "amount": f"${item.amount:,.2f}"
                }
                for item in self.line_items
            ],
            "subtotal": f"${self.subtotal:,.2f}",
            "tax_rate": f"{self.tax_rate * 100:.1f}%",
            "tax_amount": f"${self.tax_amount:,.2f}",
            "total": f"${self.total:,.2f}",
            "notes": self.notes
        }


class InvoiceSummary(BaseModel):
    """Lightweight invoice summary for listings"""
    id: str
    invoice_number: str
    status: InvoiceStatus
    customer: str
    project: str
    run_id: str
    issue_date: str
    due_date: str
    total: float
    created_at: str
