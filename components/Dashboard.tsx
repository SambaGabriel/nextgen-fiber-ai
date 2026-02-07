import React, { useMemo, useCallback, memo, lazy, Suspense } from 'react';
import { AreaChart, Area, XAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, Activity, AlertTriangle, ChevronDown, CheckCircle2, Calendar, FileText, Download, Zap, Mic } from 'lucide-react';
import { ViewState, Invoice, Transaction, User, Language } from '../types';
import { translations } from '../services/translations';

// [bundle-dynamic-imports] - Lazy load LiveSupervisor (heavy audio component)
const LiveSupervisor = lazy(() => import('./LiveSupervisor'));

interface DashboardProps {
    onNavigate: (view: ViewState) => void;
    invoices: Invoice[];
    transactions: Transaction[];
    user: User;
    lang: Language;
}

// [rendering-hoist-jsx] - Hoist static chart data outside component
const CHART_DATA = [
    { name: 'S1', v: 4000 },
    { name: 'S2', v: 3000 },
    { name: 'S3', v: 5000 },
    { name: 'S4', v: 2780 },
    { name: 'S5', v: 1890 },
    { name: 'S6', v: 2390 },
    { name: 'S7', v: 3490 },
];

// [rerender-memo] - Memoize Dashboard to prevent unnecessary re-renders
const Dashboard = memo<DashboardProps>(({ invoices, user, lang }) => {
    const t = translations[lang];
    const [showLiveAgent, setShowLiveAgent] = React.useState(false);
    const [showReportMenu, setShowReportMenu] = React.useState(false);

    // [rerender-functional-setstate] - Stable callbacks
    const openLiveAgent = useCallback(() => setShowLiveAgent(true), []);
    const closeLiveAgent = useCallback(() => setShowLiveAgent(false), []);
    const toggleReportMenu = useCallback(() => setShowReportMenu(prev => !prev), []);

    return (
        <div className="space-y-8 animate-fade-in-up pb-12">

            {/* [bundle-dynamic-imports] - Suspense for lazy LiveSupervisor */}
            {showLiveAgent && (
                <Suspense fallback={null}>
                    <LiveSupervisor userName={user.name} onClose={closeLiveAgent} />
                </Suspense>
            )}

            {/* SUPERVISOR ONLINE - Hero Banner for Linemen ONLY */}
            {user.role === 'LINEMAN' && (
            <button
                onClick={openLiveAgent}
                className="w-full p-6 lg:p-8 rounded-3xl relative overflow-hidden group active:scale-[0.98] transition-all duration-300"
                style={{
                    background: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)',
                    boxShadow: '0 8px 40px rgba(16, 185, 129, 0.4), 0 0 0 1px rgba(16, 185, 129, 0.2)'
                }}
            >
                {/* Animated Background Pulse */}
                <div className="absolute inset-0 opacity-30">
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-white/20 animate-pulse" />
                </div>

                {/* Content */}
                <div className="relative flex flex-col lg:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4 lg:gap-6">
                        {/* Pulsing Icon */}
                        <div className="relative">
                            <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)' }}>
                                <Mic className="w-8 h-8 lg:w-10 lg:h-10 text-white" />
                            </div>
                            {/* Live Indicator */}
                            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white flex items-center justify-center">
                                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                                <div className="absolute w-2 h-2 rounded-full bg-emerald-500" />
                            </div>
                        </div>

                        <div className="text-left">
                            <p className="text-white/80 text-xs lg:text-sm font-bold uppercase tracking-wider mb-1">
                                {t.supervisor_online}
                            </p>
                            <h3 className="text-white text-2xl lg:text-3xl font-black tracking-tight">
                                Need Help? Tap Here
                            </h3>
                            <p className="text-white/70 text-sm mt-1 hidden lg:block">
                                Get instant AI-powered support for field operations
                            </p>
                        </div>
                    </div>

                    {/* Arrow indicator */}
                    <div className="flex items-center gap-2 text-white/80 group-hover:text-white transition-colors">
                        <span className="text-sm font-bold uppercase tracking-wider hidden lg:block">Start Chat</span>
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
                            <Zap className="w-6 h-6 text-white" />
                        </div>
                    </div>
                </div>
            </button>
            )}

            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-2 w-fit" style={{ background: 'var(--neural-dim)', border: '1px solid var(--border-neural)' }}>
                        <Calendar className="w-3 h-3" style={{ color: 'var(--neural-core)' }} />
                        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--neural-core)' }}>{t.month_prefix} {new Date().toLocaleString(lang === Language.PT ? 'pt-BR' : lang === Language.ES ? 'es-ES' : 'en-US', { month: 'long' })}</span>
                    </div>
                    <h2 className="text-4xl lg:text-5xl font-black tracking-tighter leading-none text-gradient-neural">{t.overview_title}</h2>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t.overview_subtitle}</p>
                </div>

                <div className="hidden lg:flex items-center gap-3">
                     {/* Report Dropdown */}
                     <div className="relative">
                        <button
                            onClick={toggleReportMenu}
                            className="px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 group btn-ghost"
                            style={{ background: 'var(--surface)' }}
                        >
                            <FileText className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                            {t.monthly_report}
                            <ChevronDown className={`w-3 h-3 transition-transform ${showReportMenu ? 'rotate-180' : ''}`} style={{ color: 'var(--text-tertiary)' }} />
                        </button>
                        {showReportMenu && (
                            <div
                                className="absolute top-full left-0 mt-2 py-2 rounded-xl shadow-lg z-50 min-w-[180px]"
                                style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}
                            >
                                <button
                                    className="w-full px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider hover:bg-white/5 flex items-center gap-3"
                                    style={{ color: 'var(--text-primary)' }}
                                    onClick={() => { setShowReportMenu(false); /* TODO: Generate weekly report */ }}
                                >
                                    <FileText className="w-4 h-4" style={{ color: 'var(--neural-core)' }} />
                                    {t.weekly_report}
                                </button>
                                <button
                                    className="w-full px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider hover:bg-white/5 flex items-center gap-3"
                                    style={{ color: 'var(--text-primary)' }}
                                    onClick={() => { setShowReportMenu(false); /* TODO: Generate monthly report */ }}
                                >
                                    <FileText className="w-4 h-4" style={{ color: 'var(--neural-core)' }} />
                                    {t.monthly_report}
                                </button>
                            </div>
                        )}
                     </div>
                     <button className="px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-3 group btn-ghost" style={{ background: 'var(--surface)' }}>
                        <Download className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                        {t.export}
                     </button>
                     <button className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 active:scale-95 btn-neural" style={{ background: 'var(--gradient-neural)', color: 'var(--void)', boxShadow: 'var(--shadow-neural)' }}>
                        <Zap className="w-4 h-4" />
                        {t.new_project}
                     </button>
                </div>
            </div>

            {/* Metrics Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

                {/* 1. Neural Highlight Card */}
                <div className="p-4 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300 neural-border" style={{ background: 'var(--gradient-neural)', boxShadow: 'var(--shadow-neural)' }}>
                     <div className="flex justify-between items-start mb-6 sm:mb-10">
                        <div className="p-3 rounded-2xl backdrop-blur-sm" style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <DollarSign className="w-6 h-6" style={{ color: 'var(--void)' }} />
                        </div>
                        <span className="px-2.5 py-1 rounded-lg backdrop-blur-md text-[10px] font-black" style={{ background: 'rgba(0,0,0,0.3)', color: 'white' }}>0%</span>
                     </div>
                     <div>
                        <h3 className="text-2xl sm:text-4xl font-black tracking-tighter mb-2" style={{ color: 'var(--void)' }}>$0.00</h3>
                        <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'rgba(0,0,0,0.7)' }}>{t.billing_month}</p>
                        <p className="text-[9px] sm:text-[10px] font-medium" style={{ color: 'rgba(0,0,0,0.5)' }}>{t.no_billing}</p>
                     </div>
                     <DollarSign className="absolute -bottom-8 -right-8 w-24 sm:w-40 h-24 sm:h-40 opacity-20 transform rotate-12" style={{ color: 'var(--void)' }} />
                </div>

                {/* 2. Surface Card */}
                <div className="p-4 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] relative overflow-hidden group hover:scale-[1.02] transition-all card-neural" style={{ background: 'var(--surface)' }}>
                     <div className="flex justify-between items-start mb-6 sm:mb-10">
                        <div className="p-3 rounded-2xl" style={{ background: 'var(--energy-pulse)', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
                            <Activity className="w-6 h-6" style={{ color: 'var(--energy-core)' }} />
                        </div>
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-black" style={{ background: 'var(--elevated)', color: 'var(--text-secondary)' }}>0%</span>
                     </div>
                     <div>
                        <h3 className="text-2xl sm:text-4xl font-black tracking-tighter mb-2" style={{ color: 'var(--text-primary)' }}>0 <span className="text-lg sm:text-xl font-bold" style={{ color: 'var(--text-ghost)' }}>ft</span></h3>
                        <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-tertiary)' }}>{t.total_footage}</p>
                        <p className="text-[9px] sm:text-[10px] font-medium" style={{ color: 'var(--text-ghost)' }}>{t.linear_construction}</p>
                     </div>
                </div>

                {/* 3. Surface Card */}
                <div className="p-4 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] relative overflow-hidden group hover:scale-[1.02] transition-all card-neural" style={{ background: 'var(--surface)' }}>
                     <div className="flex justify-between items-start mb-6 sm:mb-10">
                        <div className="p-3 rounded-2xl" style={{ background: 'var(--online-glow)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                            <CheckCircle2 className="w-6 h-6" style={{ color: 'var(--online-core)' }} />
                        </div>
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-black" style={{ background: 'var(--elevated)', color: 'var(--text-secondary)' }}>0%</span>
                     </div>
                     <div>
                        <h3 className="text-2xl sm:text-4xl font-black tracking-tighter mb-2" style={{ color: 'var(--text-primary)' }}>100%</h3>
                        <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-tertiary)' }}>{t.qc_compliance}</p>
                        <p className="text-[9px] sm:text-[10px] font-medium" style={{ color: 'var(--text-ghost)' }}>{t.avg_quality}</p>
                     </div>
                </div>

                {/* 4. Surface Card */}
                <div className="p-4 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] relative overflow-hidden group hover:scale-[1.02] transition-all card-neural" style={{ background: 'var(--surface)' }}>
                     <div className="flex justify-between items-start mb-6 sm:mb-10">
                        <div className="p-3 rounded-2xl" style={{ background: 'var(--elevated)', border: '1px solid var(--border-default)' }}>
                            <AlertTriangle className="w-6 h-6" style={{ color: 'var(--text-tertiary)' }} />
                        </div>
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-black" style={{ background: 'var(--elevated)', color: 'var(--text-secondary)' }}>0%</span>
                     </div>
                     <div>
                        <h3 className="text-2xl sm:text-4xl font-black tracking-tighter mb-2" style={{ color: 'var(--text-primary)' }}>0</h3>
                        <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--text-tertiary)' }}>{t.divergences}</p>
                        <p className="text-[9px] sm:text-[10px] font-medium" style={{ color: 'var(--text-ghost)' }}>{t.no_issues}</p>
                     </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

                {/* Large Chart Area */}
                <div className="lg:col-span-2 p-4 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2.5rem] flex flex-col h-[350px] sm:h-[450px] relative overflow-hidden neural-border" style={{ background: 'var(--surface)' }}>
                    {/* Subtle glow effect */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px" style={{ background: 'var(--gradient-neural)', opacity: 0.5 }}></div>

                    <div className="mb-4 sm:mb-8 flex items-start gap-3 sm:gap-4">
                        <div className="p-2 sm:p-3 rounded-xl" style={{ background: 'var(--neural-dim)', border: '1px solid var(--border-neural)' }}>
                            <Activity className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: 'var(--neural-core)' }} />
                        </div>
                        <div>
                             <h3 className="text-base sm:text-lg font-bold leading-none mb-1 sm:mb-2" style={{ color: 'var(--text-primary)' }}>{t.production_team}</h3>
                             <p className="text-[9px] sm:text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>{t.comp_performance}</p>
                        </div>
                    </div>

                    <div className="flex-1 w-full min-h-0 relative">
                         <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={CHART_DATA} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#00d4ff" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 700}} dy={15} />
                                <Tooltip
                                    contentStyle={{ background: 'var(--deep)', border: '1px solid var(--border-default)', borderRadius: '12px', fontSize: '11px', color: 'var(--text-primary)' }}
                                    itemStyle={{ textTransform: 'uppercase', color: 'var(--text-secondary)' }}
                                    cursor={{ stroke: 'var(--neural-glow)' }}
                                />
                                <Area type="monotone" dataKey="v" stroke="#00d4ff" strokeWidth={3} fillOpacity={1} fill="url(#colorProd)" />
                            </AreaChart>
                         </ResponsiveContainer>

                         {/* Empty State Overlay */}
                         <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <Activity className="w-24 h-24" style={{ color: 'var(--text-ghost)', opacity: 0.3 }} />
                         </div>
                    </div>
                </div>

                {/* Quality Gauge */}
                <div className="p-4 sm:p-8 lg:p-10 rounded-[1.5rem] sm:rounded-[2.5rem] flex flex-col h-[300px] sm:h-[450px] neural-border" style={{ background: 'var(--surface)' }}>
                    <div className="mb-4 sm:mb-8 flex items-start gap-3 sm:gap-4">
                         <div className="p-2 sm:p-3 rounded-xl" style={{ background: 'var(--online-glow)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: 'var(--online-core)' }} />
                         </div>
                         <div>
                             <h3 className="text-base sm:text-lg font-bold leading-none mb-1 sm:mb-2" style={{ color: 'var(--text-primary)' }}>{t.quality_title}</h3>
                             <p className="text-[9px] sm:text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>{t.auto_audit}</p>
                         </div>
                    </div>

                    <div className="flex-1 flex items-center justify-center relative">
                        {/* Custom SVG Gauge with Neural styling */}
                        <div className="relative w-40 h-40 sm:w-56 sm:h-56">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 224 224">
                                <defs>
                                    <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#00d4ff" />
                                        <stop offset="100%" stopColor="#10b981" />
                                    </linearGradient>
                                </defs>
                                <circle cx="112" cy="112" r="90" stroke="var(--elevated)" strokeWidth="20" fill="none" />
                                <circle
                                    cx="112" cy="112" r="90"
                                    stroke="url(#gaugeGradient)"
                                    strokeWidth="20"
                                    fill="none"
                                    strokeDasharray="565.48"
                                    strokeDashoffset="0"
                                    strokeLinecap="round"
                                    style={{ filter: 'drop-shadow(0 0 15px var(--online-glow))' }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-2xl sm:text-4xl font-black tracking-tighter text-gradient-neural">100%</span>
                                <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.15em] mt-1" style={{ color: 'var(--text-tertiary)' }}>{t.precision}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default Dashboard;