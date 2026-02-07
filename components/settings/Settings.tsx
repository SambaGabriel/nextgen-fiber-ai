/**
 * Settings - Enterprise CRM Settings Page
 * Main container with sidebar navigation and tab content
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
    User, Shield, Settings as SettingsIcon, Bell, Users, Building, FileText,
    ChevronRight, ArrowLeft
} from 'lucide-react';
import { User as UserType, Language } from '../../types';
import { translations } from '../../services/translations';
import { SettingsTabId, UserRole } from '../../types/settings';

// Import tab components
import AccountTab from './tabs/AccountTab';
import SecurityTab from './tabs/SecurityTab';
import PreferencesTab from './tabs/PreferencesTab';
import NotificationsTab from './tabs/NotificationsTab';
import TeamTab from './tabs/TeamTab';
import OrganizationTab from './tabs/OrganizationTab';
import AuditTab from './tabs/AuditTab';

interface SettingsProps {
    user: UserType;
    lang: Language;
    onUpdateUser: (user: UserType) => void;
    onLogout: () => void;
    onBack?: () => void;
}

// Tab configuration with icons and permissions
const TABS_CONFIG: Array<{
    id: SettingsTabId;
    labelKey: string;
    icon: React.ElementType;
    roles: UserRole[] | ['*'];
}> = [
    { id: 'account', labelKey: 'settings_account', icon: User, roles: ['*'] },
    { id: 'security', labelKey: 'settings_security', icon: Shield, roles: ['*'] },
    { id: 'preferences', labelKey: 'settings_preferences', icon: SettingsIcon, roles: ['*'] },
    { id: 'notifications', labelKey: 'settings_notifications', icon: Bell, roles: ['*'] },
    { id: 'team', labelKey: 'settings_team', icon: Users, roles: ['admin'] },
    { id: 'organization', labelKey: 'settings_organization', icon: Building, roles: ['admin'] },
    { id: 'audit', labelKey: 'settings_audit', icon: FileText, roles: ['admin', 'supervisor'] }
];

const Settings: React.FC<SettingsProps> = ({ user, lang, onUpdateUser, onLogout, onBack }) => {
    const t = translations[lang];
    const [activeTab, setActiveTab] = useState<SettingsTabId>('account');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Get user role (normalize to lowercase)
    const userRole = (user.role?.toLowerCase() || 'lineman') as UserRole;

    // Filter tabs based on user role
    const visibleTabs = TABS_CONFIG.filter(tab => {
        if (tab.roles[0] === '*') return true;
        return (tab.roles as UserRole[]).includes(userRole);
    });

    // Handle tab change
    const handleTabChange = useCallback((tabId: SettingsTabId) => {
        setActiveTab(tabId);
        setIsMobileMenuOpen(false);
    }, []);

    // Get tab label from translations or fallback
    const getTabLabel = (labelKey: string): string => {
        return (t as any)[labelKey] || labelKey.replace('settings_', '').charAt(0).toUpperCase() +
            labelKey.replace('settings_', '').slice(1);
    };

    // Render tab content based on active tab
    const renderTabContent = () => {
        switch (activeTab) {
            case 'account':
                return <AccountTab user={user} lang={lang} onUpdateUser={onUpdateUser} />;
            case 'security':
                return <SecurityTab user={user} lang={lang} onLogout={onLogout} />;
            case 'preferences':
                return <PreferencesTab user={user} lang={lang} />;
            case 'notifications':
                return <NotificationsTab user={user} lang={lang} />;
            case 'team':
                return <TeamTab user={user} lang={lang} />;
            case 'organization':
                return <OrganizationTab user={user} lang={lang} />;
            case 'audit':
                return <AuditTab user={user} lang={lang} />;
            default:
                return <AccountTab user={user} lang={lang} onUpdateUser={onUpdateUser} />;
        }
    };

    // Find current tab config
    const currentTab = TABS_CONFIG.find(t => t.id === activeTab);

    return (
        <div className="min-h-screen animate-fade-in-up">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center gap-4 mb-2">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="p-2 rounded-xl transition-all hover:bg-white/5"
                            style={{ color: 'var(--text-tertiary)' }}
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}
                    <h1 className="text-3xl lg:text-4xl font-black tracking-tighter uppercase text-gradient-neural">
                        {(t as any).settings_title || 'Settings'}
                    </h1>
                </div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--text-ghost)' }}>
                    {(t as any).settings_subtitle || 'Manage your account and preferences'}
                </p>
            </div>

            {/* Main Content */}
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Sidebar Navigation - Desktop */}
                <div
                    className="hidden lg:block w-64 shrink-0"
                >
                    <div
                        className="sticky top-24 rounded-2xl p-4 space-y-2"
                        style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border-subtle)'
                        }}
                    >
                        {visibleTabs.map(tab => {
                            const isActive = activeTab === tab.id;
                            const Icon = tab.icon;

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => handleTabChange(tab.id)}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group"
                                    style={{
                                        background: isActive ? 'var(--neural-dim)' : 'transparent'
                                    }}
                                >
                                    <div
                                        className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
                                        style={{
                                            background: isActive ? 'var(--neural-core)' : 'var(--elevated)',
                                            boxShadow: isActive ? 'var(--shadow-neural)' : 'none'
                                        }}
                                    >
                                        <Icon
                                            className="w-4 h-4"
                                            style={{ color: isActive ? '#ffffff' : 'var(--text-tertiary)' }}
                                        />
                                    </div>
                                    <span
                                        className="text-sm font-semibold flex-1 text-left"
                                        style={{
                                            color: isActive ? 'var(--neural-core)' : 'var(--text-secondary)'
                                        }}
                                    >
                                        {getTabLabel(tab.labelKey)}
                                    </span>
                                    {isActive && (
                                        <ChevronRight className="w-4 h-4" style={{ color: 'var(--neural-core)' }} />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Mobile Tab Selector */}
                <div className="lg:hidden">
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl"
                        style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border-subtle)'
                        }}
                    >
                        <div className="flex items-center gap-3">
                            {currentTab && (
                                <>
                                    <div
                                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                                        style={{ background: 'var(--neural-core)' }}
                                    >
                                        <currentTab.icon className="w-4 h-4 text-white" />
                                    </div>
                                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                                        {getTabLabel(currentTab.labelKey)}
                                    </span>
                                </>
                            )}
                        </div>
                        <ChevronRight
                            className="w-5 h-5 transition-transform"
                            style={{
                                color: 'var(--text-tertiary)',
                                transform: isMobileMenuOpen ? 'rotate(90deg)' : 'rotate(0deg)'
                            }}
                        />
                    </button>

                    {/* Mobile Dropdown Menu */}
                    {isMobileMenuOpen && (
                        <div
                            className="mt-2 rounded-xl p-2 space-y-1"
                            style={{
                                background: 'var(--surface)',
                                border: '1px solid var(--border-subtle)'
                            }}
                        >
                            {visibleTabs.map(tab => {
                                const isActive = activeTab === tab.id;
                                const Icon = tab.icon;

                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => handleTabChange(tab.id)}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
                                        style={{
                                            background: isActive ? 'var(--neural-dim)' : 'transparent'
                                        }}
                                    >
                                        <Icon
                                            className="w-4 h-4"
                                            style={{ color: isActive ? 'var(--neural-core)' : 'var(--text-tertiary)' }}
                                        />
                                        <span
                                            className="text-sm font-medium"
                                            style={{
                                                color: isActive ? 'var(--neural-core)' : 'var(--text-secondary)'
                                            }}
                                        >
                                            {getTabLabel(tab.labelKey)}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Tab Content */}
                <div className="flex-1 min-w-0">
                    <div
                        className="rounded-2xl p-6 lg:p-8"
                        style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border-subtle)'
                        }}
                    >
                        {renderTabContent()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
