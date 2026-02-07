/**
 * AuditTab - Audit log viewer (Admin/Supervisor only)
 * View system activity with filters and pagination
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
    FileText, Search, Filter, Calendar, User as UserIcon, CheckCircle, XCircle,
    Loader2, ChevronDown, ChevronUp, RefreshCw, Download
} from 'lucide-react';
import { User, Language } from '../../../types';
import { translations } from '../../../services/translations';
import { auditService } from '../../../services/settingsService';
import { AuditEvent, AuditLogFilters, AuditAction, AuditEntityType } from '../../../types/settings';

interface AuditTabProps {
    user: User;
    lang: Language;
}

// Action display configuration
const ACTION_CONFIG: Record<AuditAction, { label: string; color: string }> = {
    login: { label: 'Login', color: '#10B981' },
    logout: { label: 'Logout', color: '#6B7280' },
    password_change: { label: 'Password Change', color: '#F59E0B' },
    profile_update: { label: 'Profile Update', color: '#3B82F6' },
    preferences_update: { label: 'Preferences Update', color: '#3B82F6' },
    user_invite: { label: 'User Invited', color: '#8B5CF6' },
    user_role_change: { label: 'Role Changed', color: '#8B5CF6' },
    user_deactivate: { label: 'User Deactivated', color: '#EF4444' },
    user_reactivate: { label: 'User Reactivated', color: '#10B981' },
    session_revoke: { label: 'Session Revoked', color: '#F59E0B' },
    job_create: { label: 'Job Created', color: '#10B981' },
    job_update: { label: 'Job Updated', color: '#3B82F6' },
    job_delete: { label: 'Job Deleted', color: '#EF4444' },
    rate_card_import: { label: 'Rate Card Import', color: '#8B5CF6' },
    rate_card_update: { label: 'Rate Card Update', color: '#3B82F6' },
    production_submit: { label: 'Production Submitted', color: '#10B981' }
};

// Entity type labels
const ENTITY_LABELS: Record<AuditEntityType, string> = {
    user: 'User',
    session: 'Session',
    job: 'Job',
    rate_card: 'Rate Card',
    production: 'Production',
    organization: 'Organization',
    system: 'System'
};

const AuditTab: React.FC<AuditTabProps> = ({ user, lang }) => {
    const t = translations[lang];

    // Audit state
    const [events, setEvents] = useState<AuditEvent[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Filters
    const [filters, setFilters] = useState<AuditLogFilters>({});
    const [showFilters, setShowFilters] = useState(false);
    const [actionFilter, setActionFilter] = useState<AuditAction | ''>('');
    const [entityFilter, setEntityFilter] = useState<AuditEntityType | ''>('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Expanded row
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    const pageSize = 20;

    // Load audit log
    const loadAuditLog = useCallback(async (isRefresh = false) => {
        if (isRefresh) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }

        try {
            const appliedFilters: AuditLogFilters = {
                ...filters,
                action: actionFilter || undefined,
                entityType: entityFilter || undefined,
                startDate: dateFrom || undefined,
                endDate: dateTo || undefined
            };

            const result = await auditService.getAuditLog(appliedFilters, page, pageSize);
            setEvents(result.events);
            setTotal(result.total);
        } catch (error) {
            console.error('[AuditTab] Error loading audit log:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [filters, page, actionFilter, entityFilter, dateFrom, dateTo]);

    useEffect(() => {
        loadAuditLog();
    }, [loadAuditLog]);

    // Apply filters
    const applyFilters = useCallback(() => {
        setPage(1);
        loadAuditLog();
        setShowFilters(false);
    }, [loadAuditLog]);

    // Clear filters
    const clearFilters = useCallback(() => {
        setActionFilter('');
        setEntityFilter('');
        setDateFrom('');
        setDateTo('');
        setFilters({});
        setPage(1);
    }, []);

    // Format timestamp
    const formatTimestamp = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString(lang === Language.PT ? 'pt-BR' : lang === Language.ES ? 'es-ES' : 'en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    // Get action config
    const getActionConfig = (action: string) => {
        return ACTION_CONFIG[action as AuditAction] || { label: action, color: '#6B7280' };
    };

    // Calculate pagination
    const totalPages = Math.ceil(total / pageSize);
    const hasActiveFilters = actionFilter || entityFilter || dateFrom || dateTo;

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl" style={{ background: 'var(--neural-dim)' }}>
                        <FileText className="w-6 h-6" style={{ color: 'var(--neural-core)' }} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
                            {(t as any).audit_log || 'Audit Log'}
                        </h2>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            {total} {(t as any).events || 'events'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => loadAuditLog(true)}
                        disabled={isRefreshing}
                        className="p-2.5 rounded-xl transition-colors"
                        style={{ background: 'var(--elevated)' }}
                    >
                        <RefreshCw
                            className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
                            style={{ color: 'var(--text-tertiary)' }}
                        />
                    </button>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="px-4 py-2.5 rounded-xl font-semibold text-xs flex items-center gap-2 transition-colors"
                        style={{
                            background: hasActiveFilters ? 'var(--neural-dim)' : 'var(--elevated)',
                            color: hasActiveFilters ? 'var(--neural-core)' : 'var(--text-secondary)'
                        }}
                    >
                        <Filter className="w-4 h-4" />
                        Filters
                        {hasActiveFilters && (
                            <span
                                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                                style={{ background: 'var(--neural-core)', color: '#ffffff' }}
                            >
                                {[actionFilter, entityFilter, dateFrom, dateTo].filter(Boolean).length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Filters Panel */}
            {showFilters && (
                <div
                    className="p-4 rounded-xl space-y-4"
                    style={{ background: 'var(--elevated)', border: '1px solid var(--border-subtle)' }}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Action Filter */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-ghost)' }}>
                                Action
                            </label>
                            <select
                                value={actionFilter}
                                onChange={(e) => setActionFilter(e.target.value as AuditAction | '')}
                                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                                style={{
                                    background: 'var(--deep)',
                                    border: '1px solid var(--border-default)',
                                    color: 'var(--text-primary)'
                                }}
                            >
                                <option value="">All Actions</option>
                                {Object.entries(ACTION_CONFIG).map(([key, config]) => (
                                    <option key={key} value={key}>{config.label}</option>
                                ))}
                            </select>
                        </div>
                        {/* Entity Filter */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-ghost)' }}>
                                Entity Type
                            </label>
                            <select
                                value={entityFilter}
                                onChange={(e) => setEntityFilter(e.target.value as AuditEntityType | '')}
                                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                                style={{
                                    background: 'var(--deep)',
                                    border: '1px solid var(--border-default)',
                                    color: 'var(--text-primary)'
                                }}
                            >
                                <option value="">All Entities</option>
                                {Object.entries(ENTITY_LABELS).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </div>
                        {/* Date From */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-ghost)' }}>
                                From Date
                            </label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                                style={{
                                    background: 'var(--deep)',
                                    border: '1px solid var(--border-default)',
                                    color: 'var(--text-primary)'
                                }}
                            />
                        </div>
                        {/* Date To */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-ghost)' }}>
                                To Date
                            </label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                                style={{
                                    background: 'var(--deep)',
                                    border: '1px solid var(--border-default)',
                                    color: 'var(--text-primary)'
                                }}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={clearFilters}
                            className="px-4 py-2 rounded-lg text-xs font-semibold"
                            style={{ color: 'var(--text-tertiary)' }}
                        >
                            Clear
                        </button>
                        <button
                            onClick={applyFilters}
                            className="px-4 py-2 rounded-lg text-xs font-semibold"
                            style={{ background: 'var(--neural-core)', color: '#ffffff' }}
                        >
                            Apply Filters
                        </button>
                    </div>
                </div>
            )}

            {/* Audit Log Table */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--neural-core)' }} />
                </div>
            ) : events.length === 0 ? (
                <div className="text-center py-16 rounded-xl" style={{ border: '2px dashed var(--border-default)' }}>
                    <FileText className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-ghost)' }} />
                    <p className="font-semibold" style={{ color: 'var(--text-tertiary)' }}>
                        {hasActiveFilters ? 'No events match your filters' : 'No audit events yet'}
                    </p>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-ghost)' }}>
                        {hasActiveFilters ? 'Try adjusting your filters' : 'Activity will appear here'}
                    </p>
                </div>
            ) : (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
                    <table className="w-full">
                        <thead>
                            <tr style={{ background: 'var(--elevated)' }}>
                                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-ghost)' }}>Time</th>
                                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-ghost)' }}>User</th>
                                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-ghost)' }}>Action</th>
                                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider hidden md:table-cell" style={{ color: 'var(--text-ghost)' }}>Entity</th>
                                <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-ghost)' }}>Status</th>
                                <th className="px-4 py-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.map((event, idx) => {
                                const actionConfig = getActionConfig(event.action);
                                const isExpanded = expandedRow === event.id;

                                return (
                                    <React.Fragment key={event.id}>
                                        <tr
                                            className="transition-colors hover:bg-white/5 cursor-pointer"
                                            style={{ borderTop: idx > 0 ? '1px solid var(--border-subtle)' : undefined }}
                                            onClick={() => setExpandedRow(isExpanded ? null : event.id)}
                                        >
                                            {/* Time */}
                                            <td className="px-4 py-3">
                                                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                                    {formatTimestamp(event.createdAt)}
                                                </span>
                                            </td>
                                            {/* User */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold uppercase shrink-0"
                                                        style={{ background: 'var(--neural-dim)', color: 'var(--neural-core)' }}
                                                    >
                                                        {event.userEmail.charAt(0)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                                            {event.userEmail.split('@')[0]}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            {/* Action */}
                                            <td className="px-4 py-3">
                                                <span
                                                    className="px-2 py-1 rounded text-[10px] font-bold uppercase"
                                                    style={{ background: `${actionConfig.color}20`, color: actionConfig.color }}
                                                >
                                                    {actionConfig.label}
                                                </span>
                                            </td>
                                            {/* Entity */}
                                            <td className="px-4 py-3 hidden md:table-cell">
                                                <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                                                    {ENTITY_LABELS[event.entityType as AuditEntityType] || event.entityType}
                                                    {event.entityId && (
                                                        <span className="text-[10px] ml-1" style={{ color: 'var(--text-ghost)' }}>
                                                            #{event.entityId.slice(0, 8)}
                                                        </span>
                                                    )}
                                                </span>
                                            </td>
                                            {/* Status */}
                                            <td className="px-4 py-3 text-center">
                                                {event.isSuccess ? (
                                                    <CheckCircle className="w-4 h-4 mx-auto" style={{ color: '#10B981' }} />
                                                ) : (
                                                    <XCircle className="w-4 h-4 mx-auto" style={{ color: '#EF4444' }} />
                                                )}
                                            </td>
                                            {/* Expand */}
                                            <td className="px-4 py-3">
                                                {isExpanded ? (
                                                    <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                                                ) : (
                                                    <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                                                )}
                                            </td>
                                        </tr>
                                        {/* Expanded Details */}
                                        {isExpanded && (
                                            <tr style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                                <td colSpan={6} className="px-4 py-4" style={{ background: 'var(--elevated)' }}>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                                        <div>
                                                            <p className="text-[10px] font-bold uppercase mb-1" style={{ color: 'var(--text-ghost)' }}>Full Email</p>
                                                            <p style={{ color: 'var(--text-secondary)' }}>{event.userEmail}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-bold uppercase mb-1" style={{ color: 'var(--text-ghost)' }}>IP Address</p>
                                                            <p style={{ color: 'var(--text-secondary)' }}>{event.ipAddress || 'N/A'}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-bold uppercase mb-1" style={{ color: 'var(--text-ghost)' }}>User Role</p>
                                                            <p style={{ color: 'var(--text-secondary)' }}>{event.userRole || 'N/A'}</p>
                                                        </div>
                                                        {event.errorMessage && (
                                                            <div className="md:col-span-3">
                                                                <p className="text-[10px] font-bold uppercase mb-1" style={{ color: '#EF4444' }}>Error</p>
                                                                <p style={{ color: '#EF4444' }}>{event.errorMessage}</p>
                                                            </div>
                                                        )}
                                                        {(event.oldValues || event.newValues) && (
                                                            <div className="md:col-span-3">
                                                                <p className="text-[10px] font-bold uppercase mb-1" style={{ color: 'var(--text-ghost)' }}>Changes</p>
                                                                <pre
                                                                    className="text-xs p-2 rounded-lg overflow-x-auto"
                                                                    style={{ background: 'var(--deep)', color: 'var(--text-secondary)' }}
                                                                >
                                                                    {JSON.stringify({ old: event.oldValues, new: event.newValues }, null, 2)}
                                                                </pre>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                    <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                        Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} of {total}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
                            style={{ background: 'var(--elevated)', color: 'var(--text-secondary)' }}
                        >
                            Previous
                        </button>
                        <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                            {page} / {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
                            style={{ background: 'var(--elevated)', color: 'var(--text-secondary)' }}
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditTab;
