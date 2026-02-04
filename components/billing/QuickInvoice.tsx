/**
 * Quick Invoice Creator
 * Tesla/SpaceX/Nothing/B&O inspired premium design
 * Merged from InvoiceManager for Finance Hub
 */

import React, { useState, useEffect } from 'react';
import {
  FileText, DollarSign, Download, Plus, Check, Clock,
  AlertTriangle, X, Send, Receipt, Calculator, Zap
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  category?: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string;
  payment_terms: string;
  from_company: {
    name: string;
    address?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    phone?: string;
    email?: string;
  };
  to_customer: string;
  customer_address?: string;
  project_name: string;
  run_id: string;
  line_items: LineItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  notes?: string;
  created_at: string;
}

interface UnitRates {
  fiber_per_foot: number;
  strand_per_foot: number;
  overlash_per_foot: number;
  anchor_each: number;
  coil_each: number;
  snowshoe_each: number;
}

const DEFAULT_RATES: UnitRates = {
  fiber_per_foot: 0.35,
  strand_per_foot: 0.25,
  overlash_per_foot: 0.30,
  anchor_each: 18.00,
  coil_each: 25.00,
  snowshoe_each: 15.00
};

const STATUS_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  draft: { bg: 'rgba(100, 116, 139, 0.1)', border: 'rgba(100, 116, 139, 0.2)', text: 'rgb(148, 163, 184)' },
  pending: { bg: 'var(--energy-pulse)', border: 'rgba(168, 85, 247, 0.2)', text: 'var(--energy-core)' },
  sent: { bg: 'var(--neural-dim)', border: 'var(--border-neural)', text: 'var(--neural-core)' },
  approved: { bg: 'var(--online-glow)', border: 'rgba(16, 185, 129, 0.2)', text: 'var(--online-core)' },
  paid: { bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.2)', text: 'rgb(34, 197, 94)' },
  rejected: { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.2)', text: 'var(--critical-core)' },
  cancelled: { bg: 'rgba(107, 114, 128, 0.1)', border: 'rgba(107, 114, 128, 0.2)', text: 'rgb(156, 163, 175)' }
};

