/**
 * Production Inbox - Main working area for billing team
 * Tesla/SpaceX/Nothing/B&O inspired premium design
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Search, Filter, RefreshCw, Download, ChevronDown,
  CheckSquare, Square, AlertTriangle, Camera, MapPin,
  Calendar, Users, Clock, Eye, FileText, Plus,
  ChevronRight, MoreHorizontal, Zap
} from 'lucide-react';
import {
  ProductionLine,
  ProductionLineStatus,
  ProductionLineFilters,
  ComplianceScore
} from '../../types/billing';

// ============================================
// PRODUCTION LINES - Empty array, ready for real data
// ============================================

const MOCK_LINES: ProductionLine[] = [];

// ============================================
// SUB-COMPONENTS
// ============================================

interface StatusBadgeProps {
  status: ProductionLineStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const configs: Record<ProductionLineStatus, { bg: string; text: string; label: string }> = {
    [ProductionLineStatus.NEW]: { bg: 'var(--elevated)', text: 'var(--text-secondary)', label: 'New' },
    [ProductionLineStatus.PENDING_REVIEW]: { bg: 'var(--energy-pulse)', text: 'var(--energy-core)', label: 'Pending' },
    [ProductionLineStatus.REVIEWED]: { bg: 'var(--neural-dim)', text: 'var(--neural-core)', label: 'Reviewed' },
    [ProductionLineStatus.NEEDS_INFO]: { bg: 'rgba(251, 146, 60, 0.1)', text: '#fb923c', label: 'Needs Info' },
    [ProductionLineStatus.READY_TO_INVOICE]: { bg: 'var(--online-glow)', text: 'var(--online-core)', label: 'Ready' },
    [ProductionLineStatus.INVOICED]: { bg: 'var(--energy-pulse)', text: 'var(--energy-core)', label: 'Invoiced' },
    [ProductionLineStatus.ON_HOLD]: { bg: 'var(--elevated)', text: 'var(--text-tertiary)', label: 'On Hold' },
    [ProductionLineStatus.REJECTED]: { bg: 'rgba(239, 68, 68, 0.1)', text: 'var(--critical-core)', label: 'Rejected' },
    [ProductionLineStatus.PAID]: { bg: 'var(--online-glow)', text: 'var(--online-core)', label: 'Paid' },
  };

  const config = configs[status];

  return (
    <span
      className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest"
      style={{ background: config.bg, color: config.text }}
    >
      {config.label}
    </span>
  );
};

interface ComplianceIndicatorProps {
  score: number;
}

const ComplianceIndicator: React.FC<ComplianceIndicatorProps> = ({ score }) => {
  const getColor = (s: number) => {
    if (s >= 90) return 'var(--online-core)';
    if (s >= 70) return 'var(--energy-core)';
    return 'var(--critical-core)';
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className="w-16 h-1.5 rounded-full overflow-hidden"
        style={{ background: 'var(--elevated)' }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${score}%`, background: getColor(score) }}
        />
      </div>
      <span className="text-xs font-bold" style={{ color: getColor(score) }}>{score}%</span>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

interface ProductionInboxProps {
  onOpenReview: (lineId: string) => void;
  onCreateBatch: (lineIds: string[]) => void;
}

const ProductionInbox: React.FC<ProductionInboxProps> = ({
  onOpenReview,
  onCreateBatch
}) => {
  const [lines, setLines] = useState<ProductionLine[]>(MOCK_LINES);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<ProductionLineFilters>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Computed
  const filteredLines = useMemo(() => {
    return lines.filter(line => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !line.jobId.toLowerCase().includes(q) &&
          !line.description.toLowerCase().includes(q) &&
          !line.crewName.toLowerCase().includes(q)
        ) {
          return false;
        }
      }

      if (filters.status && filters.status.length > 0) {
        if (!filters.status.includes(line.status)) return false;
      }

      if (filters.projectId && line.projectId !== filters.projectId) return false;
      if (filters.primeContractor && line.primeContractor !== filters.primeContractor) return false;

      return true;
    });
  }, [lines, filters, searchQuery]);

  const selectedLines = useMemo(() => {
    return filteredLines.filter(l => selectedIds.has(l.id));
  }, [filteredLines, selectedIds]);

  const canCreateBatch = useMemo(() => {
    return selectedLines.length > 0 &&
      selectedLines.every(l => l.status === ProductionLineStatus.READY_TO_INVOICE);
  }, [selectedLines]);

  // Handlers
  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredLines.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLines.map(l => l.id)));
    }
  }, [filteredLines, selectedIds]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    setIsLoading(false);
  }, []);

  const handleCreateBatch = useCallback(() => {
    if (canCreateBatch) {
      onCreateBatch(Array.from(selectedIds));
    }
  }, [canCreateBatch, selectedIds, onCreateBatch]);

  // Stats
  const stats = useMemo(() => ({
    total: filteredLines.length,
    readyToInvoice: filteredLines.filter(l => l.status === ProductionLineStatus.READY_TO_INVOICE).length,
    pendingReview: filteredLines.filter(l => l.status === ProductionLineStatus.PENDING_REVIEW).length,
    withIssues: filteredLines.filter(l => l.flags.length > 0).length,
    totalValue: filteredLines.reduce((sum, l) => sum + (l.extendedAmount || 0), 0),
  }), [filteredLines]);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--void)' }}>
      {/* Header */}
      <header
        className="flex-shrink-0 px-8 py-6"
        style={{ background: 'var(--void)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase text-gradient-neural">Production Inbox</h1>
            <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-secondary)' }}>
              {stats.total} lines • ${stats.totalValue.toLocaleString()} potential billing
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-3 rounded-xl transition-all duration-300 hover:scale-105 disabled:opacity-50"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} style={{ color: 'var(--text-tertiary)' }} />
            </button>

            <button
              onClick={() => alert('Export feature coming soon')}
              title="Export data"
              className="p-3 rounded-xl transition-all duration-300 hover:scale-105"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
            >
              <Download className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
            </button>

            {selectedIds.size > 0 && (
              <button
                onClick={handleCreateBatch}
                disabled={!canCreateBatch}
                className="px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all duration-300"
                style={{
                  background: canCreateBatch ? 'var(--gradient-neural)' : 'var(--surface)',
                  color: canCreateBatch ? 'var(--void)' : 'var(--text-ghost)',
                  boxShadow: canCreateBatch ? 'var(--shadow-neural)' : 'none',
                  cursor: canCreateBatch ? 'pointer' : 'not-allowed'
                }}
              >
                <Plus className="w-4 h-4" />
                Create Batch ({selectedIds.size})
              </button>
            )}
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
              placeholder="Search by Job ID, description, or crew..."
              className="w-full pl-12 pr-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 focus:outline-none"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border-default)',
                color: 'var(--text-primary)'
              }}
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all duration-300"
            style={{
              background: showFilters ? 'var(--neural-dim)' : 'var(--surface)',
              border: showFilters ? '1px solid var(--border-neural)' : '1px solid var(--border-default)',
              color: showFilters ? 'var(--neural-core)' : 'var(--text-tertiary)'
            }}
          >
            <Filter className="w-4 h-4" />
            Filters
            {Object.keys(filters).length > 0 && (
              <span
                className="px-1.5 py-0.5 rounded text-[9px]"
                style={{ background: 'var(--neural-core)', color: 'var(--void)' }}
              >
                {Object.keys(filters).length}
              </span>
            )}
          </button>

          {/* Status Quick Filters */}
          <div className="flex items-center gap-2">
            {[
              { status: ProductionLineStatus.PENDING_REVIEW, label: 'Pending', count: stats.pendingReview },
              { status: ProductionLineStatus.READY_TO_INVOICE, label: 'Ready', count: stats.readyToInvoice },
            ].map(({ status, label, count }) => (
              <button
                key={status}
                onClick={() => setFilters(f => ({
                  ...f,
                  status: f.status?.includes(status) ? undefined : [status]
                }))}
                className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all duration-300"
                style={{
                  background: filters.status?.includes(status) ? 'var(--gradient-neural)' : 'var(--surface)',
                  color: filters.status?.includes(status) ? 'var(--void)' : 'var(--text-tertiary)',
                  border: filters.status?.includes(status) ? 'none' : '1px solid var(--border-default)'
                }}
              >
                {label}
                <span
                  className="px-1.5 rounded"
                  style={{
                    background: filters.status?.includes(status) ? 'rgba(0,0,0,0.2)' : 'var(--elevated)'
                  }}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 z-10" style={{ background: 'var(--deep)' }}>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <th className="w-12 px-4 py-4 text-left">
                <button
                  onClick={toggleSelectAll}
                  className="p-1 rounded transition-colors"
                  style={{ color: selectedIds.size === filteredLines.length && filteredLines.length > 0 ? 'var(--neural-core)' : 'var(--text-ghost)' }}
                >
                  {selectedIds.size === filteredLines.length && filteredLines.length > 0 ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </th>
              <th className="px-4 py-4 text-left text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-ghost)' }}>
                Job / Description
              </th>
              <th className="px-4 py-4 text-left text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-ghost)' }}>
                Project / Crew
              </th>
              <th className="px-4 py-4 text-right text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-ghost)' }}>
                Qty / Amount
              </th>
              <th className="px-4 py-4 text-center text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-ghost)' }}>
                Evidence
              </th>
              <th className="px-4 py-4 text-center text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-ghost)' }}>
                Compliance
              </th>
              <th className="px-4 py-4 text-center text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-ghost)' }}>
                Status
              </th>
              <th className="w-24 px-4 py-4"></th>
            </tr>
          </thead>
          <tbody>
            {filteredLines.map((line) => (
              <tr
                key={line.id}
                className="group transition-colors cursor-pointer"
                style={{
                  borderBottom: '1px solid var(--border-subtle)',
                  background: selectedIds.has(line.id) ? 'var(--neural-dim)' : 'transparent'
                }}
                onClick={() => onOpenReview(line.id)}
              >
                <td className="px-4 py-4">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelect(line.id); }}
                    className="p-1 rounded transition-colors"
                    style={{ color: selectedIds.has(line.id) ? 'var(--neural-core)' : 'var(--text-ghost)' }}
                  >
                    {selectedIds.has(line.id) ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </td>

                <td className="px-4 py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
                          {line.jobId}
                        </span>
                        {line.flags.length > 0 && (
                          <AlertTriangle className="w-4 h-4" style={{ color: 'var(--energy-core)' }} />
                        )}
                      </div>
                      <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        {line.description}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-[10px]" style={{ color: 'var(--text-ghost)' }}>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(line.workDate).toLocaleDateString()}
                        </span>
                        {line.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {line.location.address || 'GPS'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>

                <td className="px-4 py-4">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{line.projectName}</p>
                  <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    <Users className="w-3 h-3" />
                    {line.crewName}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-ghost)' }}>
                    {line.primeContractor}
                  </p>
                </td>

                <td className="px-4 py-4 text-right">
                  <p className="text-sm font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    {line.quantity.toLocaleString()} {line.unit}
                  </p>
                  {line.extendedAmount && (
                    <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--online-core)' }}>
                      ${line.extendedAmount.toLocaleString()}
                    </p>
                  )}
                  {line.appliedRate && (
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-ghost)' }}>
                      @ ${line.appliedRate}/{line.unit}
                    </p>
                  )}
                </td>

                <td className="px-4 py-4">
                  <div className="flex items-center justify-center gap-1">
                    <Camera className="w-4 h-4" style={{ color: line.hasRequiredEvidence ? 'var(--online-core)' : 'var(--energy-core)' }} />
                    <span className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>{line.evidenceCount}</span>
                  </div>
                </td>

                <td className="px-4 py-4">
                  <div className="flex justify-center">
                    <ComplianceIndicator score={line.complianceScore} />
                  </div>
                </td>

                <td className="px-4 py-4">
                  <div className="flex justify-center">
                    <StatusBadge status={line.status} />
                  </div>
                </td>

                <td className="px-4 py-4">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenReview(line.id); }}
                      className="p-2 rounded-lg transition-all hover:scale-110"
                      style={{ background: 'var(--surface)' }}
                      title="Review"
                    >
                      <Eye className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                    </button>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 rounded-lg transition-all hover:scale-110"
                      style={{ background: 'var(--surface)' }}
                      title="More actions"
                    >
                      <MoreHorizontal className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredLines.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20" style={{ color: 'var(--text-ghost)' }}>
            <div
              className="p-4 rounded-2xl mb-4"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
            >
              <Zap className="w-12 h-12 opacity-50" />
            </div>
            <p className="text-sm font-medium">No production lines match your filters</p>
            <button
              onClick={() => { setFilters({}); setSearchQuery(''); }}
              className="mt-3 text-xs font-black uppercase tracking-widest transition-colors"
              style={{ color: 'var(--neural-core)' }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <footer
        className="flex-shrink-0 px-8 py-4"
        style={{ background: 'var(--deep)', borderTop: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6 text-xs" style={{ color: 'var(--text-ghost)' }}>
            <span>
              <strong style={{ color: 'var(--text-primary)' }}>{filteredLines.length}</strong> lines shown
            </span>
            <span>
              <strong style={{ color: 'var(--online-core)' }}>${stats.totalValue.toLocaleString()}</strong> total value
            </span>
            {stats.withIssues > 0 && (
              <span style={{ color: 'var(--energy-core)' }}>
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                {stats.withIssues} with issues
              </span>
            )}
          </div>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-4 text-xs">
              <span style={{ color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>{selectedIds.size}</strong> selected
              </span>
              <span className="font-bold" style={{ color: 'var(--online-core)' }}>
                ${selectedLines.reduce((s, l) => s + (l.extendedAmount || 0), 0).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
};

export default ProductionInbox;
