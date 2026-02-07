/**
 * RedlineList - Display and manage rate card redlines
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  GitBranch, Plus, Search, Filter, Clock, CheckCircle, XCircle,
  AlertCircle, Play, Eye, Edit2, Trash2, ChevronRight, Loader2,
  FileText, User as UserIcon
} from 'lucide-react';
import { User, Language } from '../../types';
import { Redline, RedlineStatus } from '../../types/redline';
import { redlineService } from '../../services/redlineService';

interface RedlineListProps {
  user: User;
  lang: Language;
  onSelectRedline?: (redline: Redline) => void;
  onCreateNew?: () => void;
}

const STATUS_CONFIG: Record<RedlineStatus, { label: string; color: string; icon: React.FC<any> }> = {
  draft: { label: 'Draft', color: 'var(--text-secondary)', icon: Edit2 },
  pending_review: { label: 'Pending Review', color: 'var(--energy-core)', icon: Clock },
  approved: { label: 'Approved', color: 'var(--online-core)', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'var(--critical-core)', icon: XCircle },
  applied: { label: 'Applied', color: 'var(--neural-core)', icon: Play }
};

const RedlineList: React.FC<RedlineListProps> = ({ user, lang, onSelectRedline, onCreateNew }) => {
  const [redlines, setRedlines] = useState<Redline[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<RedlineStatus | ''>('');
  const [error, setError] = useState<string | null>(null);

  // Load redlines
  const loadRedlines = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const filters = statusFilter ? { status: statusFilter } : undefined;
      const data = await redlineService.getRedlines(filters);
      setRedlines(data);
    } catch (err) {
      console.error('[RedlineList] Error loading redlines:', err);
      setError('Failed to load redlines');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadRedlines();
  }, [loadRedlines]);

  // Filter by search
  const filteredRedlines = redlines.filter(r => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      r.sourceProfileName?.toLowerCase().includes(query) ||
      r.sourceGroupName?.toLowerCase().includes(query) ||
      r.versionLabel?.toLowerCase().includes(query) ||
      r.srNumber?.toLowerCase().includes(query) ||
      r.changeSummary?.toLowerCase().includes(query)
    );
  });

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Get status badge
  const StatusBadge: React.FC<{ status: RedlineStatus }> = ({ status }) => {
    const config = STATUS_CONFIG[status];
    const Icon = config.icon;
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
        style={{ background: `${config.color}20`, color: config.color }}
      >
        <Icon className="w-3 h-3" />
        {config.label}
      </div>
    );
  };

  const canEdit = user.role === 'ADMIN' || user.role === 'SUPERVISOR' || user.role === 'REDLINE_SPECIALIST';

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--abyss)' }}>
      {/* Header */}
      <div className="p-6 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl" style={{ background: 'var(--neural-dim)' }}>
              <GitBranch className="w-6 h-6" style={{ color: 'var(--neural-core)' }} />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Rate Card Redlines
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Version control and approval workflow for rate changes
              </p>
            </div>
          </div>

          {canEdit && (
            <button
              onClick={onCreateNew}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all hover:scale-105"
              style={{ background: 'var(--gradient-neural)', color: '#000' }}
            >
              <Plus className="w-5 h-5" />
              New Redline
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-ghost)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search redlines..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-medium outline-none"
              style={{
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)'
              }}
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as RedlineStatus | '')}
            className="px-4 py-2.5 rounded-xl text-sm font-medium outline-none cursor-pointer"
            style={{
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)'
            }}
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="pending_review">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="applied">Applied</option>
          </select>

          {/* Refresh */}
          <button
            onClick={loadRedlines}
            className="p-2.5 rounded-xl transition-all"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
          >
            <Loader2 className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--neural-core)' }} />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <AlertCircle className="w-12 h-12" style={{ color: 'var(--critical-core)' }} />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{error}</p>
            <button
              onClick={loadRedlines}
              className="px-4 py-2 rounded-lg text-sm font-bold"
              style={{ background: 'var(--surface)', color: 'var(--text-primary)' }}
            >
              Retry
            </button>
          </div>
        ) : filteredRedlines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <GitBranch className="w-12 h-12" style={{ color: 'var(--text-ghost)' }} />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {searchQuery || statusFilter ? 'No redlines match your filters' : 'No redlines yet'}
            </p>
            {canEdit && !searchQuery && !statusFilter && (
              <button
                onClick={onCreateNew}
                className="px-4 py-2 rounded-lg text-sm font-bold"
                style={{ background: 'var(--neural-dim)', color: 'var(--neural-core)' }}
              >
                Create your first redline
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRedlines.map((redline) => (
              <div
                key={redline.id}
                onClick={() => onSelectRedline?.(redline)}
                className="p-4 rounded-xl cursor-pointer transition-all hover:scale-[1.01]"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border-default)'
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-base font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                        {redline.sourceProfileName || 'Unknown Profile'}
                      </h3>
                      <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'var(--elevated)', color: 'var(--text-tertiary)' }}>
                        {redline.versionLabel}
                      </span>
                    </div>

                    <p className="text-sm mb-3 truncate" style={{ color: 'var(--text-secondary)' }}>
                      {redline.sourceGroupName || 'Unknown Group'}
                    </p>

                    {redline.changeSummary && (
                      <p className="text-xs mb-3 line-clamp-2" style={{ color: 'var(--text-tertiary)' }}>
                        {redline.changeSummary}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-ghost)' }}>
                      <span className="flex items-center gap-1">
                        <UserIcon className="w-3 h-3" />
                        {redline.createdByName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(redline.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {redline.proposedChanges.length} changes
                      </span>
                      {redline.srNumber && (
                        <span className="font-mono">{redline.srNumber}</span>
                      )}
                    </div>
                  </div>

                  {/* Right: Status & Action */}
                  <div className="flex items-center gap-3">
                    <StatusBadge status={redline.status} />
                    <ChevronRight className="w-5 h-5" style={{ color: 'var(--text-ghost)' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RedlineList;
