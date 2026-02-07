import React, { useState, useEffect, useCallback } from 'react';
import { ViewState, Notification, User, Language } from '../types';
import { translations } from '../services/translations';
import {
    LayoutDashboard, LogOut, Globe, Settings, Bell, ClipboardList, Wallet, ScanLine, ChevronRight,
    Upload, History, FolderOpen, Mic, Briefcase, DollarSign, Loader2
} from 'lucide-react';
import Logo from './Logo';
import { jobStorageSupabase } from '../services/jobStorageSupabase';
import { jobNotificationService } from '../services/jobNotificationService';

interface LayoutProps {
    currentView: ViewState;
    onChangeView: (view: ViewState) => void;
    children: React.ReactNode;
    notifications: Notification[];
    onMarkAllRead: () => void;
    user: User | null;
    onLogout: () => void;
    currentLang: Language;
    onChangeLang: (lang: Language) => void;
}

const Layout: React.FC<LayoutProps> = ({ currentView, onChangeView, children, notifications, user, onLogout, currentLang, onChangeLang }) => {
    const t = translations[currentLang];
    const [isLangOpen, setIsLangOpen] = useState(false);
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [newJobCount, setNewJobCount] = useState(0);
    const [assignedJobIds, setAssignedJobIds] = useState<string[]>([]);

    // Role-based access helpers
    const userRole = user?.role || 'LINEMAN';
    const isAdmin = userRole === 'ADMIN';
    const isSupervisor = userRole === 'SUPERVISOR';
    const isLineman = userRole === 'LINEMAN';
    const isRedlineSpecialist = userRole === 'REDLINE_SPECIALIST';
    const isClientReviewer = userRole === 'CLIENT_REVIEWER';
    const isBilling = userRole === 'BILLING';
    const isViewer = userRole === 'VIEWER';
    const hasAdminAccess = isAdmin || isSupervisor;

    // Load new job notifications for lineman
    useEffect(() => {
        if (!user?.id || hasAdminAccess) {
            setNewJobCount(0);
            return;
        }

        const checkNewJobs = async () => {
            try {
                const jobs = await jobStorageSupabase.getByLineman(user.id);
                const jobIds = jobs.map(j => j.id);
                setAssignedJobIds(jobIds);
                const unseenCount = jobNotificationService.getUnseenCount(user.id, jobIds);
                setNewJobCount(unseenCount);
            } catch (error) {
                console.error('[Layout] Error checking new jobs:', error);
            }
        };

        checkNewJobs();
        // Poll every 30 seconds for new jobs
        const interval = setInterval(checkNewJobs, 30000);
        return () => clearInterval(interval);
    }, [user?.id, hasAdminAccess]);

    // Mark jobs as seen when clicking My Jobs or bell
    const handleMarkJobsAsSeen = useCallback(() => {
        if (user?.id && assignedJobIds.length > 0) {
            jobNotificationService.markAllJobsAsSeen(user.id, assignedJobIds);
            setNewJobCount(0);
        }
    }, [user?.id, assignedJobIds]);

    // Navigation items based on role
    const getNavItems = () => {
        // Admin/Supervisor - Full access
        if (isAdmin || isSupervisor) {
            return [
                { id: ViewState.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
                { id: ViewState.JOBS_ADMIN, label: 'Jobs', icon: Briefcase },
                { id: ViewState.FINANCE_HUB, label: 'Invoices', icon: Wallet },
                { id: ViewState.MAP_ANALYZER, label: 'Maps', icon: ScanLine },
                { id: ViewState.RATE_CARDS, label: 'Rate Cards', icon: DollarSign },
                { id: ViewState.REDLINES, label: 'Redlines', icon: ClipboardList },
                { id: ViewState.SETTINGS, label: 'Settings', icon: Settings },
            ];
        }

        // Lineman - Field work focused
        if (isLineman) {
            return [
                { id: ViewState.DASHBOARD, label: 'Home', icon: LayoutDashboard },
                { id: ViewState.MY_JOBS, label: 'My Jobs', icon: Briefcase },
                { id: ViewState.MY_SUBMISSIONS, label: 'History', icon: History },
                { id: ViewState.SETTINGS, label: 'Settings', icon: Settings },
            ];
        }

        // Redline Specialist - Rate card versioning
        if (isRedlineSpecialist) {
            return [
                { id: ViewState.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
                { id: ViewState.RATE_CARDS, label: 'Rate Cards', icon: DollarSign },
                { id: ViewState.REDLINES, label: 'Redlines', icon: ClipboardList },
                { id: ViewState.SETTINGS, label: 'Settings', icon: Settings },
            ];
        }

        // Client Reviewer - Portal access
        if (isClientReviewer) {
            return [
                { id: ViewState.CLIENT_PORTAL, label: 'Portal', icon: LayoutDashboard },
                { id: ViewState.CLIENT_JOBS, label: 'Jobs', icon: Briefcase },
                { id: ViewState.CLIENT_REDLINES, label: 'Redlines', icon: ClipboardList },
                { id: ViewState.SETTINGS, label: 'Settings', icon: Settings },
            ];
        }

        // Billing - Financial focus
        if (isBilling) {
            return [
                { id: ViewState.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
                { id: ViewState.FINANCE_HUB, label: 'Invoices', icon: Wallet },
                { id: ViewState.SETTINGS, label: 'Settings', icon: Settings },
            ];
        }

        // Viewer - Read-only
        if (isViewer) {
            return [
                { id: ViewState.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
                { id: ViewState.JOBS_ADMIN, label: 'Jobs', icon: Briefcase },
                { id: ViewState.SETTINGS, label: 'Settings', icon: Settings },
            ];
        }

        // Fallback to lineman navigation
        return [
            { id: ViewState.DASHBOARD, label: 'Home', icon: LayoutDashboard },
            { id: ViewState.MY_JOBS, label: 'My Jobs', icon: Briefcase },
            { id: ViewState.SETTINGS, label: 'Settings', icon: Settings },
        ];
    };

    const navItems = getNavItems();

    const handleNavClick = (id: ViewState) => {
        // Mark jobs as seen when clicking My Jobs
        if (id === ViewState.MY_JOBS && isLineman) {
            handleMarkJobsAsSeen();
        }
        onChangeView(id);
    };

    // Dynamic Locale for Date
    const getLocale = (lang: Language) => {
        switch(lang) {
            case Language.PT: return 'pt-BR';
            case Language.ES: return 'es-ES';
            case Language.EN: return 'en-US';
            default: return 'en-US';
        }
    };

    const today = new Date();
    const dateStr = today.toLocaleDateString(getLocale(currentLang), { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();

    return (
        <div className="flex h-screen w-full overflow-hidden font-sans" style={{ background: 'var(--abyss)', color: 'var(--text-primary)' }}>

            {/* Desktop Floating Sidebar */}
            <div
                className="hidden lg:flex flex-col h-full z-20 transition-all duration-300 ease-out"
                style={{
                    width: isSidebarExpanded ? '240px' : '80px',
                    background: 'var(--surface)',
                    borderRight: '1px solid var(--border-subtle)'
                }}
                onMouseEnter={() => setIsSidebarExpanded(true)}
                onMouseLeave={() => setIsSidebarExpanded(false)}
            >
                {/* Logo */}
                <div className="h-20 flex items-center justify-center px-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <Logo className="w-10 h-10" showText={isSidebarExpanded} />
                </div>

                {/* Navigation - Clean, no divisions */}
                <div className="flex-1 py-6 px-3 space-y-2 overflow-y-auto scrollbar-hide">
                    {navItems.map(item => {
                        const showBadge = item.id === ViewState.MY_JOBS && isLineman && newJobCount > 0;
                        return (
                            <button
                                key={item.id}
                                onClick={() => handleNavClick(item.id)}
                                className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all duration-200 group relative"
                                style={{
                                    background: currentView === item.id ? 'var(--neural-dim)' : 'transparent',
                                }}
                            >
                                <div className="relative">
                                    <div
                                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200"
                                        style={{
                                            background: currentView === item.id ? 'var(--neural-core)' : 'var(--elevated)',
                                            boxShadow: currentView === item.id ? 'var(--shadow-neural)' : 'none'
                                        }}
                                    >
                                        <item.icon
                                            className="w-5 h-5 transition-colors"
                                            style={{ color: currentView === item.id ? '#ffffff' : 'var(--text-tertiary)' }}
                                        />
                                    </div>
                                    {/* New job badge */}
                                    {showBadge && (
                                        <span
                                            className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white animate-pulse"
                                            style={{ background: 'var(--neural-core)', boxShadow: 'var(--shadow-neural)' }}
                                        >
                                            {newJobCount > 9 ? '9+' : newJobCount}
                                        </span>
                                    )}
                                </div>
                                <span
                                    className="text-sm font-semibold whitespace-nowrap transition-all duration-200"
                                    style={{
                                        opacity: isSidebarExpanded ? 1 : 0,
                                        color: currentView === item.id ? 'var(--neural-core)' : 'var(--text-secondary)'
                                    }}
                                >
                                    {item.label}
                                </span>
                                {currentView === item.id && isSidebarExpanded && (
                                    <ChevronRight className="w-4 h-4 ml-auto" style={{ color: 'var(--neural-core)' }} />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Bottom Actions - Minimal */}
                <div className="p-3 space-y-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    {/* Language Selector */}
                    <div className="relative">
                        <button
                            onClick={() => setIsLangOpen(!isLangOpen)}
                            className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all duration-200"
                            style={{ background: 'var(--elevated)' }}
                        >
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--deep)' }}>
                                <Globe className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                            </div>
                            <span
                                className="text-sm font-semibold whitespace-nowrap transition-opacity duration-200"
                                style={{ opacity: isSidebarExpanded ? 1 : 0, color: 'var(--text-secondary)' }}
                            >
                                {currentLang}
                            </span>
                        </button>
                        {isLangOpen && (
                            <div
                                className="absolute bottom-full left-0 mb-2 rounded-2xl p-2 z-50 min-w-[120px]"
                                style={{ background: 'var(--surface)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-float)' }}
                            >
                                {Object.values(Language).map(l => (
                                    <button
                                        key={l}
                                        onClick={() => { onChangeLang(l); setIsLangOpen(false); }}
                                        className="w-full px-4 py-2.5 text-sm font-semibold rounded-xl transition-colors text-left"
                                        style={{
                                            color: currentLang === l ? 'var(--neural-core)' : 'var(--text-secondary)',
                                            background: currentLang === l ? 'var(--neural-dim)' : 'transparent'
                                        }}
                                    >
                                        {l}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Logout */}
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all duration-200"
                        style={{ background: 'transparent' }}
                    >
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(220, 38, 38, 0.1)' }}>
                            <LogOut className="w-5 h-5" style={{ color: 'var(--critical-core)' }} />
                        </div>
                        <span
                            className="text-sm font-semibold whitespace-nowrap transition-opacity duration-200"
                            style={{ opacity: isSidebarExpanded ? 1 : 0, color: 'var(--critical-core)' }}
                        >
                            Logout
                        </span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full overflow-hidden relative" style={{ background: 'var(--abyss)' }}>
                {/* Subtle grid background */}
                <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none"></div>

                {/* Top Header Bar - Responsive */}
                <header
                    className="h-16 lg:h-20 backdrop-blur-md flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30 relative"
                    style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(20px)' }}
                >
                    {/* Left - Logo on mobile */}
                    <div className="flex items-center gap-3">
                        <div className="lg:hidden">
                            <Logo className="w-8 h-8" showText={false} />
                        </div>
                        {/* Date Pill - Hidden on mobile */}
                        <div className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: 'var(--elevated)', border: '1px solid var(--border-subtle)' }}>
                            <div className="w-2 h-2 rounded-full" style={{ background: 'var(--online-core)' }}></div>
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{dateStr}</span>
                        </div>
                    </div>

                    {/* Right - User & Notifications */}
                    <div className="flex items-center gap-2 lg:gap-6">
                        {/* Profile Button with Dropdown - Always visible */}
                        <div className="relative">
                            <button
                                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                                className="flex items-center gap-2 px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl transition-all"
                                style={{ background: 'var(--elevated)', border: '1px solid var(--border-subtle)' }}
                            >
                                <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black"
                                    style={{ background: 'var(--neural-dim)', color: 'var(--neural-core)' }}
                                >
                                    {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                                </div>
                                <div className="hidden sm:block text-left">
                                    <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-ghost)' }}>{t.user_label}</p>
                                    <p className="text-xs font-bold" style={{ color: 'var(--neural-core)' }}>{user?.name || user?.role || t.guest}</p>
                                </div>
                                <ChevronRight
                                    className="w-4 h-4 transition-transform"
                                    style={{
                                        color: 'var(--text-tertiary)',
                                        transform: isProfileMenuOpen ? 'rotate(90deg)' : 'rotate(0deg)'
                                    }}
                                />
                            </button>

                            {/* Profile Dropdown Menu */}
                            {isProfileMenuOpen && (
                                <>
                                    {/* Backdrop to close menu */}
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setIsProfileMenuOpen(false)}
                                    />
                                    <div
                                        className="absolute top-full right-0 mt-2 rounded-2xl p-3 z-50 min-w-[200px]"
                                        style={{ background: 'var(--surface)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-float)' }}
                                    >
                                        {/* User Info Header */}
                                        <div className="px-3 py-3 rounded-xl mb-2" style={{ background: 'var(--elevated)' }}>
                                            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{user?.name || 'User'}</p>
                                            <p className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>{user?.email}</p>
                                            <p className="text-[9px] font-bold uppercase tracking-wider mt-1" style={{ color: 'var(--neural-core)' }}>{user?.role}</p>
                                        </div>

                                        {/* Language Selector */}
                                        <div className="px-3 py-2">
                                            <p className="text-[9px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-ghost)' }}>Language</p>
                                            <div className="flex gap-2">
                                                {Object.values(Language).map(l => (
                                                    <button
                                                        key={l}
                                                        onClick={() => { onChangeLang(l); setIsProfileMenuOpen(false); }}
                                                        className="flex-1 py-2 text-xs font-bold rounded-lg transition-colors"
                                                        style={{
                                                            color: currentLang === l ? 'var(--neural-core)' : 'var(--text-tertiary)',
                                                            background: currentLang === l ? 'var(--neural-dim)' : 'var(--elevated)'
                                                        }}
                                                    >
                                                        {l}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="my-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}></div>

                                        {/* Settings - Available for all users */}
                                        <button
                                            onClick={() => { onChangeView(ViewState.SETTINGS); setIsProfileMenuOpen(false); }}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                                            style={{ background: 'transparent' }}
                                        >
                                            <Settings className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                                            <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Settings</span>
                                        </button>

                                        {/* Logout */}
                                        <button
                                            onClick={() => { onLogout(); setIsProfileMenuOpen(false); }}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mt-1"
                                            style={{ background: 'rgba(220, 38, 38, 0.1)' }}
                                        >
                                            <LogOut className="w-5 h-5" style={{ color: 'var(--critical-core)' }} />
                                            <span className="text-sm font-semibold" style={{ color: 'var(--critical-core)' }}>Logout</span>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                        {/* Notification Bell */}
                        <button
                            onClick={() => {
                                if (isLineman && newJobCount > 0) {
                                    handleMarkJobsAsSeen();
                                    onChangeView(ViewState.MY_JOBS);
                                }
                            }}
                            className="relative p-2.5 lg:p-3 rounded-xl transition-all"
                            style={{ background: 'var(--elevated)', border: '1px solid var(--border-subtle)' }}
                        >
                            <Bell className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                            {/* Show badge only for linemen with new jobs */}
                            {isLineman && newJobCount > 0 && (
                                <span
                                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white animate-pulse"
                                    style={{ background: 'var(--neural-core)', boxShadow: 'var(--shadow-neural)' }}
                                >
                                    {newJobCount > 9 ? '9+' : newJobCount}
                                </span>
                            )}
                        </button>
                    </div>
                </header>

                {/* Main Content Area */}
                <main className="flex-1 overflow-y-auto p-4 lg:p-8 pb-24 lg:pb-8 scrollbar-hide relative">
                    <div className="max-w-[1600px] mx-auto">
                        {children}
                    </div>
                </main>

                {/* Mobile Bottom Navigation */}
                <nav
                    className="lg:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-2"
                    style={{ background: 'linear-gradient(to top, var(--surface) 70%, transparent)' }}
                >
                    <div
                        className="flex items-center justify-around py-2 px-2 rounded-2xl mx-auto max-w-md"
                        style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border-default)',
                            boxShadow: '0 -4px 30px rgba(0, 0, 0, 0.08)'
                        }}
                    >
                        {navItems.slice(0, 4).map(item => {
                            const showBadge = item.id === ViewState.MY_JOBS && isLineman && newJobCount > 0;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => handleNavClick(item.id)}
                                    className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all min-w-[60px]"
                                    style={{
                                        background: currentView === item.id ? 'var(--neural-dim)' : 'transparent',
                                    }}
                                >
                                    <div className="relative">
                                        <div
                                            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
                                            style={{
                                                background: currentView === item.id ? 'var(--neural-core)' : 'transparent',
                                                boxShadow: currentView === item.id ? 'var(--shadow-neural)' : 'none'
                                            }}
                                        >
                                            <item.icon
                                                className="w-5 h-5"
                                                style={{ color: currentView === item.id ? '#ffffff' : 'var(--text-tertiary)' }}
                                            />
                                        </div>
                                        {/* New job badge mobile */}
                                        {showBadge && (
                                            <span
                                                className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white animate-pulse"
                                                style={{ background: 'var(--neural-core)', boxShadow: 'var(--shadow-neural)' }}
                                            >
                                                {newJobCount > 9 ? '9+' : newJobCount}
                                            </span>
                                        )}
                                    </div>
                                    <span
                                        className="text-[9px] font-bold uppercase tracking-wider"
                                        style={{ color: currentView === item.id ? 'var(--neural-core)' : 'var(--text-ghost)' }}
                                    >
                                        {item.label}
                                    </span>
                                </button>
                            );
                        })}

                        {/* More menu for additional items on mobile */}
                        {navItems.length > 4 && (
                            <div className="relative">
                                <button
                                    onClick={() => setIsLangOpen(!isLangOpen)}
                                    className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all min-w-[60px]"
                                >
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'transparent' }}>
                                        <Settings className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                                    </div>
                                    <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-ghost)' }}>
                                        More
                                    </span>
                                </button>

                                {isLangOpen && (
                                    <div
                                        className="absolute bottom-full right-0 mb-2 rounded-2xl p-3 z-50 min-w-[160px]"
                                        style={{ background: 'var(--surface)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-float)' }}
                                    >
                                        {/* Additional nav items */}
                                        {navItems.slice(4).map(item => (
                                            <button
                                                key={item.id}
                                                onClick={() => { handleNavClick(item.id); setIsLangOpen(false); }}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                                                style={{ background: currentView === item.id ? 'var(--neural-dim)' : 'transparent' }}
                                            >
                                                <item.icon className="w-5 h-5" style={{ color: currentView === item.id ? 'var(--neural-core)' : 'var(--text-tertiary)' }} />
                                                <span className="text-sm font-semibold" style={{ color: currentView === item.id ? 'var(--neural-core)' : 'var(--text-secondary)' }}>
                                                    {item.label}
                                                </span>
                                            </button>
                                        ))}

                                        <div className="my-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}></div>

                                        {/* Language Options */}
                                        <div className="flex gap-2 px-3 py-2">
                                            {Object.values(Language).map(l => (
                                                <button
                                                    key={l}
                                                    onClick={() => { onChangeLang(l); setIsLangOpen(false); }}
                                                    className="flex-1 py-2 text-xs font-bold rounded-lg transition-colors"
                                                    style={{
                                                        color: currentLang === l ? 'var(--neural-core)' : 'var(--text-tertiary)',
                                                        background: currentLang === l ? 'var(--neural-dim)' : 'var(--elevated)'
                                                    }}
                                                >
                                                    {l}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Logout */}
                                        <button
                                            onClick={onLogout}
                                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mt-1"
                                            style={{ background: 'rgba(220, 38, 38, 0.1)' }}
                                        >
                                            <LogOut className="w-5 h-5" style={{ color: 'var(--critical-core)' }} />
                                            <span className="text-sm font-semibold" style={{ color: 'var(--critical-core)' }}>Logout</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </nav>
            </div>
        </div>
    );
};

export default Layout;