const QuickInvoice: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRatesModal, setShowRatesModal] = useState(false);
  const [rates, setRates] = useState<UnitRates>(DEFAULT_RATES);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  // Form state
  const [formData, setFormData] = useState({
    customer_name: '',
    project_name: '',
    run_id: '',
    total_feet: 0,
    fiber_count: 48,
    anchors: 0,
    coils: 0,
    snowshoes: 0,
    service_type: 'Fiber Strand',
    tax_rate: 0
  });

  // Calculate preview totals
  const calculatePreview = () => {
    const rate = formData.service_type.toLowerCase().includes('overlash')
      ? rates.overlash_per_foot
      : rates.fiber_per_foot;

    const footage = formData.total_feet * rate;
    const anchors = formData.anchors * rates.anchor_each;
    const coils = formData.coils * rates.coil_each;
    const snowshoes = formData.snowshoes * rates.snowshoe_each;

    const subtotal = footage + anchors + coils + snowshoes;
    const tax = subtotal * (formData.tax_rate / 100);
    const total = subtotal + tax;

    return { subtotal, tax, total };
  };

  const previewTotals = calculatePreview();

  // Load invoices from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('fs_invoices');
    if (stored) {
      setInvoices(JSON.parse(stored));
    }
  }, []);

  // Save invoices to localStorage
  const saveInvoices = (newInvoices: Invoice[]) => {
    localStorage.setItem('fs_invoices', JSON.stringify(newInvoices));
    setInvoices(newInvoices);
  };

  // Create quick invoice
  const createInvoice = async () => {
    setLoading(true);

    try {
      const now = new Date();
      const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + 30);

      const rate = formData.service_type.toLowerCase().includes('overlash')
        ? rates.overlash_per_foot
        : rates.fiber_per_foot;

      const lineItems: LineItem[] = [];

      if (formData.total_feet > 0) {
        lineItems.push({
          id: crypto.randomUUID().substring(0, 8),
          description: `${formData.service_type} Installation - ${formData.fiber_count}F Cable`,
          quantity: formData.total_feet,
          unit: 'FT',
          rate: rate,
          amount: formData.total_feet * rate,
          category: 'LABOR'
        });
      }

      if (formData.anchors > 0) {
        lineItems.push({
          id: crypto.randomUUID().substring(0, 8),
          description: 'Down Guy / Anchor Assembly',
          quantity: formData.anchors,
          unit: 'EA',
          rate: rates.anchor_each,
          amount: formData.anchors * rates.anchor_each,
          category: 'MATERIALS'
        });
      }

      if (formData.coils > 0) {
        lineItems.push({
          id: crypto.randomUUID().substring(0, 8),
          description: 'Slack Loop / Coil Installation',
          quantity: formData.coils,
          unit: 'EA',
          rate: rates.coil_each,
          amount: formData.coils * rates.coil_each,
          category: 'LABOR'
        });
      }

      if (formData.snowshoes > 0) {
        lineItems.push({
          id: crypto.randomUUID().substring(0, 8),
          description: 'Snowshoe (Emergency Reserve)',
          quantity: formData.snowshoes,
          unit: 'EA',
          rate: rates.snowshoe_each,
          amount: formData.snowshoes * rates.snowshoe_each,
          category: 'LABOR'
        });
      }

      const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
      const taxAmount = subtotal * (formData.tax_rate / 100);

      const newInvoice: Invoice = {
        id: crypto.randomUUID(),
        invoice_number: invoiceNumber,
        status: 'draft',
        issue_date: now.toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        payment_terms: 'NET_30',
        from_company: {
          name: 'NextGen Fiber Construction LLC',
          address: '1234 Fiber Lane',
          city: 'Ashburn',
          state: 'VA',
          zip_code: '20147',
          phone: '(703) 555-0100',
          email: 'billing@nextgenfiber.com'
        },
        to_customer: formData.customer_name,
        project_name: formData.project_name,
        run_id: formData.run_id,
        line_items: lineItems,
        subtotal: subtotal,
        tax_rate: formData.tax_rate / 100,
        tax_amount: taxAmount,
        total: subtotal + taxAmount,
        created_at: now.toISOString()
      };

      saveInvoices([newInvoice, ...invoices]);
      setShowCreateModal(false);
      setSelectedInvoice(newInvoice);

      // Reset form
      setFormData({
        customer_name: '',
        project_name: '',
        run_id: '',
        total_feet: 0,
        fiber_count: 48,
        anchors: 0,
        coils: 0,
        snowshoes: 0,
        service_type: 'Fiber Strand',
        tax_rate: 0
      });

    } catch (error) {
      console.error('Error creating invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate PDF
  const generatePDF = (invoice: Invoice) => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.setTextColor(0, 212, 255);
    doc.text('INVOICE', 150, 20);

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(invoice.from_company.name, 20, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    let y = 28;
    if (invoice.from_company.address) {
      doc.text(invoice.from_company.address, 20, y);
      y += 5;
    }
    if (invoice.from_company.city) {
      doc.text(`${invoice.from_company.city}, ${invoice.from_company.state} ${invoice.from_company.zip_code}`, 20, y);
      y += 5;
    }
    if (invoice.from_company.phone) {
      doc.text(`Phone: ${invoice.from_company.phone}`, 20, y);
      y += 5;
    }
    if (invoice.from_company.email) {
      doc.text(`Email: ${invoice.from_company.email}`, 20, y);
    }

    // Invoice details
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Invoice #: ${invoice.invoice_number}`, 150, 30);
    doc.text(`Date: ${new Date(invoice.issue_date).toLocaleDateString()}`, 150, 36);
    doc.text(`Due: ${new Date(invoice.due_date).toLocaleDateString()}`, 150, 42);
    doc.text(`Terms: ${invoice.payment_terms.replace('_', ' ')}`, 150, 48);

    // Bill To
    y = 60;
    doc.setFontSize(11);
    doc.setTextColor(51, 65, 85);
    doc.text('BILL TO:', 20, y);
    y += 6;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(invoice.to_customer, 20, y);
    y += 5;
    if (invoice.customer_address) {
      doc.text(invoice.customer_address, 20, y);
      y += 5;
    }

    // Project Info
    y += 5;
    doc.setFontSize(10);
    doc.text(`Project: ${invoice.project_name}`, 20, y);
    y += 5;
    doc.text(`Map Code: ${invoice.run_id}`, 20, y);

    // Line Items Table
    y += 15;

    const tableData = invoice.line_items.map(item => [
      item.description,
      item.quantity.toLocaleString('en-US', { minimumFractionDigits: 2 }),
      item.unit,
      `$${item.rate.toFixed(2)}`,
      `$${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Description', 'Qty', 'Unit', 'Rate', 'Amount']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [11, 17, 33],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { halign: 'right', cellWidth: 25 },
        2: { halign: 'center', cellWidth: 20 },
        3: { halign: 'right', cellWidth: 30 },
        4: { halign: 'right', cellWidth: 35 }
      }
    });

    // Totals
    const finalY = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(10);
    doc.text('Subtotal:', 140, finalY);
    doc.text(`$${invoice.subtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 190, finalY, { align: 'right' });

    if (invoice.tax_rate > 0) {
      doc.text(`Tax (${(invoice.tax_rate * 100).toFixed(1)}%):`, 140, finalY + 6);
      doc.text(`$${invoice.tax_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 190, finalY + 6, { align: 'right' });
    }

    doc.setFontSize(12);
    doc.setTextColor(0, 212, 255);
    doc.text('TOTAL:', 140, finalY + (invoice.tax_rate > 0 ? 14 : 8));
    doc.text(`$${invoice.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 190, finalY + (invoice.tax_rate > 0 ? 14 : 8), { align: 'right' });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated by Finance Hub - ${new Date().toLocaleString()}`, 105, 285, { align: 'center' });

    // Save
    doc.save(`invoice_${invoice.invoice_number}.pdf`);
  };

  // Update invoice status
  const updateStatus = (invoiceId: string, newStatus: string) => {
    const updated = invoices.map(inv =>
      inv.id === invoiceId ? { ...inv, status: newStatus } : inv
    );
    saveInvoices(updated);
    if (selectedInvoice?.id === invoiceId) {
      setSelectedInvoice({ ...selectedInvoice, status: newStatus });
    }
  };

  // Filter invoices
  const filteredInvoices = filter === 'all'
    ? invoices
    : invoices.filter(inv => inv.status === filter);

  // Stats
  const totalDraft = invoices.filter(i => i.status === 'draft').length;
  const totalPending = invoices.filter(i => i.status === 'pending' || i.status === 'sent').length;
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total, 0);
  const totalOutstanding = invoices.filter(i => ['pending', 'sent', 'approved'].includes(i.status)).reduce((sum, i) => sum + i.total, 0);

  const getStatusStyle = (status: string) => STATUS_STYLES[status] || STATUS_STYLES.draft;

  return (
    <div className="flex-1 overflow-y-auto p-8" style={{ background: 'var(--void)' }}>
      <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full w-fit"
              style={{
                background: 'var(--neural-dim)',
                border: '1px solid var(--border-neural)'
              }}
            >
              <Zap className="w-3 h-3" style={{ color: 'var(--neural-core)' }} />
              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--neural-core)' }}>Quick Invoice</span>
            </div>
            <h1 className="text-3xl font-black tracking-tighter uppercase text-gradient-neural">Invoice Manager</h1>
            <p className="text-sm" style={{ color: 'var(--text-ghost)' }}>Generate, track, and manage construction invoices</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowRatesModal(true)}
              className="px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-secondary)'
              }}
            >
              <Calculator className="w-4 h-4" style={{ color: 'var(--text-ghost)' }} />
              Unit Rates
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 active:scale-95"
              style={{
                background: 'var(--gradient-neural)',
                color: 'var(--void)',
                boxShadow: 'var(--shadow-neural)'
              }}
            >
              <Plus className="w-4 h-4" />
              New Invoice
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg" style={{ background: 'rgba(100, 116, 139, 0.1)' }}>
                <FileText className="w-5 h-5" style={{ color: 'var(--text-ghost)' }} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-ghost)' }}>Drafts</span>
            </div>
            <p className="text-3xl font-black" style={{ color: 'var(--text-primary)' }}>{totalDraft}</p>
          </div>

          <div className="p-6 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg" style={{ background: 'var(--energy-pulse)' }}>
                <Clock className="w-5 h-5" style={{ color: 'var(--energy-core)' }} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-ghost)' }}>Pending</span>
            </div>
            <p className="text-3xl font-black" style={{ color: 'var(--text-primary)' }}>{totalPending}</p>
          </div>

          <div className="p-6 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg" style={{ background: 'var(--online-glow)' }}>
                <DollarSign className="w-5 h-5" style={{ color: 'var(--online-core)' }} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-ghost)' }}>Paid (Total)</span>
            </div>
            <p className="text-3xl font-black" style={{ color: 'var(--online-core)' }}>${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>

          <div className="p-6 rounded-2xl" style={{ background: 'var(--neural-dim)', border: '1px solid var(--border-neural)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg" style={{ background: 'rgba(0, 212, 255, 0.2)' }}>
                <AlertTriangle className="w-5 h-5" style={{ color: 'var(--neural-core)' }} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--neural-core)' }}>Outstanding</span>
            </div>
            <p className="text-3xl font-black" style={{ color: 'var(--neural-core)' }}>${totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Invoice List */}
          <div className="lg:col-span-2 p-6 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
            {/* Filter Tabs */}
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
              {['all', 'draft', 'pending', 'sent', 'approved', 'paid'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap"
                  style={{
                    background: filter === status ? 'var(--gradient-neural)' : 'var(--elevated)',
                    color: filter === status ? 'var(--void)' : 'var(--text-ghost)',
                    boxShadow: filter === status ? 'var(--shadow-neural)' : 'none'
                  }}
                >
                  {status === 'all' ? 'All' : status}
                </button>
              ))}
            </div>

            {/* Invoice Table */}
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {filteredInvoices.length === 0 ? (
                <div className="text-center py-12">
                  <Receipt className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-ghost)', opacity: 0.5 }} />
                  <p className="text-sm" style={{ color: 'var(--text-ghost)' }}>No invoices found</p>
                </div>
              ) : (
                filteredInvoices.map((invoice) => {
                  const statusStyle = getStatusStyle(invoice.status);
                  return (
                    <div
                      key={invoice.id}
                      onClick={() => setSelectedInvoice(invoice)}
                      className="p-4 rounded-xl cursor-pointer transition-all"
                      style={{
                        background: selectedInvoice?.id === invoice.id ? 'var(--elevated)' : 'var(--deep)',
                        border: selectedInvoice?.id === invoice.id ? '1px solid var(--border-neural)' : '1px solid var(--border-subtle)'
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{invoice.invoice_number}</p>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-ghost)' }}>{invoice.to_customer}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>${invoice.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                          <span
                            className="inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase"
                            style={{
                              background: statusStyle.bg,
                              border: `1px solid ${statusStyle.border}`,
                              color: statusStyle.text
                            }}
                          >
                            {invoice.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-3 text-[10px]" style={{ color: 'var(--text-ghost)' }}>
                        <span>Project: {invoice.project_name}</span>
                        <span>Map Code: {invoice.run_id}</span>
                        <span>Due: {new Date(invoice.due_date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Invoice Preview */}
          <div className="p-6 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
            <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Invoice Preview</h3>

            {selectedInvoice ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl" style={{ background: 'var(--deep)', border: '1px solid var(--border-subtle)' }}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-ghost)' }}>{selectedInvoice.invoice_number}</span>
                    <span
                      className="px-2 py-0.5 rounded text-[9px] font-bold uppercase"
                      style={{
                        background: getStatusStyle(selectedInvoice.status).bg,
                        border: `1px solid ${getStatusStyle(selectedInvoice.status).border}`,
                        color: getStatusStyle(selectedInvoice.status).text
                      }}
                    >
                      {selectedInvoice.status}
                    </span>
                  </div>

                  <p className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{selectedInvoice.to_customer}</p>
                  <p className="text-xs" style={{ color: 'var(--text-ghost)' }}>Project: {selectedInvoice.project_name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-ghost)' }}>Map Code: {selectedInvoice.run_id}</p>
                </div>

                {/* Line Items Summary */}
                <div className="space-y-2">
                  {selectedInvoice.line_items.map((item) => (
                    <div key={item.id} className="flex justify-between text-xs">
                      <span className="truncate flex-1" style={{ color: 'var(--text-ghost)' }}>{item.description}</span>
                      <span className="font-medium ml-2" style={{ color: 'var(--text-primary)' }}>${item.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-4 space-y-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <div className="flex justify-between text-xs">
                    <span style={{ color: 'var(--text-ghost)' }}>Subtotal</span>
                    <span style={{ color: 'var(--text-primary)' }}>${selectedInvoice.subtotal.toFixed(2)}</span>
                  </div>
                  {selectedInvoice.tax_rate > 0 && (
                    <div className="flex justify-between text-xs">
                      <span style={{ color: 'var(--text-ghost)' }}>Tax ({(selectedInvoice.tax_rate * 100).toFixed(1)}%)</span>
                      <span style={{ color: 'var(--text-primary)' }}>${selectedInvoice.tax_amount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold">
                    <span style={{ color: 'var(--neural-core)' }}>Total</span>
                    <span style={{ color: 'var(--neural-core)' }}>${selectedInvoice.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-4">
                  <button
                    onClick={() => generatePDF(selectedInvoice)}
                    className="w-full px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                    style={{
                      background: 'var(--gradient-neural)',
                      color: 'var(--void)',
                      boxShadow: 'var(--shadow-neural)'
                    }}
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </button>

                  {selectedInvoice.status === 'draft' && (
                    <button
                      onClick={() => updateStatus(selectedInvoice.id, 'sent')}
                      className="w-full px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      style={{
                        background: 'var(--neural-dim)',
                        border: '1px solid var(--border-neural)',
                        color: 'var(--neural-core)'
                      }}
                    >
                      <Send className="w-4 h-4" />
                      Mark as Sent
                    </button>
                  )}

                  {selectedInvoice.status === 'sent' && (
                    <button
                      onClick={() => updateStatus(selectedInvoice.id, 'paid')}
                      className="w-full px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      style={{
                        background: 'var(--online-glow)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        color: 'var(--online-core)'
                      }}
                    >
                      <Check className="w-4 h-4" />
                      Mark as Paid
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-ghost)', opacity: 0.5 }} />
                <p className="text-sm" style={{ color: 'var(--text-ghost)' }}>Select an invoice to preview</p>
              </div>
            )}
          </div>
        </div>

        {/* Create Invoice Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0, 0, 0, 0.3)', backdropFilter: 'blur(20px)' }}>
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
              <div className="p-6 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Create Quick Invoice</h3>
                <button onClick={() => setShowCreateModal(false)} className="p-2 rounded-lg transition-colors" style={{ background: 'var(--elevated)' }}>
                  <X className="w-5 h-5" style={{ color: 'var(--text-ghost)' }} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Customer Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-ghost)' }}>Customer Name *</label>
                    <input
                      type="text"
                      value={formData.customer_name}
                      onChange={(e) => setFormData({...formData, customer_name: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl focus:outline-none"
                      style={{
                        background: 'var(--elevated)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)'
                      }}
                      placeholder="e.g., Spectrum"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-ghost)' }}>Project Name *</label>
                    <input
                      type="text"
                      value={formData.project_name}
                      onChange={(e) => setFormData({...formData, project_name: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl focus:outline-none"
                      style={{
                        background: 'var(--elevated)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)'
                      }}
                      placeholder="e.g., Broadlands Phase 2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-ghost)' }}>Map Code *</label>
                    <input
                      type="text"
                      value={formData.run_id}
                      onChange={(e) => setFormData({...formData, run_id: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl focus:outline-none"
                      style={{
                        background: 'var(--elevated)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)'
                      }}
                      placeholder="e.g., MAP-001"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-ghost)' }}>Service Type</label>
                    <select
                      value={formData.service_type}
                      onChange={(e) => setFormData({...formData, service_type: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl focus:outline-none"
                      style={{
                        background: 'var(--elevated)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <option value="Fiber Strand">Fiber Strand</option>
                      <option value="Overlash">Overlash</option>
                      <option value="Underground">Underground</option>
                    </select>
                  </div>
                </div>

                {/* Quantities */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-ghost)' }}>Total Feet</label>
                    <input
                      type="number"
                      value={formData.total_feet}
                      onChange={(e) => setFormData({...formData, total_feet: parseInt(e.target.value) || 0})}
                      className="w-full px-4 py-3 rounded-xl focus:outline-none"
                      style={{
                        background: 'var(--elevated)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-ghost)' }}>Fiber Count</label>
                    <input
                      type="number"
                      value={formData.fiber_count}
                      onChange={(e) => setFormData({...formData, fiber_count: parseInt(e.target.value) || 48})}
                      className="w-full px-4 py-3 rounded-xl focus:outline-none"
                      style={{
                        background: 'var(--elevated)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-ghost)' }}>Anchors</label>
                    <input
                      type="number"
                      value={formData.anchors}
                      onChange={(e) => setFormData({...formData, anchors: parseInt(e.target.value) || 0})}
                      className="w-full px-4 py-3 rounded-xl focus:outline-none"
                      style={{
                        background: 'var(--elevated)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-ghost)' }}>Coils</label>
                    <input
                      type="number"
                      value={formData.coils}
                      onChange={(e) => setFormData({...formData, coils: parseInt(e.target.value) || 0})}
                      className="w-full px-4 py-3 rounded-xl focus:outline-none"
                      style={{
                        background: 'var(--elevated)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-ghost)' }}>Snowshoes</label>
                    <input
                      type="number"
                      value={formData.snowshoes}
                      onChange={(e) => setFormData({...formData, snowshoes: parseInt(e.target.value) || 0})}
                      className="w-full px-4 py-3 rounded-xl focus:outline-none"
                      style={{
                        background: 'var(--elevated)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-ghost)' }}>Tax Rate (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.tax_rate}
                      onChange={(e) => setFormData({...formData, tax_rate: parseFloat(e.target.value) || 0})}
                      className="w-full px-4 py-3 rounded-xl focus:outline-none"
                      style={{
                        background: 'var(--elevated)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>
                </div>

                {/* Preview */}
                <div className="p-4 rounded-xl" style={{ background: 'var(--deep)', border: '1px solid var(--border-subtle)' }}>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-ghost)' }}>Invoice Preview</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span style={{ color: 'var(--text-ghost)' }}>Subtotal</span>
                      <span style={{ color: 'var(--text-primary)' }}>${previewTotals.subtotal.toFixed(2)}</span>
                    </div>
                    {formData.tax_rate > 0 && (
                      <div className="flex justify-between text-sm">
                        <span style={{ color: 'var(--text-ghost)' }}>Tax ({formData.tax_rate}%)</span>
                        <span style={{ color: 'var(--text-primary)' }}>${previewTotals.tax.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--neural-core)' }}>Total</span>
                      <span style={{ color: 'var(--neural-core)' }}>${previewTotals.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 flex justify-end gap-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                  style={{
                    background: 'var(--elevated)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-secondary)'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={createInvoice}
                  disabled={!formData.customer_name || !formData.project_name || !formData.run_id || loading}
                  className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  style={{
                    background: 'var(--gradient-neural)',
                    color: 'var(--void)',
                    boxShadow: 'var(--shadow-neural)'
                  }}
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(0,0,0,0.3)', borderTopColor: 'var(--void)' }} />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create Invoice
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Unit Rates Modal */}
        {showRatesModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0, 0, 0, 0.9)', backdropFilter: 'blur(8px)' }}>
            <div className="w-full max-w-md rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
              <div className="p-6 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Unit Rates Configuration</h3>
                <button onClick={() => setShowRatesModal(false)} className="p-2 rounded-lg transition-colors" style={{ background: 'var(--elevated)' }}>
                  <X className="w-5 h-5" style={{ color: 'var(--text-ghost)' }} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {Object.entries(rates).map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-ghost)' }}>
                      {key.replace(/_/g, ' ')}
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-ghost)' }}>$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={value}
                        onChange={(e) => setRates({...rates, [key]: parseFloat(e.target.value) || 0})}
                        className="w-full pl-8 pr-4 py-3 rounded-xl focus:outline-none"
                        style={{
                          background: 'var(--elevated)',
                          border: '1px solid var(--border-default)',
                          color: 'var(--text-primary)'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-6 flex justify-end gap-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  onClick={() => setRates(DEFAULT_RATES)}
                  className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                  style={{
                    background: 'var(--elevated)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-secondary)'
                  }}
                >
                  Reset to Default
                </button>
                <button
                  onClick={() => setShowRatesModal(false)}
                  className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                  style={{
                    background: 'var(--gradient-neural)',
                    color: 'var(--void)',
                    boxShadow: 'var(--shadow-neural)'
                  }}
                >
                  Save Rates
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickInvoice;
