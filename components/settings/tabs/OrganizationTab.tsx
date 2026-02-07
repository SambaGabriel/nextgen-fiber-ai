/**
 * OrganizationTab - Organization settings section (Admin only)
 * Company name, address, phone, logo
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    Building, MapPin, Phone, Camera, Save, CheckCircle, Loader2, AlertCircle
} from 'lucide-react';
import { User, Language } from '../../../types';
import { translations } from '../../../services/translations';
import { organizationService } from '../../../services/settingsService';
import { Organization, OrganizationUpdateRequest } from '../../../types/settings';

interface OrganizationTabProps {
    user: User;
    lang: Language;
}

const OrganizationTab: React.FC<OrganizationTabProps> = ({ user, lang }) => {
    const t = translations[lang];
    const logoInputRef = useRef<HTMLInputElement>(null);

    // Form state
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [logoUrl, setLogoUrl] = useState('');

    // UI state
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [error, setError] = useState('');

    // Load organization data
    useEffect(() => {
        const loadOrganization = async () => {
            setIsLoading(true);
            try {
                const org = await organizationService.getOrganization();
                if (org) {
                    setName(org.name || '');
                    setAddress(org.address || '');
                    setPhone(org.phone || '');
                    setLogoUrl(org.logoUrl || '');
                } else {
                    // Fallback to user's company info
                    setName(user.companyName || '');
                    setAddress(user.companyAddress || '');
                    setPhone(user.companyPhone || '');
                    setLogoUrl(user.companyLogo || '');
                }
            } catch (err) {
                console.error('[OrganizationTab] Error loading org:', err);
                // Fallback
                setName(user.companyName || '');
                setAddress(user.companyAddress || '');
                setPhone(user.companyPhone || '');
                setLogoUrl(user.companyLogo || '');
            } finally {
                setIsLoading(false);
            }
        };
        loadOrganization();
    }, [user]);

    // Handle save
    const handleSave = useCallback(async () => {
        setIsSaving(true);
        setError('');
        setSaveSuccess(false);

        try {
            const updates: OrganizationUpdateRequest = {
                name: name || undefined,
                address: address || undefined,
                phone: phone || undefined,
                logoUrl: logoUrl || undefined
            };

            await organizationService.updateOrganization(updates);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err: any) {
            console.error('[OrganizationTab] Save error:', err);
            setError(err.message || 'Failed to save organization');
        } finally {
            setIsSaving(false);
        }
    }, [name, address, phone, logoUrl]);

    // Handle logo upload
    const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            setError('Logo must be smaller than 2MB');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setLogoUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
    }, []);

    // Handle logo removal
    const handleRemoveLogo = useCallback(() => {
        setLogoUrl('');
    }, []);

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
                    <Building className="w-6 h-6" style={{ color: 'var(--neural-core)' }} />
                </div>
                <div>
                    <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
                        {(t as any).organization || 'Organization'}
                    </h2>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {(t as any).organization_desc || 'Manage your company information'}
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

            {/* Logo Section */}
            <div className="flex flex-col sm:flex-row items-start gap-6">
                <div className="relative group">
                    <div
                        onClick={() => logoInputRef.current?.click()}
                        className="w-32 h-32 rounded-2xl flex items-center justify-center overflow-hidden cursor-pointer transition-all"
                        style={{
                            background: 'var(--neural-dim)',
                            border: '2px solid var(--border-neural)'
                        }}
                    >
                        {logoUrl ? (
                            <img
                                src={logoUrl}
                                alt="Company Logo"
                                className="w-full h-full object-contain p-4 group-hover:opacity-50 transition-opacity"
                            />
                        ) : (
                            <Building
                                className="w-12 h-12 group-hover:scale-110 transition-transform"
                                style={{ color: 'var(--neural-core)' }}
                            />
                        )}
                        <div
                            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ background: 'rgba(0, 0, 0, 0.5)' }}
                        >
                            <Camera className="w-8 h-8 text-white" />
                        </div>
                    </div>
                    <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                    />
                </div>
                <div className="space-y-2">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {(t as any).company_logo || 'Company Logo'}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {(t as any).logo_hint || 'Click to upload. Recommended size: 200x200px. Max 2MB.'}
                    </p>
                    {logoUrl && (
                        <button
                            onClick={handleRemoveLogo}
                            className="text-xs font-semibold transition-colors"
                            style={{ color: 'var(--critical-core)' }}
                        >
                            {(t as any).remove_logo || 'Remove Logo'}
                        </button>
                    )}
                </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-6 max-w-xl">
                {/* Company Name */}
                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text-ghost)' }}>
                        <Building className="w-3.5 h-3.5" />
                        {(t as any).company_name || 'Company Name'}
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="NextGen Fiber Corp"
                        className="w-full px-4 py-3 rounded-xl outline-none transition-all focus:ring-2"
                        style={{
                            background: 'var(--deep)',
                            border: '1px solid var(--border-default)',
                            color: 'var(--text-primary)'
                        }}
                    />
                </div>

                {/* Address */}
                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text-ghost)' }}>
                        <MapPin className="w-3.5 h-3.5" />
                        {(t as any).address || 'Address'}
                    </label>
                    <textarea
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="123 Innovation Dr, Suite 100&#10;Ashburn, VA 20147"
                        rows={3}
                        className="w-full px-4 py-3 rounded-xl outline-none transition-all focus:ring-2 resize-none"
                        style={{
                            background: 'var(--deep)',
                            border: '1px solid var(--border-default)',
                            color: 'var(--text-primary)'
                        }}
                    />
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
                        placeholder="+1 (703) 555-0123"
                        className="w-full px-4 py-3 rounded-xl outline-none transition-all focus:ring-2"
                        style={{
                            background: 'var(--deep)',
                            border: '1px solid var(--border-default)',
                            color: 'var(--text-primary)'
                        }}
                    />
                </div>
            </div>

            {/* Coming Soon Features */}
            <div className="space-y-4 p-4 rounded-xl opacity-50" style={{ background: 'var(--elevated)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-ghost)' }}>
                        Coming Soon
                    </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-tertiary)' }}>Brand Colors</p>
                        <p className="text-xs" style={{ color: 'var(--text-ghost)' }}>Customize your primary and accent colors</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-tertiary)' }}>Invoice Template</p>
                        <p className="text-xs" style={{ color: 'var(--text-ghost)' }}>Customize invoice branding and layout</p>
                    </div>
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

export default OrganizationTab;
