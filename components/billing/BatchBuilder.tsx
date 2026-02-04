/**
 * Invoice Batch Builder - Create and manage invoice batches
 * Tesla/SpaceX/Nothing/B&O inspired premium design
 */

import React, { useState, useMemo } from 'react';
import {
  Plus, Minus, Save, Send, Download, FileText, Camera,
  CheckCircle, XCircle, AlertTriangle, DollarSign,
  Calendar, Users, Trash2, Eye, Package, Paperclip,
  ChevronDown, ChevronUp, ExternalLink, RefreshCw, Zap
} from 'lucide-react';
import {
  InvoiceBatch,
  InvoiceBatchStatus,
  InvoiceLineItemAggregate,
  ProductionLine,
  ChecklistItem,
  Deduction,
  DeductionCategory
} from '../../types/billing';

// ============================================
// MOCK DATA
// ============================================

const MOCK_BATCH: InvoiceBatch = {
  id: 'batch_001',
  batchNumber: 'B-2024-0001',
  primeContractor: 'Spectrum',
  projectId: 'PROJ-001',
  projectName: 'Spectrum Loudoun Phase 2',
  periodStart: '2024-01-01',
  periodEnd: '2024-01-15',
  status: InvoiceBatchStatus.DRAFT,
  statusHistory: [],
  lineIds: ['line_001', 'line_002', 'line_003'],
  lineItems: [
    {
      lineItemCode: 'LI-AERIAL-288',
      description: 'Aerial Fiber Installation - 288F',
      unit: 'FT',
      totalQty: 3750,
      qtyBreakdown: [
        { lineId: 'line_001', jobId: 'JOB-2024-0001', qty: 1250, workDate: '2024-01-15' },
        { lineId: 'line_003', jobId: 'JOB-2024-0003', qty: 2500, workDate: '2024-01-14' }
      ],
      rate: 0.42,
      rateCardId: 'RC-SPECTRUM-001',
      rateCardVersion: 2,
      extendedAmount: 1575.00,
      evidenceCount: 8,
      evidenceLinks: [],
      complianceScore: 93,
      hasIssues: false
    },
    {
      lineItemCode: 'LI-ANCHOR',
      description: 'Anchor Assembly Installation',
      unit: 'EA',
      totalQty: 5,
      qtyBreakdown: [
        { lineId: 'line_002', jobId: 'JOB-2024-0002', qty: 5, workDate: '2024-01-15' }
      ],
      rate: 18.00,
      rateCardId: 'RC-SPECTRUM-001',
      rateCardVersion: 2,
      extendedAmount: 90.00,
      evidenceCount: 5,
      evidenceLinks: [],
      complianceScore: 100,
      hasIssues: false
    }
  ],
  subtotal: 1665.00,
  deductions: [],
  deductionsTotal: 0,
  retainagePercent: 5,
  retainageAmount: 83.25,
  total: 1581.75,
  packageReadiness: {
    isReady: false,
    score: 75,
    checklist: [
      { id: 'chk_001', requirement: 'All lines have required evidence', category: 'EVIDENCE', isRequired: true, isPassed: true },
      { id: 'chk_002', requirement: 'All lines mapped to billing codes', category: 'CALCULATION', isRequired: true, isPassed: true },
      { id: 'chk_003', requirement: 'Cover letter attached', category: 'DOCUMENTATION', isRequired: true, isPassed: false, message: 'Cover letter not attached' },
      { id: 'chk_004', requirement: 'Summary report generated', category: 'DOCUMENTATION', isRequired: false, isPassed: false },
      { id: 'chk_005', requirement: 'Internal approval obtained', category: 'APPROVAL', isRequired: true, isPassed: false, message: 'Pending supervisor approval' }
    ]
  },
  attachments: [],
  paymentTerms: 'NET30',
  createdBy: 'user_billing1',
  createdAt: '2024-01-16T12:00:00Z',
  updatedAt: '2024-01-16T12:00:00Z'
};

// ============================================
// SUB-COMPONENTS
// ============================================

interface ChecklistPanelProps {
  checklist: ChecklistItem[];
  score: number;
}

