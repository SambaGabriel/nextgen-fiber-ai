/**
 * AccountTab - Profile editing section
 * Edit name, phone, avatar and view role/organization
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { User as UserIcon, Mail, Phone, Building, Shield, Camera, Save, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { User, Language } from '../../../types';
import { translations } from '../../../services/translations';
import { profileService } from '../../../services/settingsService';
import { UserProfile, ProfileUpdateRequest } from '../../../types/settings';

interface AccountTabProps {
    user: User;
    lang: Language;
    onUpdateUser: (user: User) => void;
}

const AccountTab: React.FC<AccountTabProps> = ({ user, lang, onUpdateUser }) => {
    const t = translations[lang];
    const avatarInputRef = useRef<HTMLInputElement>(null);

    // Form state
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');

    // UI state
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [error, setError] = useState('');

    // Load profile data on mount
    useEffect(() => {
        const loadProfile = async () => {
            setIsLoading(true);
            try {
                const profile = await profileService.getProfile();
                if (profile) {
                    setFirstName(profile.firstName || '');
                    setLastName(profile.lastName || '');
                    setPhone(profile.phone || '');
                    setAvatarUrl(profile.avatarUrl || '');
                } else {
                    // Fallback to user prop
                    const nameParts = user.name?.split(' ') || [];
                    setFirstName(nameParts[0] || '');
                    setLastName(nameParts.slice(1).join(' ') || '');
                }
            } catch (err) {
                console.error('[AccountTab] Error loading profile:', err);
                // Fallback to user prop
                const nameParts = user.name?.split(' ') || [];
                setFirstName(nameParts[0] || '');
                setLastName(nameParts.slice(1).join(' ') || '');
            } finally {
                setIsLoading(false);
            }
        };
        loadProfile();
    }, [user]);

    // Handle save
    const handleSave = useCallback(async () => {
        setIsSaving(true);
        setError('');
        setSaveSuccess(false);

        try {
            const updates: ProfileUpdateRequest = {
                firstName,
                lastName,
                phone: phone || undefined,
                avatarUrl: avatarUrl || undefined
            };

            const updatedProfile = await profileService.updateProfile(updates);

            if (updatedProfile) {
                // Update parent state
                onUpdateUser({
                    ...user,
                    name: `${firstName} ${lastName}`.trim(),
                    profilePic: avatarUrl || user.profilePic
                });
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 3000);
            }
        } catch (err: any) {
            console.error('[AccountTab] Save error:', err);
            setError(err.message || 'Failed to save profile');
        } finally {
            setIsSaving(false);
        }
    }, [firstName, lastName, phone, avatarUrl, user, onUpdateUser]);

    // Handle avatar upload
    const handleAvatarUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            setError('Image must be smaller than 2MB');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setAvatarUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
    }, []);

    // Handle avatar removal
    const handleRemoveAvatar = useCallback(() => {
        setAvatarUrl('');
    }, []);

    // Get role display
    const getRoleBadge = () => {
        const role = user.role?.toUpperCase() || 'LINEMAN';
        const colors: Record<string, { bg: string; text: string }> = {
            ADMIN: { bg: 'rgba(139, 92, 246, 0.2)', text: '#8B5CF6' },
            SUPERVISOR: { bg: 'rgba(59, 130, 246, 0.2)', text: '#3B82F6' },
            BILLING: { bg: 'rgba(245, 158, 11, 0.2)', text: '#F59E0B' },
            VIEWER: { bg: 'rgba(107, 114, 128, 0.2)', text: '#6B7280' },
            LINEMAN: { bg: 'rgba(16, 185, 129, 0.2)', text: '#10B981' }
        };
        const color = colors[role] || colors.LINEMAN;
        return (
            <span
                className="px-3 py-1 rounded-full text-xs font-bold uppercase"
                style={{ background: color.bg, color: color.text }}
            >
                {role}
            </span>
        );
    };

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
            <div className="flex items-center gap-4 pb-6" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="p-3 rounded-xl" style={{ background: 'var(--neural-dim)' }}>
                    <UserIcon className="w-6 h-6" style={{ color: 'var(--neural-core)' }} />
                </div>
                <div>
                    <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
                        {(t as any).account_info || 'Account Information'}
                    </h2>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {(t as any).account_info_desc || 'Manage your personal information'}
                    </p>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div
                    className="flex items-center gap-3 p-4 rounded-xl"
                    style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                >
                    <AlertCircle className="w-5 h-5 shrink-0" style={{ color: '#EF4444' }} />
                    <p className="text-sm font-medium" style={{ color: '#EF4444' }}>{error}</p>
                </div>
            )}

            {/* Avatar Section */}
            <div className="flex flex-col sm:flex-row items-start gap-6">
                <div className="relative group">
                    <div
                        onClick={() => avatarInputRef.current?.click()}
                        className="w-24 h-24 rounded-2xl flex items-center justify-center overflow-hidden cursor-pointer transition-all"
                        style={{
                            background: 'var(--neural-dim)',
                            border: '2px solid var(--border-neural)'
                        }}
                    >
                        {avatarUrl ? (
                            <img
                                src={avatarUrl}
                                alt="Avatar"
                                className="w-full h-full object-cover group-hover:opacity-50 transition-opacity"
                            />
                        ) : (
                            <span
                                className="text-3xl font-black uppercase"
                                style={{ color: 'var(--neural-core)' }}
                            >
                                {firstName.charAt(0) || user.name?.charAt(0) || 'U'}
                            </span>
                        )}
                        <div
                            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ background: 'rgba(0, 0, 0, 0.5)' }}
                        >
                            <Camera className="w-6 h-6 text-white" />
                        </div>
                    </div>
                    <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                    />
                </div>
                <div className="space-y-2">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {(t as any).profile_photo || 'Profile Photo'}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {(t as any).photo_hint || 'Click to upload. Max 2MB.'}
                    </p>
                    {avatarUrl && (
                        <button
                            onClick={handleRemoveAvatar}
                            className="text-xs font-semibold transition-colors"
                            style={{ color: 'var(--critical-core)' }}
                        >
                            {(t as any).remove_photo || 'Remove Photo'}
                        </button>
                    )}
                </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* First Name */}
                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text-ghost)' }}>
                        <UserIcon className="w-3.5 h-3.5" />
                        {(t as any).first_name || 'First Name'}
                    </label>
                    <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="John"
                        className="w-full px-4 py-3 rounded-xl outline-none transition-all focus:ring-2"
                        style={{
                            background: 'var(--deep)',
                            border: '1px solid var(--border-default)',
                            color: 'var(--text-primary)'
                        }}
                    />
                </div>

                {/* Last Name */}
                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text-ghost)' }}>
                        <UserIcon className="w-3.5 h-3.5" />
                        {(t as any).last_name || 'Last Name'}
                    </label>
                    <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Doe"
                        className="w-full px-4 py-3 rounded-xl outline-none transition-all focus:ring-2"
                        style={{
                            background: 'var(--deep)',
                            border: '1px solid var(--border-default)',
                            color: 'var(--text-primary)'
                        }}
                    />
                </div>

                {/* Email (read-only) */}
                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text-ghost)' }}>
                        <Mail className="w-3.5 h-3.5" />
                        {(t as any).email_settings || 'Email'}
                    </label>
                    <input
                        type="email"
                        value={user.email || ''}
                        disabled
                        className="w-full px-4 py-3 rounded-xl cursor-not-allowed"
                        style={{
                            background: 'var(--elevated)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-tertiary)'
                        }}
                    />
                    <p className="text-[10px]" style={{ color: 'var(--text-ghost)' }}>
                        {(t as any).email_hint || 'Contact support to change email'}
                    </p>
                </div>

                {/* Phone */}
                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text-ghost)' }}>
                        <Phone className="w-3.5 h-3.5" />
                        {(t as any).phone || 'Phone'}
                    </label>
                    <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 (555) 123-4567"
                        className="w-full px-4 py-3 rounded-xl outline-none transition-all focus:ring-2"
                        style={{
                            background: 'var(--deep)',
                            border: '1px solid var(--border-default)',
                            color: 'var(--text-primary)'
                        }}
                    />
                </div>
            </div>

            {/* Read-only Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-xl" style={{ background: 'var(--elevated)' }}>
                {/* Role */}
                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text-ghost)' }}>
                        <Shield className="w-3.5 h-3.5" />
                        {(t as any).role || 'Role'}
                    </label>
                    <div>{getRoleBadge()}</div>
                </div>

                {/* Organization */}
                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text-ghost)' }}>
                        <Building className="w-3.5 h-3.5" />
                        {(t as any).organization || 'Organization'}
                    </label>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {user.companyName || 'NextGen Fiber'}
                    </p>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-8 py-3 rounded-xl font-bold uppercase text-xs flex items-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                    style={{
                        background: saveSuccess ? 'var(--online-core)' : 'var(--gradient-neural)',
                        color: '#ffffff',
                        boxShadow: saveSuccess ? '0 0 20px var(--online-glow)' : 'var(--shadow-neural)'
                    }}
                >
                    {isSaving ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {(t as any).saving || 'Saving...'}
                        </>
                    ) : saveSuccess ? (
                        <>
                            <CheckCircle className="w-4 h-4" />
                            {(t as any).saved || 'Saved'}
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            {(t as any).save_changes || 'Save Changes'}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default AccountTab;
