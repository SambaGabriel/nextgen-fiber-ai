/**
 * NotificationsTab - Notification preferences section
 * Email and in-app notification toggles
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    Bell, Mail, Smartphone, Briefcase, RefreshCw, FileText, CheckCircle,
    Loader2, ToggleLeft, ToggleRight
} from 'lucide-react';
import { User, Language } from '../../../types';
import { translations } from '../../../services/translations';
import { preferencesService } from '../../../services/settingsService';
import { NotificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES } from '../../../types/settings';

interface NotificationsTabProps {
    user: User;
    lang: Language;
}

// Notification category configuration
const NOTIFICATION_CATEGORIES = [
    {
        key: 'jobAssigned',
        labelKey: 'notif_job_assigned',
        defaultLabel: 'Job assigned to me',
        description: 'When a new job is assigned to you',
        icon: Briefcase
    },
    {
        key: 'jobUpdated',
        labelKey: 'notif_job_updated',
        defaultLabel: 'Job updated',
        description: 'When a job you\'re assigned to is modified',
        icon: RefreshCw
    },
    {
        key: 'newMessage',
        labelKey: 'notif_new_message',
        defaultLabel: 'New message',
        description: 'When you receive a new message',
        icon: Mail
    },
    {
        key: 'rateCardImport',
        labelKey: 'notif_rate_card',
        defaultLabel: 'Rate card imported',
        description: 'When rate cards are imported or updated',
        icon: FileText
    },
    {
        key: 'productionSubmitted',
        labelKey: 'notif_production',
        defaultLabel: 'Production submitted',
        description: 'When production reports are submitted for review',
        icon: CheckCircle
    }
] as const;

const NotificationsTab: React.FC<NotificationsTabProps> = ({ user, lang }) => {
    const t = translations[lang];

    // Notifications state
    const [notifications, setNotifications] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
    const [isLoading, setIsLoading] = useState(true);
    const [savingKey, setSavingKey] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Debounce timer ref
    const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Load preferences
    useEffect(() => {
        const loadNotifications = async () => {
            setIsLoading(true);
            try {
                const prefs = await preferencesService.getPreferences();
                if (prefs?.notifications) {
                    setNotifications(prefs.notifications);
                }
            } catch (error) {
                console.error('[NotificationsTab] Error loading preferences:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadNotifications();
    }, []);

    // Save notification preference with debounce
    const saveNotificationPreference = useCallback(async (
        channel: 'email' | 'inApp',
        key: string,
        value: boolean
    ) => {
        const savingId = `${channel}-${key}`;
        setSavingKey(savingId);
        setSaveSuccess(false);

        // Update local state immediately
        setNotifications(prev => ({
            ...prev,
            [channel]: {
                ...prev[channel],
                [key]: value
            }
        }));

        // Debounce the actual save
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
        }

        saveTimerRef.current = setTimeout(async () => {
            try {
                const updatedNotifications = {
                    ...notifications,
                    [channel]: {
                        ...notifications[channel],
                        [key]: value
                    }
                };

                await preferencesService.updatePreferences({
                    notifications: updatedNotifications
                });

                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 1500);
            } catch (error) {
                console.error('[NotificationsTab] Error saving preference:', error);
                // Revert on error
                setNotifications(prev => ({
                    ...prev,
                    [channel]: {
                        ...prev[channel],
                        [key]: !value
                    }
                }));
            } finally {
                setSavingKey(null);
            }
        }, 500);
    }, [notifications]);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }
        };
    }, []);

    // Toggle component
    const Toggle: React.FC<{
        enabled: boolean;
        onChange: () => void;
        loading?: boolean;
    }> = ({ enabled, onChange, loading }) => (
        <button
            onClick={onChange}
            disabled={loading}
            className="relative flex items-center transition-colors"
        >
            {loading ? (
                <div className="w-12 h-6 rounded-full flex items-center justify-center" style={{ background: 'var(--elevated)' }}>
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--neural-core)' }} />
                </div>
            ) : enabled ? (
                <div
                    className="w-12 h-6 rounded-full relative transition-colors"
                    style={{ background: 'var(--neural-core)' }}
                >
                    <div
                        className="absolute right-1 top-1 w-4 h-4 rounded-full bg-white transition-all"
                    />
                </div>
            ) : (
                <div
                    className="w-12 h-6 rounded-full relative transition-colors"
                    style={{ background: 'var(--elevated)' }}
                >
                    <div
                        className="absolute left-1 top-1 w-4 h-4 rounded-full transition-all"
                        style={{ background: 'var(--text-ghost)' }}
                    />
                </div>
            )}
        </button>
    );

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--neural-core)' }} />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in-up">
            {/* Header */}
            <div className="flex items-center justify-between pb-6" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl" style={{ background: 'var(--neural-dim)' }}>
                        <Bell className="w-6 h-6" style={{ color: 'var(--neural-core)' }} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
                            {(t as any).notifications || 'Notifications'}
                        </h2>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            {(t as any).notifications_desc || 'Choose how you want to be notified'}
                        </p>
                    </div>
                </div>
                {/* Save indicator */}
                {saveSuccess && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'var(--elevated)' }}>
                        <CheckCircle className="w-3 h-3" style={{ color: 'var(--online-core)' }} />
                        <span className="text-xs font-medium" style={{ color: 'var(--online-core)' }}>Saved</span>
                    </div>
                )}
            </div>

            {/* Notification Matrix */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    {/* Table Header */}
                    <thead>
                        <tr>
                            <th className="text-left pb-4 pr-8">
                                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-ghost)' }}>
                                    {(t as any).notification_type || 'Notification Type'}
                                </span>
                            </th>
                            <th className="text-center pb-4 px-4">
                                <div className="flex flex-col items-center gap-1">
                                    <Mail className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-ghost)' }}>
                                        {(t as any).email_settings || 'Email'}
                                    </span>
                                </div>
                            </th>
                            <th className="text-center pb-4 px-4">
                                <div className="flex flex-col items-center gap-1">
                                    <Smartphone className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-ghost)' }}>
                                        {(t as any).in_app || 'In-App'}
                                    </span>
                                </div>
                            </th>
                        </tr>
                    </thead>
                    {/* Table Body */}
                    <tbody>
                        {NOTIFICATION_CATEGORIES.map((category, idx) => {
                            const Icon = category.icon;
                            const emailKey = category.key as keyof typeof notifications.email;
                            const inAppKey = category.key as keyof typeof notifications.inApp;

                            return (
                                <tr
                                    key={category.key}
                                    className="group"
                                    style={{
                                        borderTop: idx > 0 ? '1px solid var(--border-subtle)' : undefined
                                    }}
                                >
                                    {/* Category Info */}
                                    <td className="py-5 pr-8">
                                        <div className="flex items-start gap-4">
                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                                style={{ background: 'var(--elevated)' }}
                                            >
                                                <Icon className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                                                    {(t as any)[category.labelKey] || category.defaultLabel}
                                                </p>
                                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                                                    {category.description}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    {/* Email Toggle */}
                                    <td className="py-5 px-4 text-center">
                                        <div className="flex justify-center">
                                            <Toggle
                                                enabled={notifications.email[emailKey]}
                                                onChange={() => saveNotificationPreference(
                                                    'email',
                                                    category.key,
                                                    !notifications.email[emailKey]
                                                )}
                                                loading={savingKey === `email-${category.key}`}
                                            />
                                        </div>
                                    </td>
                                    {/* In-App Toggle */}
                                    <td className="py-5 px-4 text-center">
                                        <div className="flex justify-center">
                                            <Toggle
                                                enabled={notifications.inApp[inAppKey]}
                                                onChange={() => saveNotificationPreference(
                                                    'inApp',
                                                    category.key,
                                                    !notifications.inApp[inAppKey]
                                                )}
                                                loading={savingKey === `inApp-${category.key}`}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <button
                    onClick={() => {
                        // Enable all
                        const allEnabled: NotificationPreferences = {
                            email: { jobAssigned: true, jobUpdated: true, newMessage: true, rateCardImport: true, productionSubmitted: true, redlineCreated: true, redlineReviewed: true },
                            inApp: { jobAssigned: true, jobUpdated: true, newMessage: true, rateCardImport: true, productionSubmitted: true, redlineCreated: true, redlineReviewed: true }
                        };
                        setNotifications(allEnabled);
                        preferencesService.updatePreferences({ notifications: allEnabled });
                        setSaveSuccess(true);
                        setTimeout(() => setSaveSuccess(false), 1500);
                    }}
                    className="px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
                    style={{ background: 'var(--elevated)', color: 'var(--text-secondary)' }}
                >
                    Enable All
                </button>
                <button
                    onClick={() => {
                        // Disable all
                        const allDisabled: NotificationPreferences = {
                            email: { jobAssigned: false, jobUpdated: false, newMessage: false, rateCardImport: false, productionSubmitted: false, redlineCreated: false, redlineReviewed: false },
                            inApp: { jobAssigned: false, jobUpdated: false, newMessage: false, rateCardImport: false, productionSubmitted: false, redlineCreated: false, redlineReviewed: false }
                        };
                        setNotifications(allDisabled);
                        preferencesService.updatePreferences({ notifications: allDisabled });
                        setSaveSuccess(true);
                        setTimeout(() => setSaveSuccess(false), 1500);
                    }}
                    className="px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
                    style={{ background: 'var(--elevated)', color: 'var(--text-secondary)' }}
                >
                    Disable All
                </button>
            </div>

            {/* Info */}
            <div
                className="flex items-start gap-3 p-4 rounded-xl"
                style={{ background: 'var(--elevated)', border: '1px solid var(--border-subtle)' }}
            >
                <Bell className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--text-tertiary)' }} />
                <div>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {(t as any).notifications_info || 'Email notifications are sent to your registered email address. In-app notifications appear in the notification bell.'}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default NotificationsTab;