const ChecklistPanel: React.FC<ChecklistPanelProps> = ({ checklist, score }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const passed = checklist.filter(c => c.isPassed).length;
  const required = checklist.filter(c => c.isRequired);
  const requiredPassed = required.filter(c => c.isPassed).length;

  const isBlocked = requiredPassed < required.length;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: '1px solid var(--border-default)' }}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-5 flex items-center justify-between transition-all hover:scale-[1.005]"
        style={{ background: 'var(--surface)' }}
      >
        <div className="flex items-center gap-4">
          <div
            className="p-3 rounded-xl"
            style={{
              background: isBlocked ? 'rgba(239, 68, 68, 0.1)' : 'var(--online-glow)',
              border: isBlocked ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)'
            }}
          >
            <Package className="w-5 h-5" style={{ color: isBlocked ? 'var(--critical-core)' : 'var(--online-core)' }} />
          </div>
          <div className="text-left">
            <p className="text-sm font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Package Readiness</p>
            <p className="text-xs" style={{ color: 'var(--text-ghost)' }}>
              {passed}/{checklist.length} complete • {requiredPassed}/{required.length} required
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p
              className="text-3xl font-black tracking-tighter"
              style={{ color: score >= 80 ? 'var(--online-core)' : score >= 50 ? 'var(--energy-core)' : 'var(--critical-core)' }}
            >
              {score}%
            </p>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5" style={{ color: 'var(--text-ghost)' }} />
          ) : (
            <ChevronDown className="w-5 h-5" style={{ color: 'var(--text-ghost)' }} />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="p-5 space-y-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          {checklist.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-4 p-4 rounded-xl transition-all"
              style={{
                background: item.isPassed
                  ? 'var(--online-glow)'
                  : item.isRequired
                    ? 'rgba(239, 68, 68, 0.05)'
                    : 'var(--elevated)'
              }}
            >
              {item.isPassed ? (
                <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--online-core)' }} />
              ) : item.isRequired ? (
                <XCircle className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--critical-core)' }} />
              ) : (
                <div
                  className="w-5 h-5 rounded-full flex-shrink-0"
                  style={{ border: '2px solid var(--border-default)' }}
                />
              )}

              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium"
                  style={{
                    color: item.isPassed
                      ? 'var(--online-core)'
                      : item.isRequired
                        ? 'var(--critical-core)'
                        : 'var(--text-secondary)'
                  }}
                >
                  {item.requirement}
                  {item.isRequired && <span style={{ color: 'var(--critical-core)' }}> *</span>}
                </p>
                {item.message && !item.isPassed && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-ghost)' }}>{item.message}</p>
                )}
              </div>

              <span
                className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg"
                style={{ background: 'var(--elevated)', color: 'var(--text-ghost)' }}
              >
                {item.category}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface LineItemRowProps {
  item: InvoiceLineItemAggregate;
  isExpanded: boolean;
  onToggle: () => void;
  onRemove?: () => void;
}

