import React, { useState, useCallback, useEffect, lazy, Suspense, useMemo, useRef } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import AuthPage from './components/AuthPage';
import FiberLoader from './components/FiberLoader';
import OfflineIndicator from './components/OfflineIndicator';
import { storage } from './services/storageService';
import { authService } from './services/supabase';
import { analyzeMapBoQ } from './services/claudeService';
import { aiProcessingService } from './services/aiProcessingService';
import { offlineSync } from './services/offlineSync';
import { ViewState, Notification, User, Invoice, Transaction, UnitRates, AuditResult, Language, AuditFile, MapAuditReport } from './types';
import { Job } from './types/project';

// [bundle-dynamic-imports] - Lazy load heavy components to reduce initial bundle size
const AdminPortal = lazy(() => import('./components/AdminPortal'));
const AuditUpload = lazy(() => import('./components/AuditUpload'));
const TechnicalReports = lazy(() => import('./components/TechnicalReports'));
const MapAudit = lazy(() => import('./components/MapAudit'));
const AgencyHub = lazy(() => import('./components/AgencyHub'));
const DailyProductionForm = lazy(() => import('./components/DailyProductionForm'));
const FiberMapTester = lazy(() => import('./components/FiberMapTester'));
// [bundle-barrel-imports] - Import directly instead of barrel file
const BillingApp = lazy(() => import('./components/billing/BillingApp'));
// New workflow components
const SubmitWork = lazy(() => import('./components/SubmitWork'));
const OwnerInbox = lazy(() => import('./components/OwnerInbox'));
// Lineman job workflow
const MyJobs = lazy(() => import('./components/MyJobs'));
const JobDetails = lazy(() => import('./components/JobDetails'));
// Admin jobs management
const JobsAdmin = lazy(() => import('./components/JobsAdmin'));
// Admin rate cards management (V2 with multi-column rates)
const RateCards = lazy(() => import('./components/RateCardsV2'));
// Settings (CRM enterprise)
const SettingsPage = lazy(() => import('./components/settings/Settings'));
// Redline workflow
const RedlineList = lazy(() => import('./components/redlines/RedlineList'));
const RedlineEditor = lazy(() => import('./components/redlines/RedlineEditor'));
// Client Portal
const ClientPortal = lazy(() => import('./components/client-portal/ClientPortal'));

const INITIAL_RATES: UnitRates = { fiber: 0.35, anchor: 18.00 };

// [rendering-hoist-jsx] - Loading fallback hoisted outside component
const LoadingFallback = (
    <div className="flex items-center justify-center h-[50vh]">
        <FiberLoader size={80} text="Loading..." />
    </div>
);

