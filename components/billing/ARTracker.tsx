/**
 * AR Tracker - Accounts Receivable Pipeline & Aging
 * Tesla/SpaceX/Nothing/B&O inspired premium design
 */

import React, { useState, useMemo } from 'react';
import {
  DollarSign, Clock, CheckCircle, XCircle, AlertTriangle,
  Calendar, ChevronRight, Filter, Search, Download,
  TrendingUp, TrendingDown, Eye, MoreHorizontal,
  RefreshCw, ArrowRight, CreditCard, Zap
} from 'lucide-react';
import {
  InvoiceBatch,
  InvoiceBatchStatus,
  AgingEntry
} from '../../types/billing';

// ============================================
// AGING ENTRIES - Empty array, ready for real data
// ============================================

const MOCK_AGING: AgingEntry[] = [];

// ============================================
// SUB-COMPONENTS
// ============================================

interface AgingSummaryProps {
  entries: AgingEntry[];
}

const AgingSummary: React.FC<AgingSummaryProps> = ({ entries }) => {
  const summary = useMemo(() => {
    const buckets = {
      '0-30': 0,
      '31-60': 0,
      '61-90': 0,
      '90+': 0
    };

    let total = 0;

    entries.forEach(e => {
      buckets[e.agingBucket] += e.invoiceAmount;
      total += e.invoiceAmount;
    });

    return { buckets, total };
  }, [entries]);

  const bucketConfig = [
    { key: '0-30', label: 'Current', color: 'online' },
    { key: '31-60', label: '31-60 Days', color: 'energy' },
    { key: '61-90', label: '61-90 Days', color: 'warning' },
    { key: '90+', label: '90+ Days', color: 'critical' }
  ];

  const getColorStyle = (color: string) => {
    switch (color) {
      case 'online':
        return { bg: 'var(--online-glow)', border: 'rgba(16, 185, 129, 0.2)', text: 'var(--online-core)' };
      case 'energy':
        return { bg: 'var(--energy-pulse)', border: 'rgba(168, 85, 247, 0.2)', text: 'var(--energy-core)' };
      case 'warning':
        return { bg: 'rgba(251, 146, 60, 0.1)', border: 'rgba(251, 146, 60, 0.2)', text: '#fb923c' };
      case 'critical':
        return { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.2)', text: 'var(--critical-core)' };
      default:
        return { bg: 'var(--surface)', border: 'var(--border-default)', text: 'var(--text-primary)' };
    }
  };

  return (
    <div className="grid grid-cols-5 gap-4">
      {/* Total */}
      <div
        className="p-6 rounded-2xl relative overflow-hidden"
        style={{ background: 'var(--neural-dim)', border: '1px solid var(--border-neural)' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div
            className="p-2 rounded-xl"
            style={{ background: 'var(--gradient-neural)' }}
          >
            <DollarSign className="w-5 h-5" style={{ color: 'var(--void)' }} />
          </div>
          <span className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-ghost)' }}>
            Total Outstanding
          </span>
        </div>
        <p className="text-4xl font-black tracking-tighter text-gradient-neural">
          ${(summary.total / 1000).toFixed(1)}K
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-ghost)' }}>
          {entries.length} invoices
        </p>
      </div>

      {/* Buckets */}
      {bucketConfig.map(({ key, label, color }) => {
        const colorStyle = getColorStyle(color);
        const amount = summary.buckets[key as keyof typeof summary.buckets];
        const count = entries.filter(e => e.agingBucket === key).length;

        return (
          <div
            key={key}
            className="p-6 rounded-2xl transition-all hover:scale-[1.02]"
            style={{
              background: amount > 0 ? colorStyle.bg : 'var(--surface)',
              border: `1px solid ${amount > 0 ? colorStyle.border : 'var(--border-default)'}`
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div
                className="p-2 rounded-xl"
                style={{ background: amount > 0 ? colorStyle.bg : 'var(--elevated)' }}
              >
                <Clock className="w-5 h-5" style={{ color: amount > 0 ? colorStyle.text : 'var(--text-ghost)' }} />
              </div>
              <span className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-ghost)' }}>
                {label}
              </span>
            </div>
            <p
              className="text-4xl font-black tracking-tighter"
              style={{ color: amount > 0 ? colorStyle.text : 'var(--text-ghost)' }}
            >
              ${(amount / 1000).toFixed(1)}K
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-ghost)' }}>
              {count} invoices
            </p>
          </div>
        );
      })}
    </div>
  );
};

