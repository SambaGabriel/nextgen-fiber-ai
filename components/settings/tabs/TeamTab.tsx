/**
 * TeamTab - Team & roles management section (Admin only)
 * User list, invite, role management, deactivation
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
    Users, UserPlus, Shield, Mail, Search, Filter, MoreHorizontal,
    X, Check, Loader2, AlertCircle, CheckCircle, RefreshCw, Key
} from 'lucide-react';
import { User, Language } from '../../../types';
import { translations } from '../../../services/translations';
import { teamService } from '../../../services/settingsService';
import { TeamMember, UserRole, InviteUserRequest } from '../../../types/settings';

interface TeamTabProps {
    user: User;
    lang: Language;
}

// Role configuration
const ROLES: Array<{ value: UserRole; label: string; color: { bg: string; text: string }; description: string }> = [
    { value: 'admin', label: 'Admin', color: { bg: 'rgba(139, 92, 246, 0.2)', text: '#8B5CF6' }, description: 'Full system access' },
    { value: 'supervisor', label: 'Supervisor', color: { bg: 'rgba(59, 130, 246, 0.2)', text: '#3B82F6' }, description: 'Manage jobs, maps, rate cards' },
    { value: 'billing', label: 'Billing', color: { bg: 'rgba(245, 158, 11, 0.2)', text: '#F59E0B' }, description: 'View financials, invoices' },
    { value: 'viewer', label: 'Viewer', color: { bg: 'rgba(107, 114, 128, 0.2)', text: '#6B7280' }, description: 'Read-only access' },
    { value: 'lineman', label: 'Lineman', color: { bg: 'rgba(16, 185, 129, 0.2)', text: '#10B981' }, description: 'Field work, own jobs' }
];

const TeamTab: React.FC<TeamTabProps> = ({ user, lang }) => {
    const t = translations[lang];

    // Team state
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

    // Modal state
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteForm, setInviteForm] = useState<InviteUserRequest>({
        email: '',
        firstName: '',
        lastName: '',
        role: 'lineman'
    });
    const [inviteError, setInviteError] = useState('');
    const [isInviting, setIsInviting] = useState(false);

    // Action state
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

    // Load team members
    const loadTeam = useCallback(async () => {
        setIsLoading(true);
        try {
            const members = await teamService.getTeamMembers();
            setTeamMembers(members);
        } catch (error) {
            console.error('[TeamTab] Error loading team:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTeam();
    }, [loadTeam]);

    // Filter members
    const filteredMembers = teamMembers.filter(member => {
        // Search filter
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = !searchQuery ||
            member.firstName.toLowerCase().includes(searchLower) ||
            member.lastName.toLowerCase().includes(searchLower) ||
            member.email.toLowerCase().includes(searchLower);

        // Role filter
        const matchesRole = roleFilter === 'all' || member.role === roleFilter;

        // Status filter
        const matchesStatus = statusFilter === 'all' ||
            (statusFilter === 'active' && member.isActive) ||
            (statusFilter === 'inactive' && !member.isActive);

        return matchesSearch && matchesRole && matchesStatus;
    });

    // Handle invite
    const handleInvite = useCallback(async () => {
        setInviteError('');

        // Validation
        if (!inviteForm.email || !inviteForm.email.includes('@')) {
            setInviteError('Please enter a valid email address');
            return;
        }
        if (!inviteForm.firstName || !inviteForm.lastName) {
            setInviteError('Please enter first and last name');
            return;
        }

        setIsInviting(true);
        try {
            const result = await teamService.inviteUser(inviteForm);
            if (result.success) {
                setShowInviteModal(false);
                setInviteForm({ email: '', firstName: '', lastName: '', role: 'lineman' });
                await loadTeam();
            } else {
                setInviteError(result.message);
            }
        } catch (error: any) {
            setInviteError(error.message || 'Failed to invite user');
        } finally {
            setIsInviting(false);
        }
    }, [inviteForm, loadTeam]);

    // Handle role change
    const handleRoleChange = useCallback(async (memberId: string, newRole: UserRole) => {
        setActionLoading(memberId);
        try {
            await teamService.updateUserRole({ userId: memberId, role: newRole });
            setTeamMembers(prev => prev.map(m =>
                m.id === memberId ? { ...m, role: newRole } : m
            ));
        } catch (error) {
            console.error('[TeamTab] Error changing role:', error);
        } finally {
            setActionLoading(null);
            setActionMenuOpen(null);
        }
    }, []);

    // Handle deactivate
    const handleDeactivate = useCallback(async (memberId: string) => {
        if (!confirm('Are you sure you want to deactivate this user? They will no longer be able to access the system.')) {
            return;
        }

        setActionLoading(memberId);
        try {
            await teamService.deactivateUser(memberId);
            setTeamMembers(prev => prev.map(m =>
                m.id === memberId ? { ...m, isActive: false } : m
            ));
        } catch (error) {
            console.error('[TeamTab] Error deactivating user:', error);
        } finally {
            setActionLoading(null);
            setActionMenuOpen(null);
        }
    }, []);

    // Handle reactivate
    const handleReactivate = useCallback(async (memberId: string) => {
        setActionLoading(memberId);
        try {
            await teamService.reactivateUser(memberId);
            setTeamMembers(prev => prev.map(m =>
                m.id === memberId ? { ...m, isActive: true } : m
            ));
        } catch (error) {
            console.error('[TeamTab] Error reactivating user:', error);
        } finally {
            setActionLoading(null);
            setActionMenuOpen(null);
        }
    }, []);

    // Handle password reset
    const handlePasswordReset = useCallback(async (email: string) => {
        setActionLoading(email);
        try {
            await teamService.sendUserPasswordReset(email);
            alert('Password reset email sent');
        } catch (error) {
            console.error('[TeamTab] Error sending reset:', error);
        } finally {
            setActionLoading(null);
            setActionMenuOpen(null);
        }
    }, []);

    // Get role color
    const getRoleColor = (role: UserRole) => {
        return ROLES.find(r => r.value === role)?.color || ROLES[4].color;
    };

    return (
        <div className="space-y-8 animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl" style={{ background: 'var(--neural-dim)' }}>
                        <Users className="w-6 h-6" style={{ color: 'var(--neural-core)' }} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
                            {(t as any).team_roles || 'Team & Roles'}
                        </h2>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            {teamMembers.length} {(t as any).team_members || 'team members'}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setShowInviteModal(true)}
                    className="px-4 py-2.5 rounded-xl font-bold uppercase text-xs flex items-center gap-2 transition-all active:scale-95"
                    style={{
                        background: 'var(--gradient-neural)',
                        color: '#ffffff',
                        boxShadow: 'var(--shadow-neural)'
                    }}
                >
                    <UserPlus className="w-4 h-4" />
                    Invite User
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-ghost)' }} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name or email..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none"
                        style={{
                            background: 'var(--deep)',
                            border: '1px solid var(--border-default)',
                            color: 'var(--text-primary)'
                        }}
                    />
                </div>
                {/* Role Filter */}
                <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
                    className="px-4 py-2.5 rounded-xl text-sm outline-none cursor-pointer"
                    style={{
                        background: 'var(--deep)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)'
                    }}
                >
                    <option value="all">All Roles</option>
                    {ROLES.map(role => (
                        <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                </select>
                {/* Status Filter */}
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                    className="px-4 py-2.5 rounded-xl text-sm outline-none cursor-pointer"
                    style={{
                        background: 'var(--deep)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)'
                    }}
                >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
            </div>

            {/* Team List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--neural-core)' }} />
                </div>
            ) : filteredMembers.length === 0 ? (
                <div className="text-center py-16 rounded-xl" style={{ border: '2px dashed var(--border-default)' }}>
                    <Users className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-ghost)' }} />
                    <p className="font-semibold" style={{ color: 'var(--text-tertiary)' }}>
                        {searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
                            ? 'No users match your filters'
                            : 'No team members yet'}
                    </p>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-ghost)' }}>
                        {searchQuery || roleFilter !== 'all' || statusFilter !== 'all'
                            ? 'Try adjusting your search or filters'
                            : 'Invite your first team member to get started'}
                    </p>
                </div>
            ) : (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
                    <table className="w-full">
                        <thead>
                            <tr style={{ background: 'var(--elevated)' }}>
                                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-ghost)' }}>User</th>
                                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-ghost)' }}>Role</th>
                                <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider hidden md:table-cell" style={{ color: 'var(--text-ghost)' }}>Status</th>
                                <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-ghost)' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredMembers.map((member, idx) => {
                                const roleColor = getRoleColor(member.role);
                                const isCurrentUser = member.id === user.id;

                                return (
                                    <tr
                                        key={member.id}
                                        className="transition-colors hover:bg-white/5"
                                        style={{ borderTop: idx > 0 ? '1px solid var(--border-subtle)' : undefined }}
                                    >
                                        {/* User Info */}
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold uppercase shrink-0"
                                                    style={{ background: 'var(--neural-dim)', color: 'var(--neural-core)' }}
                                                >
                                                    {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                                                        {member.firstName} {member.lastName}
                                                        {isCurrentUser && (
                                                            <span className="ml-2 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: 'var(--neural-dim)', color: 'var(--neural-core)' }}>
                                                                You
                                                            </span>
                                                        )}
                                                    </p>
                                                    <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>{member.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        {/* Role */}
                                        <td className="px-4 py-4">
                                            <select
                                                value={member.role}
                                                onChange={(e) => handleRoleChange(member.id, e.target.value as UserRole)}
                                                disabled={isCurrentUser || actionLoading === member.id}
                                                className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase cursor-pointer outline-none disabled:cursor-not-allowed disabled:opacity-60"
                                                style={{
                                                    background: roleColor.bg,
                                                    color: roleColor.text,
                                                    border: '1px solid transparent'
                                                }}
                                            >
                                                {ROLES.map(role => (
                                                    <option key={role.value} value={role.value}>{role.label}</option>
                                                ))}
                                            </select>
                                        </td>
                                        {/* Status */}
                                        <td className="px-4 py-4 hidden md:table-cell">
                                            <span
                                                className="px-2 py-1 rounded-lg text-xs font-bold uppercase"
                                                style={{
                                                    background: member.isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                                    color: member.isActive ? '#10B981' : '#EF4444'
                                                }}
                                            >
                                                {member.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        {/* Actions */}
                                        <td className="px-4 py-4">
                                            <div className="flex items-center justify-end gap-2 relative">
                                                {actionLoading === member.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--neural-core)' }} />
                                                ) : !isCurrentUser ? (
                                                    <>
                                                        <button
                                                            onClick={() => setActionMenuOpen(actionMenuOpen === member.id ? null : member.id)}
                                                            className="p-2 rounded-lg transition-colors hover:bg-white/5"
                                                            style={{ color: 'var(--text-tertiary)' }}
                                                        >
                                                            <MoreHorizontal className="w-4 h-4" />
                                                        </button>
                                                        {actionMenuOpen === member.id && (
                                                            <>
                                                                <div className="fixed inset-0 z-40" onClick={() => setActionMenuOpen(null)} />
                                                                <div
                                                                    className="absolute right-0 top-full mt-1 rounded-xl p-2 z-50 min-w-[160px]"
                                                                    style={{
                                                                        background: 'var(--surface)',
                                                                        border: '1px solid var(--border-default)',
                                                                        boxShadow: 'var(--shadow-float)'
                                                                    }}
                                                                >
                                                                    <button
                                                                        onClick={() => handlePasswordReset(member.email)}
                                                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/5"
                                                                        style={{ color: 'var(--text-secondary)' }}
                                                                    >
                                                                        <Key className="w-4 h-4" />
                                                                        Reset Password
                                                                    </button>
                                                                    {member.isActive ? (
                                                                        <button
                                                                            onClick={() => handleDeactivate(member.id)}
                                                                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-red-500/10"
                                                                            style={{ color: '#EF4444' }}
                                                                        >
                                                                            <X className="w-4 h-4" />
                                                                            Deactivate
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => handleReactivate(member.id)}
                                                                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-green-500/10"
                                                                            style={{ color: '#10B981' }}
                                                                        >
                                                                            <Check className="w-4 h-4" />
                                                                            Reactivate
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </>
                                                        )}
                                                    </>
                                                ) : null}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Role Legend */}
            <div className="p-4 rounded-xl space-y-3" style={{ background: 'var(--elevated)' }}>
                <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                    <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-ghost)' }}>Role Permissions</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {ROLES.map(role => (
                        <div key={role.value} className="flex items-center gap-3">
                            <span
                                className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                                style={{ background: role.color.bg, color: role.color.text }}
                            >
                                {role.label}
                            </span>
                            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{role.description}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0, 0, 0, 0.7)' }}>
                    <div
                        className="w-full max-w-md rounded-2xl p-6 space-y-6"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl" style={{ background: 'var(--neural-dim)' }}>
                                    <UserPlus className="w-5 h-5" style={{ color: 'var(--neural-core)' }} />
                                </div>
                                <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Invite User</h3>
                            </div>
                            <button
                                onClick={() => { setShowInviteModal(false); setInviteError(''); }}
                                className="p-2 rounded-lg transition-colors hover:bg-white/5"
                                style={{ color: 'var(--text-tertiary)' }}
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {inviteError && (
                            <div
                                className="flex items-center gap-2 p-3 rounded-xl"
                                style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                            >
                                <AlertCircle className="w-4 h-4 shrink-0" style={{ color: '#EF4444' }} />
                                <p className="text-sm" style={{ color: '#EF4444' }}>{inviteError}</p>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-ghost)' }}>First Name</label>
                                    <input
                                        type="text"
                                        value={inviteForm.firstName}
                                        onChange={(e) => setInviteForm(prev => ({ ...prev, firstName: e.target.value }))}
                                        placeholder="John"
                                        className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                                        style={{
                                            background: 'var(--deep)',
                                            border: '1px solid var(--border-default)',
                                            color: 'var(--text-primary)'
                                        }}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-ghost)' }}>Last Name</label>
                                    <input
                                        type="text"
                                        value={inviteForm.lastName}
                                        onChange={(e) => setInviteForm(prev => ({ ...prev, lastName: e.target.value }))}
                                        placeholder="Doe"
                                        className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                                        style={{
                                            background: 'var(--deep)',
                                            border: '1px solid var(--border-default)',
                                            color: 'var(--text-primary)'
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-ghost)' }}>Email</label>
                                <input
                                    type="email"
                                    value={inviteForm.email}
                                    onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                                    placeholder="john@company.com"
                                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                                    style={{
                                        background: 'var(--deep)',
                                        border: '1px solid var(--border-default)',
                                        color: 'var(--text-primary)'
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-ghost)' }}>Role</label>
                                <select
                                    value={inviteForm.role}
                                    onChange={(e) => setInviteForm(prev => ({ ...prev, role: e.target.value as UserRole }))}
                                    className="w-full px-4 py-2.5 rounded-xl text-sm outline-none cursor-pointer"
                                    style={{
                                        background: 'var(--deep)',
                                        border: '1px solid var(--border-default)',
                                        color: 'var(--text-primary)'
                                    }}
                                >
                                    {ROLES.map(role => (
                                        <option key={role.value} value={role.value}>{role.label} - {role.description}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowInviteModal(false); setInviteError(''); }}
                                className="flex-1 px-4 py-3 rounded-xl font-bold text-sm transition-colors"
                                style={{ background: 'var(--elevated)', color: 'var(--text-secondary)' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleInvite}
                                disabled={isInviting}
                                className="flex-1 px-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                                style={{
                                    background: 'var(--gradient-neural)',
                                    color: '#ffffff'
                                }}
                            >
                                {isInviting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <Mail className="w-4 h-4" />
                                        Send Invite
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamTab;
