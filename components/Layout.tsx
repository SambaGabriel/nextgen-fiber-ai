import React, { useState, useEffect, useCallback } from 'react';
import { ViewState, Notification, User, Language } from '../types';
import { translations } from '../services/translations';
import {
    LayoutDashboard, LogOut, Globe, Settings, Bell, ClipboardList, Wallet, ScanLine, ChevronRight,
    Upload, History, FolderOpen, Mic, Briefcase, DollarSign, Loader2, Menu
} from 'lucide-react';
import Logo from './Logo';
import { jobStorageSupabase } from '../services/jobStorageSupabase';
import { jobNotificationService } from '../services/jobNotificationService';
import MobileBottomNav from './mobile/MobileBottomNav';
import { useIsMobile } from '../hooks/useMobile';

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
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [newJobCount, setNewJobCount] = useState(0);
    const [assignedJobIds, setAssignedJobIds] = useState<string[]>([]);
    const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

    // Mobile detection using custom hook
    const isMobile = useIsMobile();

    // Role-based access helpers (case-insensitive)
    const userRole = (user?.role || 'LINEMAN').toUpperCase();
    const isAdmin = userRole === 'ADMIN';
    const isSupervisor = userRole === 'SUPERVISOR';
    const isLineman = userRole === 'LINEMAN';
    const isForeman = userRole === 'FOREMAN';
    const isRedlineSpecialist = userRole === 'REDLINE_SPECIALIST';
    const isClientReviewer = userRole === 'CLIENT_REVIEWER';
    const isBilling = userRole === 'BILLING';
    const isTruckInvestor = userRole === 'TRUCK_INVESTOR';
    const isDrillInvestor = userRole === 'DRILL_INVESTOR';
    const isInvestor = isTruckInvestor || isDrillInvestor;
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
        // Admin/Supervisor - Full access (Redlines are now handled inside Jobs)
        if (isAdmin || isSupervisor) {
            return [
                { id: ViewState.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
                { id: ViewState.JOBS_ADMIN, label: 'Jobs', icon: Briefcase, subItems: [
                    { id: ViewState.TRUCKS, label: 'Trucks' },
                    { id: ViewState.DRILLS, label: 'Drills' },
                ]},
                { id: ViewState.PAYROLL, label: 'Payroll', icon: DollarSign },
                { id: ViewState.MAP_ANALYZER, label: 'Maps', icon: ScanLine },
                { id: ViewState.RATE_CARDS, label: 'Rate Cards', icon: DollarSign },
                { id: ViewState.ANALYTICS, label: 'Analytics', icon: ClipboardList },
                { id: ViewState.SETTINGS, label: 'Settings', icon: Settings },
            ];
        }

        // Lineman - Field work focused (Aerial)
        if (isLineman) {
            return [
                { id: ViewState.DASHBOARD, label: 'Home', icon: LayoutDashboard },
                { id: ViewState.MY_JOBS, label: 'My Jobs', icon: Briefcase },
                { id: ViewState.MY_PAYSTUBS, label: 'Pay Stubs', icon: DollarSign },
                { id: ViewState.MY_SUBMISSIONS, label: 'History', icon: History },
                { id: ViewState.SETTINGS, label: 'Settings', icon: Settings },
            ];
        }

        // Foreman - Underground work (Day rate + conduit)
        if (isForeman) {
            return [
                { id: ViewState.DASHBOARD, label: 'Home', icon: LayoutDashboard },
                { id: ViewState.MY_JOBS, label: 'My Jobs', icon: Briefcase },
                { id: ViewState.MY_PAYSTUBS, label: 'Pay Stubs', icon: DollarSign },
                { id: ViewState.SETTINGS, label: 'Settings', icon: Settings },
            ];
        }

        // Truck Investor - View trucks and returns
        if (isTruckInvestor) {
            return [
                { id: ViewState.INVESTOR_DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
                { id: ViewState.INVESTOR_TRUCKS, label: 'My Trucks', icon: Briefcase },
                { id: ViewState.INVESTOR_STATEMENTS, label: 'Statements', icon: DollarSign },
                { id: ViewState.SETTINGS, label: 'Settings', icon: Settings },
            ];
        }

        // Drill Investor - View drills and returns
        if (isDrillInvestor) {
            return [
                { id: ViewState.INVESTOR_DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
                { id: ViewState.INVESTOR_DRILLS, label: 'My Drills', icon: Briefcase },
                { id: ViewState.INVESTOR_STATEMENTS, label: 'Statements', icon: DollarSign },
                { id: ViewState.SETTINGS, label: 'Settings', icon: Settings },
            ];
        }

        // Redline Specialist - Jobs access for uploading job redlines (NO rates visibility)
        if (isRedlineSpecialist) {
            return [
                { id: ViewState.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
                { id: ViewState.JOBS_ADMIN, label: 'Jobs', icon: Briefcase },
                { id: ViewState.SETTINGS, label: 'Settings', icon: Settings },
            ];
        }

        // Client Reviewer - Portal access (redline review is inside Job Details)
        if (isClientReviewer) {
            return [
                { id: ViewState.CLIENT_PORTAL, label: 'Portal', icon: LayoutDashboard },
                { id: ViewState.CLIENT_JOBS, label: 'Jobs', icon: Briefcase },
                { id: ViewState.SETTINGS, label: 'Settings', icon: Settings },
            ];
        }

        // Billing - Financial focus
        if (isBilling) {
            return [
                { id: ViewState.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
                { id: ViewState.PAYROLL, label: 'Payroll', icon: DollarSign },
                { id: ViewState.ANALYTICS, label: 'Analytics', icon: ClipboardList },
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
                    {navItems.map((item: any) => {
                        const showBadge = item.id === ViewState.MY_JOBS && isLineman && newJobCount > 0;
                        const hasSubItems = item.subItems && item.subItems.length > 0;
                        const isExpanded = expandedMenus.includes(item.id);
                        const isActiveOrHasActiveChild = currentView === item.id || (hasSubItems && item.subItems.some((sub: any) => sub.id === currentView));

                        return (
                            <div key={item.id}>
                                <button
                                    onClick={() => {
                                        if (hasSubItems) {
                                            setExpandedMenus(prev =>
                                                prev.includes(item.id)
                                                    ? prev.filter(id => id !== item.id)
                                                    : [...prev, item.id]
                                            );
                                        }
                                        handleNavClick(item.id);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all duration-200 group relative"
                                    style={{
                                        background: isActiveOrHasActiveChild ? 'var(--neural-dim)' : 'transparent',
                                    }}
                                >
                                    <div className="relative">
                                        <div
                                            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200"
                                            style={{
                                                background: isActiveOrHasActiveChild ? 'var(--neural-core)' : 'var(--elevated)',
                                                boxShadow: isActiveOrHasActiveChild ? 'var(--shadow-neural)' : 'none'
                                            }}
                                        >
                                            <item.icon
                                                className="w-5 h-5 transition-colors"
                                                style={{ color: isActiveOrHasActiveChild ? '#ffffff' : 'var(--text-tertiary)' }}
                                            />
                                        </div>
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
                                            color: isActiveOrHasActiveChild ? 'var(--neural-core)' : 'var(--text-secondary)'
                                        }}
                                    >
                                        {item.label}
                                    </span>
                                    {hasSubItems && isSidebarExpanded && (
                                        <ChevronRight
                                            className="w-4 h-4 ml-auto transition-transform"
                                            style={{
                                                color: 'var(--text-tertiary)',
                                                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                                            }}
                                        />
                                    )}
                                    {!hasSubItems && isActiveOrHasActiveChild && isSidebarExpanded && (
                                        <ChevronRight className="w-4 h-4 ml-auto" style={{ color: 'var(--neural-core)' }} />
                                    )}
                                </button>
                                {/* Sub-items */}
                                {hasSubItems && isExpanded && isSidebarExpanded && (
                                    <div className="ml-6 mt-1 space-y-1">
                                        {item.subItems.map((subItem: any) => (
                                            <button
                                                key={subItem.id}
                                                onClick={() => handleNavClick(subItem.id)}
                                                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200"
                                                style={{
                                                    background: currentView === subItem.id ? 'var(--elevated)' : 'transparent',
                                                }}
                                            >
                                                <div
                                                    className="w-2 h-2 rounded-full"
                                                    style={{
                                                        background: currentView === subItem.id ? 'var(--neural-core)' : 'var(--text-ghost)'
                                                    }}
                                                />
                                                <span
                                                    className="text-xs font-medium"
                                                    style={{
                                                        color: currentView === subItem.id ? 'var(--neural-core)' : 'var(--text-tertiary)'
                                                    }}
                                                >
                                                    {subItem.label}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
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
                    {/* Left - Hamburger menu + Logo on mobile */}
                    <div className="flex items-center gap-3">
                        {/* Hamburger Menu Button - Mobile only */}
                        <button
                            className="lg:hidden p-2 rounded-xl transition-all"
                            style={{ background: 'var(--elevated)', border: '1px solid var(--border-subtle)' }}
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            aria-label="Toggle menu"
                        >
                            <Menu className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                        </button>
                        {/* Logo - Smaller on mobile */}
                        <div className="lg:hidden">
                            <Logo className="w-6 h-6 sm:w-8 sm:h-8" showText={false} />
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
                                    className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-black"
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
                <main
                    className={`flex-1 overflow-y-auto p-4 lg:p-8 scrollbar-hide relative ${isMobile ? 'mobile-content' : ''}`}
                    style={{
                        paddingBottom: isMobile ? '80px' : '32px',
                        WebkitOverflowScrolling: 'touch', // Momentum scroll for iOS
                    }}
                >
                    <div className="max-w-[1600px] mx-auto">
                        {children}
                    </div>
                </main>

                {/* Mobile Bottom Navigation - Using MobileBottomNav component */}
                {isMobile && (
                    <MobileBottomNav
                        currentView={currentView}
                        onChangeView={handleNavClick}
                        user={user}
                        unreadCount={newJobCount}
                    />
                )}

                {/* Mobile Side Menu Overlay */}
                {isMobile && isMobileMenuOpen && (
                    <>
                        {/* Backdrop */}
                        <div
                            className="fixed inset-0 bg-black/50 z-40"
                            onClick={() => setIsMobileMenuOpen(false)}
                        />
                        {/* Side Menu Panel */}
                        <div
                            className="fixed top-0 left-0 h-full w-72 z-50 p-4 overflow-y-auto"
                            style={{
                                background: 'var(--surface)',
                                boxShadow: 'var(--shadow-float)',
                                WebkitOverflowScrolling: 'touch'
                            }}
                        >
                            {/* Menu Header */}
                            <div className="flex items-center justify-between mb-6 pb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <Logo className="w-8 h-8" showText={true} />
                                <button
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="p-2 rounded-xl"
                                    style={{ background: 'var(--elevated)' }}
                                >
                                    <ChevronRight className="w-5 h-5" style={{ color: 'var(--text-tertiary)', transform: 'rotate(180deg)' }} />
                                </button>
                            </div>

                            {/* Navigation Items */}
                            <div className="space-y-2">
                                {navItems.map((item: any) => {
                                    const showBadge = item.id === ViewState.MY_JOBS && isLineman && newJobCount > 0;
                                    const hasSubItems = item.subItems && item.subItems.length > 0;
                                    const isExpanded = expandedMenus.includes(item.id);
                                    const isActiveOrHasActiveChild = currentView === item.id || (hasSubItems && item.subItems.some((sub: any) => sub.id === currentView));

                                    return (
                                        <div key={item.id}>
                                            <button
                                                onClick={() => {
                                                    if (hasSubItems) {
                                                        setExpandedMenus(prev =>
                                                            prev.includes(item.id)
                                                                ? prev.filter(id => id !== item.id)
                                                                : [...prev, item.id]
                                                        );
                                                    } else {
                                                        handleNavClick(item.id);
                                                        setIsMobileMenuOpen(false);
                                                    }
                                                }}
                                                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all"
                                                style={{
                                                    background: isActiveOrHasActiveChild ? 'var(--neural-dim)' : 'transparent',
                                                }}
                                            >
                                                <div className="relative">
                                                    <div
                                                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                                                        style={{
                                                            background: isActiveOrHasActiveChild ? 'var(--neural-core)' : 'var(--elevated)',
                                                        }}
                                                    >
                                                        <item.icon
                                                            className="w-5 h-5"
                                                            style={{ color: isActiveOrHasActiveChild ? '#ffffff' : 'var(--text-tertiary)' }}
                                                        />
                                                    </div>
                                                    {showBadge && (
                                                        <span
                                                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                                                            style={{ background: 'var(--neural-core)' }}
                                                        >
                                                            {newJobCount > 9 ? '9+' : newJobCount}
                                                        </span>
                                                    )}
                                                </div>
                                                <span
                                                    className="text-sm font-semibold flex-1 text-left"
                                                    style={{ color: isActiveOrHasActiveChild ? 'var(--neural-core)' : 'var(--text-secondary)' }}
                                                >
                                                    {item.label}
                                                </span>
                                                {hasSubItems && (
                                                    <ChevronRight
                                                        className="w-4 h-4 transition-transform"
                                                        style={{
                                                            color: 'var(--text-tertiary)',
                                                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                                                        }}
                                                    />
                                                )}
                                            </button>
                                            {/* Sub-items for mobile */}
                                            {hasSubItems && isExpanded && (
                                                <div className="ml-6 mt-1 space-y-1">
                                                    {item.subItems.map((subItem: any) => (
                                                        <button
                                                            key={subItem.id}
                                                            onClick={() => {
                                                                handleNavClick(subItem.id);
                                                                setIsMobileMenuOpen(false);
                                                            }}
                                                            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all"
                                                            style={{
                                                                background: currentView === subItem.id ? 'var(--elevated)' : 'transparent',
                                                            }}
                                                        >
                                                            <div
                                                                className="w-2 h-2 rounded-full"
                                                                style={{
                                                                    background: currentView === subItem.id ? 'var(--neural-core)' : 'var(--text-ghost)'
                                                                }}
                                                            />
                                                            <span
                                                                className="text-sm font-medium"
                                                                style={{
                                                                    color: currentView === subItem.id ? 'var(--neural-core)' : 'var(--text-tertiary)'
                                                                }}
                                                            >
                                                                {subItem.label}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Language Options */}
                            <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                <p className="text-[9px] font-bold uppercase tracking-wider mb-3 px-3" style={{ color: 'var(--text-ghost)' }}>Language</p>
                                <div className="flex gap-2 px-3">
                                    {Object.values(Language).map(l => (
                                        <button
                                            key={l}
                                            onClick={() => { onChangeLang(l); setIsMobileMenuOpen(false); }}
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

                            {/* Logout Button */}
                            <div className="mt-4 px-3">
                                <button
                                    onClick={() => { onLogout(); setIsMobileMenuOpen(false); }}
                                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl"
                                    style={{ background: 'rgba(220, 38, 38, 0.1)' }}
                                >
                                    <LogOut className="w-5 h-5" style={{ color: 'var(--critical-core)' }} />
                                    <span className="text-sm font-semibold" style={{ color: 'var(--critical-core)' }}>Logout</span>
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default Layout;