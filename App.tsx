import React, { useState, useCallback, useEffect, lazy, Suspense, useMemo } from 'react';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import AuthPage from './components/AuthPage';
import FiberLoader from './components/FiberLoader';
import { storage } from './services/storageService';
import { analyzeMapBoQ } from './services/geminiService';
import { aiProcessingService } from './services/aiProcessingService';
import { ViewState, Notification, User, Invoice, Transaction, UnitRates, AuditResult, Language, AuditFile, MapAuditReport } from './types';

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

const INITIAL_RATES: UnitRates = { fiber: 0.35, anchor: 18.00 };

// [rendering-hoist-jsx] - Loading fallback hoisted outside component
const LoadingFallback = (
    <div className="flex items-center justify-center h-[50vh]">
        <FiberLoader size={80} text="Loading..." />
    </div>
);

const App: React.FC = () => {
    // [rerender-lazy-state-init] - Use function for expensive initial state
    const [user, setUser] = useState<User | null>(() => storage.getUser());
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

    // [rerender-functional-setstate] - Stable callback using functional setState
    const handleLogin = useCallback((newUser: User) => {
        storage.saveUser(newUser);
        setUser(newUser);
    }, []);

    const handleLogout = useCallback(() => {
        storage.saveUser(null);
        setUser(null);
        setCurrentView(ViewState.DASHBOARD);
    }, []);

    const handleUpdateRates = useCallback((newRates: UnitRates) => {
        setRates(newRates);
        storage.saveRates(newRates);
    }, []);

    const runGlobalAnalysis = useCallback(async () => {
        // [js-early-exit] - Return early for invalid states
        if (isGlobalAnalyzing) return;

        const idleFile = auditQueue.find(f => f.status === 'idle');
        if (!idleFile) return;

        setIsGlobalAnalyzing(true);
        // [rerender-functional-setstate] - Use functional update
        setAuditQueue(prev => prev.map(f => f.id === idleFile.id ? { ...f, status: 'analyzing' } : f));

        try {
            const result = await analyzeMapBoQ(idleFile.base64, 'application/pdf', currentLang);
            setAuditQueue(prev => prev.map(f => f.id === idleFile.id ? { ...f, result, status: 'completed' } : f));
        } catch (error) {
            console.error("Analysis Error:", error);
            setAuditQueue(prev => prev.map(f => f.id === idleFile.id ? { ...f, status: 'error' } : f));
        } finally {
            setIsGlobalAnalyzing(false);
        }
    }, [auditQueue, isGlobalAnalyzing, currentLang]);

    useEffect(() => {
        if (hasIdleFiles && !isGlobalAnalyzing) {
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
            case ViewState.SUBMIT_WORK:
                return <DailyProductionForm user={user} lang={currentLang} />;
            case ViewState.MY_SUBMISSIONS:
                return <OwnerInbox lang={currentLang} />; // Reuse with filter for lineman's own submissions

            // Owner/Admin views
            case ViewState.INBOX:
                return <OwnerInbox lang={currentLang} />;
            case ViewState.BY_CLIENT:
                return <OwnerInbox lang={currentLang} />; // TODO: Add client filter mode
            case ViewState.BY_PROJECT:
                return <OwnerInbox lang={currentLang} />; // TODO: Add project filter mode

            // Existing views
            case ViewState.MAPS:
            case ViewState.BOQ:
                return <MapAudit rates={rates} lang={currentLang} auditQueue={auditQueue} setAuditQueue={setAuditQueue} isAnalyzing={isGlobalAnalyzing} user={user} onSaveToReports={handleSaveMapReport} />;
            case ViewState.AUDIT:
                return <AuditUpload onAnalysisComplete={(res) => { setAllAudits(prev => { const n = [res, ...prev]; storage.saveAudit(res); return n; }); }} lang={currentLang} user={user} />;
            case ViewState.REPORTS:
                return <TechnicalReports user={user} auditData={allAudits} mapReports={mapReports} lang={currentLang} />;
            case ViewState.AGENCY:
                return <AgencyHub lang={currentLang} />;
            case ViewState.PRODUCTION:
                return <DailyProductionForm user={user} lang={currentLang} />;
            case ViewState.FINANCE_HUB:
                return <BillingApp />;
            case ViewState.MAP_ANALYZER:
                return <FiberMapTester />;
            case ViewState.ADMIN:
                return <AdminPortal invoices={invoices} rates={rates} onUpdateRates={handleUpdateRates} user={user} onUpdateUser={setUser} onPayInvoice={() => {}} lang={currentLang} />;
            default:
                // Default view based on role
                return user.role === 'ADMIN'
                    ? <OwnerInbox lang={currentLang} />
                    : <Dashboard onNavigate={setCurrentView} invoices={invoices} transactions={transactions} user={user} lang={currentLang} />;
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
    );
};

export default App;