const LineItemRow: React.FC<LineItemRowProps> = ({
  item,
  isExpanded,
  onToggle,
  onRemove
}) => {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: '1px solid var(--border-default)' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-4 p-5 cursor-pointer transition-all hover:scale-[1.002]"
        style={{ background: 'var(--surface)' }}
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold" style={{ color: 'var(--text-ghost)' }}>{item.lineItemCode}</span>
            {item.hasIssues && (
              <AlertTriangle className="w-4 h-4" style={{ color: 'var(--energy-core)' }} />
            )}
          </div>
          <p className="text-sm font-bold truncate mt-1" style={{ color: 'var(--text-primary)' }}>{item.description}</p>
        </div>

        <div className="text-right">
          <p className="text-sm font-mono font-black" style={{ color: 'var(--text-primary)' }}>
            {item.totalQty.toLocaleString()} {item.unit}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-ghost)' }}>@ ${item.rate.toFixed(2)}</p>
        </div>

        <div className="text-right w-28">
          <p className="text-xl font-black" style={{ color: 'var(--online-core)' }}>
            ${item.extendedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1" style={{ color: 'var(--text-ghost)' }}>
            <Camera className="w-4 h-4" />
            <span className="text-xs font-bold">{item.evidenceCount}</span>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className="p-1"
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5" style={{ color: 'var(--text-ghost)' }} />
            ) : (
              <ChevronDown className="w-5 h-5" style={{ color: 'var(--text-ghost)' }} />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="p-5 space-y-4" style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--elevated)' }}>
          <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-ghost)' }}>
            Quantity Breakdown ({item.qtyBreakdown.length} jobs)
          </p>

          <div className="space-y-2">
            {item.qtyBreakdown.map((bd, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-xl text-xs"
                style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold" style={{ color: 'var(--text-secondary)' }}>{bd.jobId}</span>
                  <span style={{ color: 'var(--text-ghost)' }}>•</span>
                  <span style={{ color: 'var(--text-ghost)' }}>{new Date(bd.workDate).toLocaleDateString()}</span>
                </div>
                <span className="font-mono font-black" style={{ color: 'var(--text-primary)' }}>
                  {bd.qty.toLocaleString()} {item.unit}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-ghost)' }}>
              <span>Rate Card: {item.rateCardId} v{item.rateCardVersion}</span>
              <span>•</span>
              <span>Score: {item.complianceScore}%</span>
            </div>

            {onRemove && (
              <button
                onClick={onRemove}
                className="text-xs font-bold flex items-center gap-1 transition-colors"
                style={{ color: 'var(--critical-core)' }}
              >
                <Trash2 className="w-3 h-3" />
                Remove
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

interface BatchBuilderProps {
  batchId?: string;
  initialLineIds?: string[];
  onSave: (batch: Partial<InvoiceBatch>) => Promise<void>;
  onSubmit: (batchId: string) => Promise<void>;
  onCancel: () => void;
}

const BatchBuilder: React.FC<BatchBuilderProps> = ({
  batchId,
  initialLineIds,
  onSave,
  onSubmit,
  onCancel
}) => {
  const [batch, setBatch] = useState<InvoiceBatch>(MOCK_BATCH);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showDeductionForm, setShowDeductionForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Computed
  const totals = useMemo(() => {
    const subtotal = batch.lineItems.reduce((sum, item) => sum + item.extendedAmount, 0);
    const deductions = batch.deductions.reduce((sum, d) => sum + d.amount, 0);
    const retainage = batch.retainagePercent ? subtotal * (batch.retainagePercent / 100) : 0;
    const total = subtotal - deductions - retainage;

    return { subtotal, deductions, retainage, total };
  }, [batch.lineItems, batch.deductions, batch.retainagePercent]);

  const canSubmit = batch.packageReadiness.checklist
    .filter(c => c.isRequired)
    .every(c => c.isPassed);

  // Handlers
  const toggleItemExpand = (code: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(batch);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      await onSubmit(batch.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--void)' }}>
      {/* Header */}
      <header
        className="flex-shrink-0 px-8 py-6"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-black tracking-tighter uppercase text-gradient-neural">Invoice Batch</h1>
              <span
                className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest"
                style={{ background: 'var(--energy-pulse)', color: 'var(--energy-core)' }}
              >
                {batch.status}
              </span>
            </div>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {batch.batchNumber} • {batch.projectName}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105"
              style={{ background: 'var(--surface)', color: 'var(--text-tertiary)', border: '1px solid var(--border-default)' }}
            >
              Cancel
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:scale-105 disabled:opacity-50"
              style={{ background: 'var(--surface)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </button>

            <button
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              className="px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all"
              style={{
                background: canSubmit ? 'var(--gradient-neural)' : 'var(--surface)',
                color: canSubmit ? 'var(--void)' : 'var(--text-ghost)',
                boxShadow: canSubmit ? 'var(--shadow-neural)' : 'none',
                cursor: canSubmit ? 'pointer' : 'not-allowed'
              }}
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? 'Submitting...' : 'Submit Invoice'}
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-8 space-y-8">
          {/* Batch Header Info */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Customer', value: batch.primeContractor },
              { label: 'Period', value: `${new Date(batch.periodStart).toLocaleDateString()} - ${new Date(batch.periodEnd).toLocaleDateString()}` },
              { label: 'Lines', value: batch.lineIds.length },
              { label: 'Terms', value: batch.paymentTerms }
            ].map((item, i) => (
              <div
                key={i}
                className="p-5 rounded-2xl"
                style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
              >
                <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: 'var(--text-ghost)' }}>{item.label}</p>
                <p className="text-lg font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Package Readiness */}
          <ChecklistPanel
            checklist={batch.packageReadiness.checklist}
            score={batch.packageReadiness.score}
          />

          {/* Line Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Line Items</h2>
              <button
                onClick={() => alert('Add Lines feature coming soon - select from Production Inbox')}
                className="text-xs font-black uppercase tracking-widest flex items-center gap-1 transition-all hover:scale-105"
                style={{ color: 'var(--neural-core)' }}
              >
                <Plus className="w-3 h-3" />
                Add Lines
              </button>
            </div>

            <div className="space-y-3">
              {batch.lineItems.map(item => (
                <LineItemRow
                  key={item.lineItemCode}
                  item={item}
                  isExpanded={expandedItems.has(item.lineItemCode)}
                  onToggle={() => toggleItemExpand(item.lineItemCode)}
                />
              ))}
            </div>
          </div>

          {/* Totals */}
          <div
            className="p-6 rounded-2xl space-y-4"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
          >
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>Subtotal</span>
              <span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                ${totals.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            {batch.deductions.length > 0 && (
              <div className="space-y-2 py-3" style={{ borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-ghost)' }}>Deductions</p>
                {batch.deductions.map(d => (
                  <div key={d.id} className="flex items-center justify-between text-sm">
                    <span style={{ color: 'var(--critical-core)' }}>{d.description}</span>
                    <span className="font-mono font-bold" style={{ color: 'var(--critical-core)' }}>
                      -${d.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {batch.retainagePercent && batch.retainagePercent > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span style={{ color: 'var(--energy-core)' }}>Retainage ({batch.retainagePercent}%)</span>
                <span className="font-mono font-bold" style={{ color: 'var(--energy-core)' }}>
                  -${totals.retainage.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-xl font-black pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-primary)' }}>Total Due</span>
              <span className="font-mono text-gradient-neural">
                ${totals.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            <button
              onClick={() => setShowDeductionForm(true)}
              className="w-full mt-2 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
              style={{ border: '1px dashed var(--border-default)', color: 'var(--text-ghost)' }}
            >
              <Plus className="w-3 h-3" />
              Add Deduction
            </button>
          </div>

          {/* Attachments */}
          <div
            className="p-6 rounded-2xl space-y-4"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Attachments</h3>
              <button
                onClick={() => alert('File attachment feature coming soon')}
                className="text-xs font-black uppercase tracking-widest flex items-center gap-1 transition-all hover:scale-105"
                style={{ color: 'var(--neural-core)' }}
              >
                <Paperclip className="w-3 h-3" />
                Attach Files
              </button>
            </div>

            {batch.attachments.length === 0 ? (
              <div className="py-10 text-center">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: 'var(--text-ghost)' }} />
                <p className="text-sm" style={{ color: 'var(--text-ghost)' }}>No attachments yet</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-ghost)' }}>
                  Attach cover letter, summary reports, or other documents
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Attachment list would go here */}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div
              className="p-5 rounded-2xl"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
            >
              <label className="block text-[9px] font-black uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--text-ghost)' }}>
                Internal Notes
              </label>
              <textarea
                value={batch.internalNotes || ''}
                onChange={(e) => setBatch(b => ({ ...b, internalNotes: e.target.value }))}
                placeholder="Notes for internal use only..."
                className="w-full h-24 px-4 py-3 rounded-xl text-sm resize-none focus:outline-none"
                style={{
                  background: 'var(--elevated)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>

            <div
              className="p-5 rounded-2xl"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
            >
              <label className="block text-[9px] font-black uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--text-ghost)' }}>
                Customer Notes
              </label>
              <textarea
                value={batch.customerNotes || ''}
                onChange={(e) => setBatch(b => ({ ...b, customerNotes: e.target.value }))}
                placeholder="Notes visible on invoice..."
                className="w-full h-24 px-4 py-3 rounded-xl text-sm resize-none focus:outline-none"
                style={{
                  background: 'var(--elevated)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchBuilder;