interface PipelineCardProps {
  status: InvoiceBatchStatus;
  count: number;
  amount: number;
  color: 'neural' | 'online' | 'success';
}

const PipelineCard: React.FC<PipelineCardProps> = ({
  status,
  count,
  amount,
  color
}) => {
  const statusLabels: Record<InvoiceBatchStatus, string> = {
    [InvoiceBatchStatus.DRAFT]: 'Draft',
    [InvoiceBatchStatus.READY]: 'Ready',
    [InvoiceBatchStatus.SUBMITTED]: 'Submitted',
    [InvoiceBatchStatus.APPROVED]: 'Approved',
    [InvoiceBatchStatus.PARTIALLY_APPROVED]: 'Partial',
    [InvoiceBatchStatus.REJECTED]: 'Rejected',
    [InvoiceBatchStatus.DISPUTED]: 'Disputed',
    [InvoiceBatchStatus.PAID]: 'Paid',
    [InvoiceBatchStatus.CANCELLED]: 'Cancelled'
  };

  const getColorStyle = () => {
    switch (color) {
      case 'neural':
        return { bg: 'var(--neural-dim)', border: 'var(--border-neural)', text: 'var(--neural-core)' };
      case 'online':
        return { bg: 'var(--online-glow)', border: 'rgba(16, 185, 129, 0.2)', text: 'var(--online-core)' };
      case 'success':
        return { bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.2)', text: '#22c55e' };
    }
  };

  const colorStyle = getColorStyle();

  return (
    <div
      className="p-5 rounded-2xl flex-1 transition-all hover:scale-[1.02]"
      style={{ background: colorStyle.bg, border: `1px solid ${colorStyle.border}` }}
    >
      <p
        className="text-[9px] font-black uppercase tracking-[0.2em] mb-2"
        style={{ color: colorStyle.text }}
      >
        {statusLabels[status]}
      </p>
      <p className="text-3xl font-black tracking-tighter" style={{ color: 'var(--text-primary)' }}>{count}</p>
      <p className="text-sm font-bold mt-1" style={{ color: colorStyle.text }}>
        ${(amount / 1000).toFixed(1)}K
      </p>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

interface ARTrackerProps {
  onViewInvoice: (batchId: string) => void;
  onRecordPayment: (batchId: string) => void;
}

const ARTracker: React.FC<ARTrackerProps> = ({
  onViewInvoice,
  onRecordPayment
}) => {
  const [entries] = useState<AgingEntry[]>(MOCK_AGING);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<InvoiceBatchStatus | 'all'>('all');

  // Computed
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!e.invoiceNumber.toLowerCase().includes(q) &&
            !e.primeContractor.toLowerCase().includes(q) &&
            !e.projectName.toLowerCase().includes(q)) {
          return false;
        }
      }

      if (selectedStatus !== 'all' && e.status !== selectedStatus) {
        return false;
      }

      return true;
    });
  }, [entries, searchQuery, selectedStatus]);

  const statusCounts = useMemo(() => {
    const counts: Record<InvoiceBatchStatus, { count: number; amount: number }> = {
      [InvoiceBatchStatus.DRAFT]: { count: 0, amount: 0 },
      [InvoiceBatchStatus.READY]: { count: 0, amount: 0 },
      [InvoiceBatchStatus.SUBMITTED]: { count: 0, amount: 0 },
      [InvoiceBatchStatus.APPROVED]: { count: 0, amount: 0 },
      [InvoiceBatchStatus.PARTIALLY_APPROVED]: { count: 0, amount: 0 },
      [InvoiceBatchStatus.REJECTED]: { count: 0, amount: 0 },
      [InvoiceBatchStatus.DISPUTED]: { count: 0, amount: 0 },
      [InvoiceBatchStatus.PAID]: { count: 0, amount: 0 },
      [InvoiceBatchStatus.CANCELLED]: { count: 0, amount: 0 }
    };

    entries.forEach(e => {
      counts[e.status].count++;
      counts[e.status].amount += e.invoiceAmount;
    });

    return counts;
  }, [entries]);

  const getAgingColor = (bucket: string) => {
    switch (bucket) {
      case '0-30': return { bg: 'var(--online-glow)', text: 'var(--online-core)' };
      case '31-60': return { bg: 'var(--energy-pulse)', text: 'var(--energy-core)' };
      case '61-90': return { bg: 'rgba(251, 146, 60, 0.1)', text: '#fb923c' };
      case '90+': return { bg: 'rgba(239, 68, 68, 0.1)', text: 'var(--critical-core)' };
      default: return { bg: 'var(--surface)', text: 'var(--text-secondary)' };
    }
  };

  const getStatusColor = (status: InvoiceBatchStatus) => {
    switch (status) {
      case InvoiceBatchStatus.SUBMITTED:
        return { bg: 'var(--neural-dim)', text: 'var(--neural-core)' };
      case InvoiceBatchStatus.APPROVED:
        return { bg: 'var(--online-glow)', text: 'var(--online-core)' };
      case InvoiceBatchStatus.DISPUTED:
        return { bg: 'rgba(251, 146, 60, 0.1)', text: '#fb923c' };
      case InvoiceBatchStatus.REJECTED:
        return { bg: 'rgba(239, 68, 68, 0.1)', text: 'var(--critical-core)' };
      case InvoiceBatchStatus.PAID:
        return { bg: 'rgba(34, 197, 94, 0.1)', text: '#22c55e' };
      default:
        return { bg: 'var(--surface)', text: 'var(--text-secondary)' };
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--void)' }}>
      {/* Header */}
      <header
        className="flex-shrink-0 px-8 py-6"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase text-gradient-neural">AR Tracker</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Track invoices from submission to payment
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.reload()}
              title="Refresh data"
              className="p-3 rounded-xl transition-all hover:scale-105"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
            >
              <RefreshCw className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
            </button>
            <button
              onClick={() => alert('Export feature coming soon')}
              title="Export data"
              className="p-3 rounded-xl transition-all hover:scale-105"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
            >
              <Download className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-ghost)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search invoice #, customer, project..."
              className="w-full pl-12 pr-4 py-3 rounded-xl text-sm font-medium focus:outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
            />
          </div>

          <div className="flex items-center gap-2">
            {[
              { status: 'all' as const, label: 'All' },
              { status: InvoiceBatchStatus.SUBMITTED, label: 'Submitted' },
              { status: InvoiceBatchStatus.APPROVED, label: 'Approved' },
              { status: InvoiceBatchStatus.DISPUTED, label: 'Disputed' }
            ].map(({ status, label }) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                style={{
                  background: selectedStatus === status ? 'var(--gradient-neural)' : 'var(--surface)',
                  color: selectedStatus === status ? 'var(--void)' : 'var(--text-tertiary)',
                  border: selectedStatus === status ? 'none' : '1px solid var(--border-default)'
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        {/* Aging Summary */}
        <AgingSummary entries={entries} />

        {/* Pipeline Overview */}
        <div className="space-y-4">
          <h2 className="text-lg font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Pipeline</h2>
          <div className="flex items-center gap-3">
            <PipelineCard
              status={InvoiceBatchStatus.SUBMITTED}
              count={statusCounts[InvoiceBatchStatus.SUBMITTED].count}
              amount={statusCounts[InvoiceBatchStatus.SUBMITTED].amount}
              color="neural"
            />
            <ArrowRight className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--text-ghost)' }} />
            <PipelineCard
              status={InvoiceBatchStatus.APPROVED}
              count={statusCounts[InvoiceBatchStatus.APPROVED].count}
              amount={statusCounts[InvoiceBatchStatus.APPROVED].amount}
              color="online"
            />
            <ArrowRight className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--text-ghost)' }} />
            <PipelineCard
              status={InvoiceBatchStatus.PAID}
              count={statusCounts[InvoiceBatchStatus.PAID].count}
              amount={statusCounts[InvoiceBatchStatus.PAID].amount}
              color="success"
            />
          </div>
        </div>

        {/* Invoice List */}
        <div className="space-y-4">
          <h2 className="text-lg font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Outstanding Invoices ({filteredEntries.length})
          </h2>

          <div className="space-y-3">
            {filteredEntries.map(entry => {
              const isOverdue = new Date(entry.dueDate) < new Date() &&
                entry.status !== InvoiceBatchStatus.PAID;
              const agingColor = getAgingColor(entry.agingBucket);
              const statusColor = getStatusColor(entry.status);

              return (
                <div
                  key={entry.invoiceBatchId}
                  className="p-5 rounded-2xl transition-all cursor-pointer group hover:scale-[1.005]"
                  style={{
                    background: isOverdue ? 'rgba(239, 68, 68, 0.05)' : 'var(--surface)',
                    border: isOverdue ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid var(--border-default)'
                  }}
                  onClick={() => onViewInvoice(entry.invoiceBatchId)}
                >
                  <div className="flex items-center gap-5">
                    {/* Invoice Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-black tracking-tight font-mono" style={{ color: 'var(--text-primary)' }}>
                          {entry.invoiceNumber}
                        </span>
                        <span
                          className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest"
                          style={{ background: statusColor.bg, color: statusColor.text }}
                        >
                          {entry.status}
                        </span>
                        {isOverdue && (
                          <span
                            className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest"
                            style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--critical-core)' }}
                          >
                            Overdue
                          </span>
                        )}
                      </div>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {entry.primeContractor} • {entry.projectName}
                      </p>
                      {entry.lastActivity && (
                        <p className="text-xs mt-2 flex items-center gap-1" style={{ color: 'var(--text-ghost)' }}>
                          <AlertTriangle className="w-3 h-3" />
                          {entry.lastActivity}
                        </p>
                      )}
                    </div>

                    {/* Amount */}
                    <div className="text-right">
                      <p className="text-2xl font-black tracking-tighter" style={{ color: 'var(--text-primary)' }}>
                        ${entry.invoiceAmount.toLocaleString()}
                      </p>
                      <p className="text-xs flex items-center justify-end gap-1 mt-1" style={{ color: 'var(--text-ghost)' }}>
                        <Calendar className="w-3 h-3" />
                        Due {new Date(entry.dueDate).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Days */}
                    <div
                      className="w-20 text-center p-4 rounded-xl"
                      style={{ background: agingColor.bg }}
                    >
                      <p className="text-3xl font-black tracking-tighter" style={{ color: agingColor.text }}>
                        {entry.daysOutstanding}
                      </p>
                      <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-ghost)' }}>Days</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); onViewInvoice(entry.invoiceBatchId); }}
                        className="p-2.5 rounded-xl transition-all hover:scale-110"
                        style={{ background: 'var(--elevated)', border: '1px solid var(--border-subtle)' }}
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                      </button>

                      {entry.status === InvoiceBatchStatus.APPROVED && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onRecordPayment(entry.invoiceBatchId); }}
                          className="p-2.5 rounded-xl transition-all hover:scale-110"
                          style={{ background: 'var(--online-glow)', border: '1px solid rgba(16, 185, 129, 0.2)' }}
                          title="Record Payment"
                        >
                          <CreditCard className="w-4 h-4" style={{ color: 'var(--online-core)' }} />
                        </button>
                      )}

                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="p-2.5 rounded-xl transition-all hover:scale-110"
                        style={{ background: 'var(--elevated)', border: '1px solid var(--border-subtle)' }}
                        title="More Options"
                      >
                        <MoreHorizontal className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredEntries.length === 0 && (
            <div className="text-center py-16">
              <div
                className="inline-flex p-4 rounded-2xl mb-4"
                style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
              >
                <CheckCircle className="w-12 h-12 opacity-30" style={{ color: 'var(--text-ghost)' }} />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-ghost)' }}>No outstanding invoices</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ARTracker;