const App: React.FC = () => {
    // [app-always-login] - Always start with null user to show login page
    // User data is still saved in storage for reference, but requires fresh login each session
    const [user, setUser] = useState<User | null>(null);
    const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [rates, setRates] = useState<UnitRates>(() => storage.getRates() || INITIAL_RATES);
    const [invoices, setInvoices] = useState<Invoice[]>(() => storage.getInvoices());
    const [transactions, setTransactions] = useState<Transaction[]>(() => storage.getTransactions());
    const [allAudits, setAllAudits] = useState<AuditResult[]>(() => storage.getAudits());
    // [js-cache-storage] - Cache localStorage read in lazy init
    const [mapReports, setMapReports] = useState<MapAuditReport[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('fs_map_reports') || '[]');
        } catch {
            return [];
        }
    });
    const [currentLang, setCurrentLang] = useState<Language>(Language.PT);
    const [auditQueue, setAuditQueue] = useState<AuditFile[]>([]);
    const [isGlobalAnalyzing, setIsGlobalAnalyzing] = useState(false);
    // Selected job for lineman workflow
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    // Selected redline for editing
    const [selectedRedlineId, setSelectedRedlineId] = useState<string | null>(null);

    // Refs to track latest values without causing re-renders
    const auditQueueRef = useRef<AuditFile[]>([]);
    const isAnalyzingRef = useRef(false);

    // Keep refs in sync with state
    useEffect(() => {
        auditQueueRef.current = auditQueue;
    }, [auditQueue]);

    // [rerender-derived-state] - Derive hasIdleFiles during render instead of effect
    const hasIdleFiles = useMemo(() => auditQueue.some(f => f.status === 'idle'), [auditQueue]);

    useEffect(() => {
        localStorage.setItem('fs_map_reports', JSON.stringify(mapReports));
    }, [mapReports]);

    // [ai-processing] - Start AI processing queue when user is logged in
    useEffect(() => {
        if (user) {
            aiProcessingService.startProcessingQueue(currentLang);
            return () => aiProcessingService.stopProcessingQueue();
        }
    }, [user, currentLang]);

    // [offline-sync] - Initialize offline sync service
    useEffect(() => {
        const cleanup = offlineSync.init();
        return cleanup;
    }, []);

    // [rerender-functional-setstate] - Stable callback using functional setState
    const handleLogin = useCallback((newUser: User) => {
        storage.saveUser(newUser);
        setUser(newUser);
    }, []);

    const handleLogout = useCallback(async () => {
        try {
            await authService.signOut();
        } catch (err) {
            console.error('Logout error:', err);
        }
        // Clear all local state
        storage.saveUser(null);
        localStorage.removeItem('fs_jobs');
        localStorage.removeItem('fs_registered_users');
        setUser(null);
        setSelectedJob(null);
        setCurrentView(ViewState.DASHBOARD);
        // Force page reload to clear any cached session
        window.location.reload();
    }, []);

    // Job navigation handlers
    const handleSelectJob = useCallback((job: Job) => {
        setSelectedJob(job);
        setCurrentView(ViewState.JOB_DETAILS);
    }, []);

    const handleBackToJobs = useCallback(() => {
        setSelectedJob(null);
        setCurrentView(ViewState.MY_JOBS);
    }, []);

    const handleStartProduction = useCallback((job: Job) => {
        setSelectedJob(job);
        setCurrentView(ViewState.SUBMIT_WORK);
    }, []);

    // Redline navigation handlers
    const handleCreateRedline = useCallback(() => {
        setSelectedRedlineId(null);
        setCurrentView(ViewState.REDLINE_EDITOR);
    }, []);

    const handleSelectRedline = useCallback((redline: { id: string }) => {
        setSelectedRedlineId(redline.id);
        setCurrentView(ViewState.REDLINE_EDITOR);
    }, []);

    const handleBackToRedlines = useCallback(() => {
        setSelectedRedlineId(null);
        setCurrentView(ViewState.REDLINES);
    }, []);

    const handleUpdateRates = useCallback((newRates: UnitRates) => {
        setRates(newRates);
        storage.saveRates(newRates);
    }, []);

    const runGlobalAnalysis = useCallback(async () => {
        // Use refs to avoid stale closures
        if (isAnalyzingRef.current) {
            console.log('[MapAnalysis] Already analyzing, skipping');
            return;
        }

        const idleFile = auditQueueRef.current.find(f => f.status === 'idle');
        if (!idleFile) {
            console.log('[MapAnalysis] No idle files in queue');
            return;
        }

        console.log('[MapAnalysis] Starting analysis for:', idleFile.name, 'base64 length:', idleFile.base64?.length);
        isAnalyzingRef.current = true;
        setIsGlobalAnalyzing(true);
        setAuditQueue(prev => prev.map(f => f.id === idleFile.id ? { ...f, status: 'analyzing' as const } : f));

        try {
            console.log('[MapAnalysis] Calling analyzeMapBoQ...');
            const result = await analyzeMapBoQ(idleFile.base64, 'application/pdf', currentLang);
            console.log('[MapAnalysis] analyzeMapBoQ returned!');
            console.log('[MapAnalysis] Completed successfully:', idleFile.name);
            console.log('[MapAnalysis] Result totalCableLength:', result?.totalCableLength);
            setAuditQueue(prev => prev.map(f => f.id === idleFile.id ? { ...f, result, status: 'completed' as const } : f));
        } catch (error: any) {
            console.error("[MapAnalysis] Error:", error?.message || error);
            setAuditQueue(prev => prev.map(f => f.id === idleFile.id ? { ...f, status: 'error' as const } : f));
        } finally {
            isAnalyzingRef.current = false;
            setIsGlobalAnalyzing(false);
            console.log('[MapAnalysis] Analysis finished, checking for more files...');
        }
    }, [currentLang]); // Only depend on language, use refs for queue state

    useEffect(() => {
        console.log('[MapAnalysis] Queue check - hasIdleFiles:', hasIdleFiles, 'isGlobalAnalyzing:', isGlobalAnalyzing);
        if (hasIdleFiles && !isGlobalAnalyzing) {
            console.log('[MapAnalysis] Triggering analysis...');
            runGlobalAnalysis();
        }
    }, [hasIdleFiles, isGlobalAnalyzing, runGlobalAnalysis]);

    const handleSaveMapReport = useCallback((report: MapAuditReport) => {
        setMapReports(prev => [report, ...prev]);
        setNotifications(prev => [{
            id: Date.now().toString(36),
            title: 'Relatório Salvo',
            message: `O documento ${report.fileName} foi arquivado no Cofre de Relatórios.`,
            type: 'success',
            timestamp: new Date().toISOString(),
            read: false
        }, ...prev]);
    }, []);

    // [rerender-functional-setstate] - Stable callback for language toggle
    const toggleLanguage = useCallback(() => {
        setCurrentLang(l => l === Language.PT ? Language.EN : l === Language.EN ? Language.ES : Language.PT);
    }, []);

    const renderContent = () => {
        // [js-early-exit] - Early return for null user
        if (!user) return null;

        // [rendering-conditional-render] - Using switch for multiple conditions
        switch (currentView) {
            // Lineman views
            case ViewState.DASHBOARD:
                return <Dashboard onNavigate={setCurrentView} invoices={invoices} transactions={transactions} user={user} lang={currentLang} />;
            case ViewState.MY_JOBS:
                return <MyJobs user={user} lang={currentLang} onSelectJob={handleSelectJob} />;
            case ViewState.JOB_DETAILS:
                return selectedJob ? (
                    <JobDetails
                        job={selectedJob}
                        user={user}
                        lang={currentLang}
                        onBack={handleBackToJobs}
                        onStartProduction={handleStartProduction}
                    />
                ) : <MyJobs user={user} lang={currentLang} onSelectJob={handleSelectJob} />;
            case ViewState.SUBMIT_WORK:
                return <DailyProductionForm user={user} lang={currentLang} job={selectedJob} onBack={selectedJob ? handleBackToJobs : undefined} />;
            case ViewState.MY_SUBMISSIONS:
                return <OwnerInbox lang={currentLang} />; // Reuse with filter for lineman's own submissions

            // Owner/Admin views
            case ViewState.JOBS_ADMIN:
                return <JobsAdmin user={user} lang={currentLang} />;
            case ViewState.RATE_CARDS:
                return <RateCards user={user} lang={currentLang} />;

            // Redline workflow
            case ViewState.REDLINES:
                return <RedlineList user={user} lang={currentLang} onCreateNew={handleCreateRedline} onSelectRedline={handleSelectRedline} />;
            case ViewState.REDLINE_EDITOR:
                return <RedlineEditor user={user} lang={currentLang} onCancel={handleBackToRedlines} onSave={handleBackToRedlines} />;

            // Client Portal
            case ViewState.CLIENT_PORTAL:
            case ViewState.CLIENT_JOBS:
            case ViewState.CLIENT_PRODUCTION:
            case ViewState.CLIENT_REDLINES:
                return <ClientPortal user={user} lang={currentLang} onNavigate={setCurrentView} />;

            // Team management
            case ViewState.TEAM:
                return <SettingsPage user={user} lang={currentLang} onUpdateUser={setUser} onLogout={handleLogout} />;

            // Existing views
            case ViewState.MAPS:
            case ViewState.BOQ:
                return <MapAudit rates={rates} lang={currentLang} auditQueue={auditQueue} setAuditQueue={setAuditQueue} isAnalyzing={isGlobalAnalyzing} user={user} onSaveToReports={handleSaveMapReport} />;
            case ViewState.AUDIT:
                return <AuditUpload onAnalysisComplete={(res) => { setAllAudits(prev => { const n = [res, ...prev]; storage.saveAudit(res); return n; }); }} lang={currentLang} user={user} />;
            case ViewState.REPORTS:
                return <TechnicalReports user={user} auditData={allAudits} mapReports={mapReports} lang={currentLang} />;
            case ViewState.AGENCY:
                return <AgencyHub />;
            case ViewState.PRODUCTION:
                return <DailyProductionForm user={user} lang={currentLang} />;
            case ViewState.FINANCE_HUB:
                return <BillingApp />;
            case ViewState.MAP_ANALYZER:
                return <FiberMapTester />;
            case ViewState.ADMIN:
                return <AdminPortal invoices={invoices} rates={rates} onUpdateRates={handleUpdateRates} user={user} onUpdateUser={setUser} onPayInvoice={() => {}} lang={currentLang} />;
            case ViewState.SETTINGS:
                return <SettingsPage user={user} lang={currentLang} onUpdateUser={setUser} onLogout={handleLogout} />;
            default:
                // Default view based on role
                return <Dashboard onNavigate={setCurrentView} invoices={invoices} transactions={transactions} user={user} lang={currentLang} />;
        }
    };

    // [rendering-conditional-render] - Use ternary instead of &&
    if (!user) {
        return (
            <div className="relative">
                <div className="fixed top-4 right-4 z-[200]">
                    <button
                        onClick={toggleLanguage}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-white transition-all backdrop-blur-md"
                    >
                        {currentLang}
                    </button>
                </div>
                <AuthPage onLogin={handleLogin} lang={currentLang} />
            </div>
        );
    }

    return (
        <>
            {/* Offline status indicator */}
            <OfflineIndicator lang={currentLang} />

            <Layout
                currentView={currentView}
                onChangeView={setCurrentView}
                notifications={notifications}
                onMarkAllRead={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                user={user}
                onLogout={handleLogout}
                currentLang={currentLang}
                onChangeLang={setCurrentLang}
            >
                {/* [bundle-dynamic-imports] - Suspense boundary for lazy components */}
                <Suspense fallback={LoadingFallback}>
                    {renderContent()}
                </Suspense>
            </Layout>
        </>
    );
};

export default App;
