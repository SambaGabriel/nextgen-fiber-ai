/**
 * SecurityTab - Security settings section
 * Password change, active sessions, 2FA (future), logout
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
    Shield, Key, Eye, EyeOff, Monitor, Smartphone, LogOut, AlertTriangle,
    CheckCircle, Loader2, AlertCircle, RefreshCw, Trash2, Globe, Clock
} from 'lucide-react';
import { User, Language } from '../../../types';
import { translations } from '../../../services/translations';
import { securityService, sessionService, getPasswordStrength, validatePassword } from '../../../services/settingsService';
import { UserSession, PasswordStrength } from '../../../types/settings';

interface SecurityTabProps {
    user: User;
    lang: Language;
    onLogout: () => void;
}

const SecurityTab: React.FC<SecurityTabProps> = ({ user, lang, onLogout }) => {
    const t = translations[lang];

    // Password change state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    // Sessions state
    const [sessions, setSessions] = useState<UserSession[]>([]);
    const [isLoadingSessions, setIsLoadingSessions] = useState(true);
    const [isRevokingSession, setIsRevokingSession] = useState<string | null>(null);
    const [isRevokingAll, setIsRevokingAll] = useState(false);
    const [showLogoutAllConfirm, setShowLogoutAllConfirm] = useState(false);

    // Load sessions
    useEffect(() => {
        const loadSessions = async () => {
            setIsLoadingSessions(true);
            try {
                const sessionsList = await sessionService.getSessions();
                setSessions(sessionsList);
            } catch (error) {
                console.error('[SecurityTab] Error loading sessions:', error);
            } finally {
                setIsLoadingSessions(false);
            }
        };
        loadSessions();
    }, []);

    // Get password strength
    const passwordStrength = getPasswordStrength(newPassword);
    const passwordValidation = validatePassword(newPassword);

    // Strength colors
    const getStrengthColor = (strength: PasswordStrength) => {
        switch (strength) {
            case 'weak': return '#EF4444';
            case 'fair': return '#F59E0B';
            case 'good': return '#10B981';
            case 'strong': return '#3B82F6';
            case 'very-strong': return '#8B5CF6';
            default: return '#6B7280';
        }
    };

    const getStrengthPercent = (strength: PasswordStrength) => {
        switch (strength) {
            case 'weak': return 20;
            case 'fair': return 40;
            case 'good': return 60;
            case 'strong': return 80;
            case 'very-strong': return 100;
            default: return 0;
        }
    };

    // Handle password change
    const handleChangePassword = useCallback(async () => {
        setPasswordError('');
        setPasswordSuccess('');

        // Validation
        if (!currentPassword) {
            setPasswordError('Current password is required');
            return;
        }
        if (!newPassword) {
            setPasswordError('New password is required');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('Passwords do not match');
            return;
        }
        if (!passwordValidation.valid) {
            setPasswordError(passwordValidation.errors[0]);
            return;
        }

        setIsChangingPassword(true);
        try {
            const result = await securityService.changePassword({
                currentPassword,
                newPassword,
                confirmPassword
            });

            if (result.success) {
                setPasswordSuccess(result.message + (result.sessionsRevoked ? ` (${result.sessionsRevoked} sessions logged out)` : ''));
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                // Reload sessions
                const sessionsList = await sessionService.getSessions();
                setSessions(sessionsList);
            } else {
                setPasswordError(result.message);
            }
        } catch (error: any) {
            setPasswordError(error.message || 'Failed to change password');
        } finally {
            setIsChangingPassword(false);
        }
    }, [currentPassword, newPassword, confirmPassword, passwordValidation]);

    // Handle revoke session
    const handleRevokeSession = useCallback(async (sessionId: string) => {
        setIsRevokingSession(sessionId);
        try {
            const success = await sessionService.revokeSession(sessionId);
            if (success) {
                setSessions(prev => prev.filter(s => s.id !== sessionId));
            }
        } catch (error) {
            console.error('[SecurityTab] Error revoking session:', error);
        } finally {
            setIsRevokingSession(null);
        }
    }, []);

    // Handle logout all
    const handleLogoutAll = useCallback(async () => {
        setIsRevokingAll(true);
        try {
            await securityService.logoutAll();
            // This will trigger a redirect via onLogout
            onLogout();
        } catch (error) {
            console.error('[SecurityTab] Error logging out all:', error);
        } finally {
            setIsRevokingAll(false);
            setShowLogoutAllConfirm(false);
        }
    }, [onLogout]);

    // Get device icon
    const getDeviceIcon = (session: UserSession) => {
        const isMobile = /mobile|android|iphone|ipad/i.test(session.deviceInfo.toLowerCase());
        return isMobile ? Smartphone : Monitor;
    };

    // Format relative time
    const formatRelativeTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="space-y-10 animate-fade-in-up">
            {/* Header */}
            <div className="flex items-center gap-4 pb-6" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="p-3 rounded-xl" style={{ background: 'var(--neural-dim)' }}>
                    <Shield className="w-6 h-6" style={{ color: 'var(--neural-core)' }} />
                </div>
                <div>
                    <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
                        {(t as any).security || 'Security'}
                    </h2>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {(t as any).security_desc || 'Manage your password and active sessions'}
                    </p>
                </div>
            </div>

            {/* Change Password Section */}
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <Key className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                    <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>
                        {(t as any).change_password || 'Change Password'}
                    </h3>
                </div>

                {/* Error/Success Messages */}
                {passwordError && (
                    <div
                        className="flex items-center gap-3 p-4 rounded-xl"
                        style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                    >
                        <AlertCircle className="w-5 h-5 shrink-0" style={{ color: '#EF4444' }} />
                        <p className="text-sm font-medium" style={{ color: '#EF4444' }}>{passwordError}</p>
                    </div>
                )}
                {passwordSuccess && (
                    <div
                        className="flex items-center gap-3 p-4 rounded-xl"
                        style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}
                    >
                        <CheckCircle className="w-5 h-5 shrink-0" style={{ color: '#10B981' }} />
                        <p className="text-sm font-medium" style={{ color: '#10B981' }}>{passwordSuccess}</p>
                    </div>
                )}

                <div className="grid gap-4 max-w-md">
                    {/* Current Password */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-ghost)' }}>
                            {(t as any).current_password || 'Current Password'}
                        </label>
                        <div className="relative">
                            <input
                                type={showCurrentPassword ? 'text' : 'password'}
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Enter current password"
                                className="w-full px-4 py-3 pr-12 rounded-xl outline-none transition-all"
                                style={{
                                    background: 'var(--deep)',
                                    border: '1px solid var(--border-default)',
                                    color: 'var(--text-primary)'
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                                style={{ color: 'var(--text-tertiary)' }}
                            >
                                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* New Password */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-ghost)' }}>
                            {(t as any).new_password || 'New Password'}
                        </label>
                        <div className="relative">
                            <input
                                type={showNewPassword ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Enter new password"
                                className="w-full px-4 py-3 pr-12 rounded-xl outline-none transition-all"
                                style={{
                                    background: 'var(--deep)',
                                    border: '1px solid var(--border-default)',
                                    color: 'var(--text-primary)'
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                                style={{ color: 'var(--text-tertiary)' }}
                            >
                                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>

                        {/* Password Strength Indicator */}
                        {newPassword && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--elevated)' }}>
                                        <div
                                            className="h-full rounded-full transition-all duration-300"
                                            style={{
                                                width: `${getStrengthPercent(passwordStrength)}%`,
                                                background: getStrengthColor(passwordStrength)
                                            }}
                                        />
                                    </div>
                                    <span
                                        className="text-xs font-bold uppercase"
                                        style={{ color: getStrengthColor(passwordStrength) }}
                                    >
                                        {passwordStrength.replace('-', ' ')}
                                    </span>
                                </div>
                                <ul className="text-[10px] space-y-1" style={{ color: 'var(--text-tertiary)' }}>
                                    <li className={newPassword.length >= 10 ? 'text-green-500' : ''}>
                                        {newPassword.length >= 10 ? '✓' : '○'} At least 10 characters
                                    </li>
                                    <li className={/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) ? 'text-green-500' : ''}>
                                        {/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) ? '✓' : '○'} Upper & lowercase letters
                                    </li>
                                    <li className={/\d/.test(newPassword) ? 'text-green-500' : ''}>
                                        {/\d/.test(newPassword) ? '✓' : '○'} At least one number
                                    </li>
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-ghost)' }}>
                            {(t as any).confirm_password || 'Confirm Password'}
                        </label>
                        <div className="relative">
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm new password"
                                className="w-full px-4 py-3 pr-12 rounded-xl outline-none transition-all"
                                style={{
                                    background: 'var(--deep)',
                                    border: confirmPassword && confirmPassword !== newPassword
                                        ? '1px solid #EF4444'
                                        : '1px solid var(--border-default)',
                                    color: 'var(--text-primary)'
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                                style={{ color: 'var(--text-tertiary)' }}
                            >
                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        {confirmPassword && confirmPassword !== newPassword && (
                            <p className="text-xs" style={{ color: '#EF4444' }}>Passwords do not match</p>
                        )}
                    </div>

                    {/* Change Password Button */}
                    <button
                        onClick={handleChangePassword}
                        disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                        className="mt-2 px-6 py-3 rounded-xl font-bold uppercase text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                        style={{
                            background: 'var(--gradient-neural)',
                            color: '#ffffff',
                            boxShadow: 'var(--shadow-neural)'
                        }}
                    >
                        {isChangingPassword ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Changing...
                            </>
                        ) : (
                            <>
                                <Key className="w-4 h-4" />
                                Change Password
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Active Sessions Section */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Monitor className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                        <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>
                            {(t as any).active_sessions || 'Active Sessions'}
                        </h3>
                    </div>
                    {sessions.length > 1 && (
                        <button
                            onClick={() => setShowLogoutAllConfirm(true)}
                            className="text-xs font-bold uppercase flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
                            style={{ color: 'var(--critical-core)', background: 'rgba(239, 68, 68, 0.1)' }}
                        >
                            <LogOut className="w-3.5 h-3.5" />
                            Logout All Devices
                        </button>
                    )}
                </div>

                {/* Sessions List */}
                {isLoadingSessions ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--neural-core)' }} />
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="text-center py-8 rounded-xl" style={{ border: '2px dashed var(--border-default)' }}>
                        <Monitor className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-ghost)' }} />
                        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No active sessions</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {sessions.map(session => {
                            const DeviceIcon = getDeviceIcon(session);
                            return (
                                <div
                                    key={session.id}
                                    className="flex items-center gap-4 p-4 rounded-xl transition-colors"
                                    style={{
                                        background: session.isCurrent ? 'var(--neural-dim)' : 'var(--elevated)',
                                        border: session.isCurrent ? '1px solid var(--border-neural)' : '1px solid transparent'
                                    }}
                                >
                                    <div
                                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                        style={{
                                            background: session.isCurrent ? 'var(--neural-core)' : 'var(--deep)'
                                        }}
                                    >
                                        <DeviceIcon
                                            className="w-5 h-5"
                                            style={{ color: session.isCurrent ? '#ffffff' : 'var(--text-tertiary)' }}
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                                                {session.browser} on {session.os}
                                            </p>
                                            {session.isCurrent && (
                                                <span
                                                    className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
                                                    style={{ background: 'var(--online-core)', color: '#ffffff' }}
                                                >
                                                    Current
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 mt-1">
                                            <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--text-ghost)' }}>
                                                <Globe className="w-3 h-3" />
                                                {session.ipAddress}
                                            </span>
                                            <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--text-ghost)' }}>
                                                <Clock className="w-3 h-3" />
                                                {formatRelativeTime(session.lastActivityAt)}
                                            </span>
                                        </div>
                                    </div>
                                    {!session.isCurrent && (
                                        <button
                                            onClick={() => handleRevokeSession(session.id)}
                                            disabled={isRevokingSession === session.id}
                                            className="p-2 rounded-lg transition-colors hover:bg-red-500/10"
                                            style={{ color: 'var(--text-tertiary)' }}
                                            title="Revoke session"
                                        >
                                            {isRevokingSession === session.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4 hover:text-red-500" />
                                            )}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 2FA Section (Coming Soon) */}
            <div className="space-y-4 opacity-50">
                <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                    <h3 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>
                        Two-Factor Authentication
                    </h3>
                    <span
                        className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
                        style={{ background: 'var(--elevated)', color: 'var(--text-tertiary)' }}
                    >
                        Coming Soon
                    </span>
                </div>
                <div
                    className="p-4 rounded-xl"
                    style={{ background: 'var(--elevated)', border: '1px solid var(--border-subtle)' }}
                >
                    <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                        Add an extra layer of security to your account by enabling two-factor authentication.
                    </p>
                </div>
            </div>

            {/* Logout All Confirmation Modal */}
            {showLogoutAllConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0, 0, 0, 0.7)' }}>
                    <div
                        className="w-full max-w-md rounded-2xl p-6 space-y-6"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
                                <AlertTriangle className="w-6 h-6" style={{ color: '#EF4444' }} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                                    Logout All Devices?
                                </h3>
                                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                                    This will log you out of all devices including this one.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowLogoutAllConfirm(false)}
                                className="flex-1 px-4 py-3 rounded-xl font-bold text-sm transition-colors"
                                style={{
                                    background: 'var(--elevated)',
                                    color: 'var(--text-secondary)'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleLogoutAll}
                                disabled={isRevokingAll}
                                className="flex-1 px-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                                style={{
                                    background: '#EF4444',
                                    color: '#ffffff'
                                }}
                            >
                                {isRevokingAll ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Logging out...
                                    </>
                                ) : (
                                    <>
                                        <LogOut className="w-4 h-4" />
                                        Logout All
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

export default SecurityTab;
