/**
 * DailyProductionForm - Tesla/SpaceX-inspired interface for production sheets
 * Modern minimalist design with premium feel
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
    Plus, Trash2, Save, Calendar, User as UserIcon,
    MapPin, Hash, Cable, Ruler, CheckCircle,
    Download, FileSpreadsheet, Clock,
    Building2, Layers, PlusCircle, Copy, RotateCcw, Send, ArrowLeft, Briefcase
} from 'lucide-react';
import { Language, User } from '../types';
import { Project, ProjectStatus, WorkType, LineItem, Job, JobStatus } from '../types/project';
import { projectStorage, clientStorage } from '../services/projectStorage';
import { jobStorage } from '../services/jobStorage';

interface DailyProductionFormProps {
    user: User;
    lang: Language;
    job?: Job | null;        // Optional linked job
    onBack?: () => void;     // Optional back navigation
}

interface SpanEntry {
    id: string;
    spanFeet: number | null;
    anchor: boolean;
    fiberNumber: string;
    coil: boolean;
    snowshoe: boolean;
    notes: string;
}

interface ProductionHeader {
    lineman: string;
    startDate: string;
    endDate: string;
    city: string;
    projectOLT: string;
    bspd: string;
    fibraCT: string;
    prints: string;
    strandType: 'STRAND' | 'FIBER' | 'OVERLASH';
    clientId: string;
}

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

const INITIAL_HEADER: ProductionHeader = {
    lineman: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    city: '',
    projectOLT: '',
    bspd: '',
    fibraCT: '',
    prints: '',
    strandType: 'STRAND',
    clientId: ''
};

const createEmptyEntry = (): SpanEntry => ({
    id: generateId(),
    spanFeet: null,
    anchor: false,
    fiberNumber: '',
    coil: false,
    snowshoe: false,
    notes: ''
});

const DailyProductionForm: React.FC<DailyProductionFormProps> = ({ user, lang, job, onBack }) => {
    // Initialize header with job data if linked
    const [header, setHeader] = useState<ProductionHeader>(() => ({
        ...INITIAL_HEADER,
        lineman: user.name,
        city: job?.location?.city || '',
        projectOLT: job?.title || '',
        bspd: job?.jobCode || '',
        strandType: job?.workType === WorkType.OVERLASH ? 'OVERLASH' : job?.workType === WorkType.AERIAL ? 'STRAND' : 'FIBER',
        clientId: job?.clientId || ''
    }));
    const [entries, setEntries] = useState<SpanEntry[]>([
        createEmptyEntry(),
        createEmptyEntry(),
        createEmptyEntry(),
        createEmptyEntry(),
        createEmptyEntry()
    ]);
    const [isSaving, setIsSaving] = useState(false);
    const [savedReports, setSavedReports] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');

    // Calculate totals
    const totals = useMemo(() => {
        const totalSpan = entries.reduce((sum, e) => sum + (e.spanFeet || 0), 0);
        const anchorCount = entries.filter(e => e.anchor).length;
        const coilCount = entries.filter(e => e.coil).length;
        const snowshoeCount = entries.filter(e => e.snowshoe).length;
        const filledEntries = entries.filter(e => e.spanFeet && e.spanFeet > 0).length;

        return { totalSpan, anchorCount, coilCount, snowshoeCount, filledEntries };
    }, [entries]);

    const handleHeaderChange = useCallback((field: keyof ProductionHeader, value: string) => {
        setHeader(prev => ({ ...prev, [field]: value }));
    }, []);

    const handleEntryChange = useCallback((id: string, field: keyof SpanEntry, value: any) => {
        setEntries(prev => prev.map(entry =>
            entry.id === id ? { ...entry, [field]: value } : entry
        ));
    }, []);

    const addEntry = useCallback(() => {
        setEntries(prev => [...prev, createEmptyEntry()]);
    }, []);

    const addMultipleEntries = useCallback((count: number) => {
        const newEntries = Array(count).fill(null).map(() => createEmptyEntry());
        setEntries(prev => [...prev, ...newEntries]);
    }, []);

    const removeEntry = useCallback((id: string) => {
        setEntries(prev => prev.length > 1 ? prev.filter(e => e.id !== id) : prev);
    }, []);

    const duplicateEntry = useCallback((id: string) => {
        const entryToDuplicate = entries.find(e => e.id === id);
        if (entryToDuplicate) {
            const newEntry = { ...entryToDuplicate, id: generateId(), notes: '' };
            const index = entries.findIndex(e => e.id === id);
            setEntries(prev => [
                ...prev.slice(0, index + 1),
                newEntry,
                ...prev.slice(index + 1)
            ]);
        }
    }, [entries]);

    const resetForm = useCallback(() => {
        setHeader({ ...INITIAL_HEADER, lineman: user.name });
        setEntries([
            createEmptyEntry(),
            createEmptyEntry(),
            createEmptyEntry(),
            createEmptyEntry(),
            createEmptyEntry()
        ]);
    }, [user.name]);

    const handleSave = useCallback(async () => {
        setIsSaving(true);

        const report = {
            id: generateId(),
            header,
            entries: entries.filter(e => e.spanFeet && e.spanFeet > 0),
            totals,
            createdAt: new Date().toISOString(),
            createdBy: user.name
        };

        const existing = JSON.parse(localStorage.getItem('fs_daily_reports') || '[]');
        localStorage.setItem('fs_daily_reports', JSON.stringify([report, ...existing]));
        setSavedReports(prev => [report, ...prev]);

        await new Promise(r => setTimeout(r, 800));

        setIsSaving(false);
        resetForm();
    }, [header, entries, totals, user.name, resetForm]);

    // Submit to workflow for owner approval
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const clients = clientStorage.getAll();

    const handleSubmitForApproval = useCallback(async () => {
        // For job-linked submissions, we don't need clientId
        if (!job && (!header.clientId || totals.filledEntries === 0)) return;
        if (job && totals.filledEntries === 0) return;

        setIsSubmitting(true);

        try {
            // If linked to a job, save production data to the job
            if (job) {
                const productionData: Job['productionData'] = {
                    submittedAt: new Date().toISOString(),
                    totalFootage: totals.totalSpan,
                    anchorCount: totals.anchorCount,
                    coilCount: totals.coilCount,
                    snowshoeCount: totals.snowshoeCount,
                    entries: entries.filter(e => e.spanFeet && e.spanFeet > 0).map(e => ({
                        spanFeet: e.spanFeet || 0,
                        anchor: e.anchor,
                        fiberNumber: e.fiberNumber,
                        coil: e.coil,
                        snowshoe: e.snowshoe,
                        notes: e.notes || undefined
                    }))
                };

                // Update job with production data
                jobStorage.submitProduction(job.id, productionData);

                // Save to local reports
                const report = {
                    id: generateId(),
                    jobId: job.id,
                    jobCode: job.jobCode,
                    header: { ...header, clientId: job.clientId },
                    entries: entries.filter(e => e.spanFeet && e.spanFeet > 0),
                    totals,
                    createdAt: new Date().toISOString(),
                    createdBy: user.name
                };

                const existing = JSON.parse(localStorage.getItem('fs_daily_reports') || '[]');
                localStorage.setItem('fs_daily_reports', JSON.stringify([report, ...existing]));
                setSavedReports(prev => [report, ...prev]);

                setSubmitSuccess(true);
                setTimeout(() => {
                    setSubmitSuccess(false);
                    if (onBack) onBack();
                }, 2000);

                return;
            }

            // Calculate line items from production data (for non-job submissions)
            const rateCard = { rates: { fiber_per_foot: 0.35, anchor_each: 18.00, coil_each: 25.00, snowshoe_each: 15.00 } };
            const lineItems: LineItem[] = [];

            if (totals.totalSpan > 0) {
                lineItems.push({
                    id: generateId(),
                    description: `${header.strandType} Installation`,
                    description_pt: `Instalação de ${header.strandType === 'STRAND' ? 'Strand' : header.strandType === 'FIBER' ? 'Fibra' : 'Overlash'}`,
                    quantity: totals.totalSpan,
                    unit: 'ft',
                    unitPrice: rateCard.rates.fiber_per_foot,
                    total: totals.totalSpan * rateCard.rates.fiber_per_foot,
                    category: 'footage'
                });
            }

            if (totals.anchorCount > 0) {
                lineItems.push({
                    id: generateId(),
                    description: 'Anchor Installation',
                    description_pt: 'Instalação de Âncora',
                    quantity: totals.anchorCount,
                    unit: 'each',
                    unitPrice: rateCard.rates.anchor_each,
                    total: totals.anchorCount * rateCard.rates.anchor_each,
                    category: 'hardware'
                });
            }

            if (totals.coilCount > 0) {
                lineItems.push({
                    id: generateId(),
                    description: 'Coil Installation',
                    description_pt: 'Instalação de Bobina',
                    quantity: totals.coilCount,
                    unit: 'each',
                    unitPrice: rateCard.rates.coil_each,
                    total: totals.coilCount * rateCard.rates.coil_each,
                    category: 'hardware'
                });
            }

            if (totals.snowshoeCount > 0) {
                lineItems.push({
                    id: generateId(),
                    description: 'Snowshoe Installation',
                    description_pt: 'Instalação de Snowshoe',
                    quantity: totals.snowshoeCount,
                    unit: 'each',
                    unitPrice: rateCard.rates.snowshoe_each,
                    total: totals.snowshoeCount * rateCard.rates.snowshoe_each,
                    category: 'hardware'
                });
            }

            const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);

            // Create project for workflow
            const project = projectStorage.create({
                mapCode: header.bspd || `MAP-${Date.now().toString(36).toUpperCase()}`,
                clientId: header.clientId,
                linemanId: user.id,
                linemanName: user.name,
                workType: header.strandType === 'OVERLASH' ? WorkType.OVERLASH : WorkType.AERIAL,
                location: { address: header.city, city: header.city },
                workDate: header.startDate,
                description: `${header.projectOLT} - ${header.fibraCT}`,
                status: ProjectStatus.READY_TO_INVOICE, // Skip AI since data is already structured
                lineItems,
                subtotal,
                total: subtotal,
                aiAnalysis: {
                    processedAt: new Date().toISOString(),
                    processingTimeMs: 0,
                    footage: {
                        aerial: header.strandType !== 'OVERLASH' ? totals.totalSpan : 0,
                        underground: 0,
                        overlash: header.strandType === 'OVERLASH' ? totals.totalSpan : 0,
                        total: totals.totalSpan
                    },
                    hardware: {
                        anchors: totals.anchorCount,
                        coils: totals.coilCount,
                        snowshoes: totals.snowshoeCount,
                        poles: totals.filledEntries
                    },
                    complianceScore: 100,
                    violations: [],
                    nescCompliant: true,
                    confidence: 100,
                    notes: 'Data entered directly by lineman',
                    flags: [],
                    requiresReview: false
                }
            });

            // Also save to local reports
            const report = {
                id: generateId(),
                projectId: project.id,
                header,
                entries: entries.filter(e => e.spanFeet && e.spanFeet > 0),
                totals,
                createdAt: new Date().toISOString(),
                createdBy: user.name
            };

            const existing = JSON.parse(localStorage.getItem('fs_daily_reports') || '[]');
            localStorage.setItem('fs_daily_reports', JSON.stringify([report, ...existing]));
            setSavedReports(prev => [report, ...prev]);

            setSubmitSuccess(true);
            setTimeout(() => {
                setSubmitSuccess(false);
                resetForm();
            }, 2000);

        } catch (error) {
            console.error('Submit failed:', error);
        } finally {
            setIsSubmitting(false);
        }
    }, [header, entries, totals, user, resetForm, job, onBack]);

    React.useEffect(() => {
        const saved = JSON.parse(localStorage.getItem('fs_daily_reports') || '[]');
        setSavedReports(saved);
    }, []);

    const exportToCSV = useCallback(() => {
        const rows = [
            ['BRIGHTSPEED PRODUCTION SHEET'],
            ['Lineman', header.lineman],
            ['Data Inicio', header.startDate],
            ['Data Termino', header.endDate],
            ['Cidade', header.city],
            ['Projeto OLT', header.projectOLT],
            ['Map Code', header.bspd],
            ['Fibra CT', header.fibraCT],
            ['Prints', header.prints],
            ['Strand Type', header.strandType],
            ['Total Span (ft)', totals.totalSpan.toString()],
            [],
            ['#', 'Span (ft)', 'Anchor', 'Fiber Number', 'Coil', 'Snowshoe', 'Notes'],
            ...entries.filter(e => e.spanFeet).map((e, i) => [
                (i + 1).toString(),
                e.spanFeet?.toString() || '',
                e.anchor ? 'X' : '',
                e.fiberNumber,
                e.coil ? 'X' : '',
                e.snowshoe ? 'X' : '',
                e.notes
            ]),
            [],
            ['TOTAL', totals.totalSpan.toString(), totals.anchorCount.toString(), '', totals.coilCount.toString(), totals.snowshoeCount.toString()]
        ];

        const csv = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `production_${header.lineman}_${header.startDate}.csv`;
        a.click();
    }, [header, entries, totals]);

    return (
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-8 pb-10">
            {/* Back button for job-linked form */}
            {job && onBack && (
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-sm font-bold transition-colors"
                    style={{ color: 'var(--text-tertiary)' }}
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Job
                </button>
            )}

            {/* Job Info Banner */}
            {job && (
                <div
                    className="p-4 rounded-xl flex items-center gap-4"
                    style={{ background: 'var(--neural-dim)', border: '1px solid var(--border-neural)' }}
                >
                    <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'var(--neural-glow)' }}
                    >
                        <Briefcase className="w-6 h-6" style={{ color: 'var(--neural-core)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-black text-lg truncate" style={{ color: 'var(--text-primary)' }}>{job.title}</p>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            {job.jobCode} • {job.clientName} • {job.location?.city}
                        </p>
                    </div>
                    {job.estimatedFootage && (
                        <div className="text-right hidden sm:block">
                            <p className="text-lg font-black" style={{ color: 'var(--neural-core)' }}>{job.estimatedFootage.toLocaleString()} ft</p>
                            <p className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-ghost)' }}>Estimated</p>
                        </div>
                    )}
                </div>
            )}

            {/* Header - Tesla Style */}
            <div className="flex flex-col gap-4 sm:gap-6 pb-4 sm:pb-8" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                    <div className="space-y-2 sm:space-y-4">
                        <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tighter uppercase text-gradient-neural">
                            Production Sheet
                        </h1>
                        <p className="text-xs sm:text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
                            {job ? `Submit production data for ${job.jobCode}` : 'Fill in your daily production data directly in the app'}
                        </p>
                    </div>

                    {/* Tab Switcher - Only show when not job-linked */}
                    {!job && (
                        <div className="flex items-center gap-1 p-1 rounded-xl w-full sm:w-auto" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
                            <button
                                onClick={() => setActiveTab('form')}
                                className="flex-1 sm:flex-none px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all"
                                style={{
                                    background: activeTab === 'form' ? 'var(--gradient-neural)' : 'transparent',
                                    color: activeTab === 'form' ? 'var(--void)' : 'var(--text-secondary)'
                                }}
                            >
                                New Entry
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className="flex-1 sm:flex-none px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2"
                                style={{
                                    background: activeTab === 'history' ? 'var(--gradient-neural)' : 'transparent',
                                    color: activeTab === 'history' ? 'var(--void)' : 'var(--text-secondary)'
                                }}
                            >
                                History
                                {savedReports.length > 0 && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'var(--neural-glow)' }}>
                                        {savedReports.length}
                                    </span>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {(activeTab === 'form' || job) ? (
                <>
                    {/* Quick Stats - SpaceX Mission Control Style */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
                        {[
                            { icon: Ruler, value: totals.totalSpan.toLocaleString(), label: 'Total Feet', color: 'var(--neural-core)' },
                            { icon: Layers, value: totals.anchorCount, label: 'Anchors', color: 'var(--energy-core)' },
                            { icon: Cable, value: totals.coilCount, label: 'Coils', color: 'var(--online-core)' },
                            { icon: Hash, value: totals.snowshoeCount, label: 'Snowshoes', color: 'var(--alert-core)' },
                            { icon: FileSpreadsheet, value: totals.filledEntries, label: 'Entries', color: 'var(--text-secondary)' }
                        ].map((stat, i) => (
                            <div key={i} className="mission-card nominal p-3 sm:p-5">
                                <div className="flex items-center gap-2 sm:gap-3">
                                    <div className="p-1.5 sm:p-2 rounded-lg" style={{ background: `${stat.color}20` }}>
                                        <stat.icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: stat.color }} />
                                    </div>
                                    <div>
                                        <p className="text-lg sm:text-2xl font-black text-gradient-neural">{stat.value}</p>
                                        <p className="text-[8px] sm:text-[9px] uppercase tracking-widest font-bold" style={{ color: 'var(--text-ghost)' }}>{stat.label}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Header Form - B&O Premium Style */}
                    <div className="surface-premium rounded-xl sm:rounded-2xl p-4 sm:p-8 relative" style={{ background: 'var(--surface)' }}>
                        <h3 className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] mb-4 sm:mb-6 flex items-center gap-2" style={{ color: 'var(--text-ghost)' }}>
                            <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Project Information
                        </h3>

                        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                            {[
                                { label: 'Lineman', icon: UserIcon, value: header.lineman, field: 'lineman', placeholder: 'Enter name...' },
                                { label: 'Start Date', icon: Calendar, value: header.startDate, field: 'startDate', type: 'date' },
                                { label: 'End Date', icon: Clock, value: header.endDate, field: 'endDate', type: 'date' },
                                { label: 'City', icon: MapPin, value: header.city, field: 'city', placeholder: 'City name...' },
                                { label: 'Project OLT', value: header.projectOLT, field: 'projectOLT', placeholder: 'OLT identifier...' },
                                { label: 'Map Code', value: header.bspd, field: 'bspd', placeholder: 'MAP-001...' },
                                { label: 'Fibra CT', value: header.fibraCT, field: 'fibraCT', placeholder: 'Fiber CT...' },
                            ].map((input, i) => (
                                <div key={i} className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-ghost)' }}>
                                        {input.icon && <input.icon className="w-3 h-3" />} {input.label}
                                    </label>
                                    <input
                                        type={input.type || 'text'}
                                        value={input.value}
                                        onChange={(e) => handleHeaderChange(input.field as keyof ProductionHeader, e.target.value)}
                                        className="input-neural w-full"
                                        placeholder={input.placeholder}
                                    />
                                </div>
                            ))}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-ghost)' }}>Client *</label>
                                <select
                                    value={header.clientId}
                                    onChange={(e) => handleHeaderChange('clientId', e.target.value)}
                                    className="input-neural w-full cursor-pointer"
                                >
                                    <option value="">Select client...</option>
                                    {clients.map(client => (
                                        <option key={client.id} value={client.id}>{client.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-ghost)' }}>Strand Type</label>
                                <select
                                    value={header.strandType}
                                    onChange={(e) => handleHeaderChange('strandType', e.target.value)}
                                    className="input-neural w-full cursor-pointer"
                                >
                                    <option value="STRAND">Strand</option>
                                    <option value="FIBER">Fiber</option>
                                    <option value="OVERLASH">Overlash</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Entries Table - Tesla Data Grid Style */}
                    <div className="rounded-xl sm:rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
                        <div className="p-3 sm:p-5 flex items-center justify-between gap-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <h3 className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] flex items-center gap-2" style={{ color: 'var(--text-ghost)' }}>
                                <Cable className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Span Entries
                            </h3>
                            <div className="flex items-center gap-1 sm:gap-2">
                                {[5, 10].map(n => (
                                    <button
                                        key={n}
                                        onClick={() => addMultipleEntries(n)}
                                        className="tesla-button px-2 sm:px-3 py-1 sm:py-1.5 text-[9px] sm:text-[10px] flex items-center gap-1 sm:gap-1.5"
                                    >
                                        <PlusCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> +{n}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr style={{ background: 'var(--deep)' }}>
                                        {['#', 'Span (ft)', 'Anchor', 'Fiber Number', 'Coil', 'Snowshoe', 'Notes', 'Actions'].map((h, i) => (
                                            <th key={i} className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider ${i === 2 || i === 4 || i === 5 || i === 7 ? 'text-center' : 'text-left'}`} style={{ color: 'var(--text-ghost)' }}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map((entry, index) => (
                                        <tr
                                            key={entry.id}
                                            className="group transition-colors"
                                            style={{ borderBottom: '1px solid var(--border-subtle)' }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--elevated)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <td className="px-4 py-2 font-mono text-sm" style={{ color: 'var(--text-ghost)' }}>
                                                {index + 1}
                                            </td>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="number"
                                                    value={entry.spanFeet || ''}
                                                    onChange={(e) => handleEntryChange(entry.id, 'spanFeet', e.target.value ? parseInt(e.target.value) : null)}
                                                    className="w-full bg-transparent rounded-lg px-3 py-2 text-sm font-bold outline-none transition-all"
                                                    style={{ color: 'var(--text-primary)', border: '1px solid transparent' }}
                                                    onFocus={(e) => e.target.style.borderColor = 'var(--neural-core)'}
                                                    onBlur={(e) => e.target.style.borderColor = 'transparent'}
                                                    placeholder="0"
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                <button
                                                    onClick={() => handleEntryChange(entry.id, 'anchor', !entry.anchor)}
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                                                    style={{
                                                        background: entry.anchor ? 'var(--neural-core)' : 'transparent',
                                                        border: `2px solid ${entry.anchor ? 'var(--neural-core)' : 'var(--border-default)'}`
                                                    }}
                                                >
                                                    {entry.anchor && <CheckCircle className="w-4 h-4" style={{ color: 'var(--void)' }} />}
                                                </button>
                                            </td>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="text"
                                                    value={entry.fiberNumber}
                                                    onChange={(e) => handleEntryChange(entry.id, 'fiberNumber', e.target.value)}
                                                    className="w-full bg-transparent rounded-lg px-3 py-2 text-sm font-mono outline-none"
                                                    style={{ color: 'var(--text-secondary)' }}
                                                    placeholder="e.g. F-001"
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                <button
                                                    onClick={() => handleEntryChange(entry.id, 'coil', !entry.coil)}
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                                                    style={{
                                                        background: entry.coil ? 'var(--online-core)' : 'transparent',
                                                        border: `2px solid ${entry.coil ? 'var(--online-core)' : 'var(--border-default)'}`
                                                    }}
                                                >
                                                    {entry.coil && <CheckCircle className="w-4 h-4" style={{ color: 'var(--void)' }} />}
                                                </button>
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                <button
                                                    onClick={() => handleEntryChange(entry.id, 'snowshoe', !entry.snowshoe)}
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                                                    style={{
                                                        background: entry.snowshoe ? 'var(--alert-core)' : 'transparent',
                                                        border: `2px solid ${entry.snowshoe ? 'var(--alert-core)' : 'var(--border-default)'}`
                                                    }}
                                                >
                                                    {entry.snowshoe && <CheckCircle className="w-4 h-4" style={{ color: 'var(--void)' }} />}
                                                </button>
                                            </td>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="text"
                                                    value={entry.notes}
                                                    onChange={(e) => handleEntryChange(entry.id, 'notes', e.target.value)}
                                                    className="w-full bg-transparent rounded-lg px-3 py-2 text-sm outline-none"
                                                    style={{ color: 'var(--text-tertiary)' }}
                                                    placeholder="Notes..."
                                                />
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => duplicateEntry(entry.id)}
                                                        className="p-1.5 rounded-lg transition-all"
                                                        style={{ color: 'var(--text-ghost)' }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--elevated)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-ghost)'; }}
                                                    >
                                                        <Copy className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => removeEntry(entry.id)}
                                                        className="p-1.5 rounded-lg transition-all"
                                                        style={{ color: 'var(--text-ghost)' }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--critical-glow)'; e.currentTarget.style.color = 'var(--critical-core)'; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-ghost)'; }}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr style={{ background: 'var(--deep)' }}>
                                        <td className="px-4 py-4">
                                            <span className="text-[10px] uppercase font-bold" style={{ color: 'var(--text-ghost)' }}>Total</span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="text-xl font-black text-gradient-neural">{totals.totalSpan.toLocaleString()} ft</span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="font-bold" style={{ color: 'var(--neural-core)' }}>{totals.anchorCount}</span>
                                        </td>
                                        <td className="px-4 py-4"></td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="font-bold" style={{ color: 'var(--online-core)' }}>{totals.coilCount}</span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="font-bold" style={{ color: 'var(--alert-core)' }}>{totals.snowshoeCount}</span>
                                        </td>
                                        <td className="px-4 py-4" colSpan={2}></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Add Row Button */}
                        <button
                            onClick={addEntry}
                            className="w-full py-4 transition-all flex items-center justify-center gap-2 text-sm font-bold"
                            style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-ghost)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--elevated)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-ghost)'; }}
                        >
                            <Plus className="w-4 h-4" /> Add Row
                        </button>
                    </div>

                    {/* Success Message */}
                    {submitSuccess && (
                        <div
                            className="p-4 rounded-xl flex items-center gap-3 animate-in fade-in"
                            style={{ background: 'var(--online-glow)', border: '1px solid var(--border-online)' }}
                        >
                            <CheckCircle className="w-6 h-6" style={{ color: 'var(--online-core)' }} />
                            <div>
                                <p className="font-bold" style={{ color: 'var(--online-core)' }}>Submitted Successfully!</p>
                                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Your production report is ready for invoicing</p>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons - Tesla Style */}
                    <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 sm:gap-4">
                        <button
                            onClick={resetForm}
                            className="tesla-button flex items-center justify-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 sm:flex-1"
                        >
                            <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span className="text-xs sm:text-sm">Reset</span>
                        </button>
                        <button
                            onClick={exportToCSV}
                            className="tesla-button flex items-center justify-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 sm:flex-1"
                        >
                            <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span className="text-xs sm:text-sm">CSV</span>
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving || totals.filledEntries === 0}
                            className="tesla-button flex items-center justify-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 disabled:opacity-50 sm:flex-1"
                        >
                            {isSaving ? (
                                <>
                                    <div className="loading-ring w-4 h-4 sm:w-5 sm:h-5" />
                                    <span className="text-xs sm:text-sm">Saving...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 sm:w-5 sm:h-5" />
                                    <span className="text-xs sm:text-sm">Save</span>
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleSubmitForApproval}
                            disabled={isSubmitting || totals.filledEntries === 0 || (!job && !header.clientId)}
                            className="col-span-2 sm:col-span-1 btn-neural flex items-center justify-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 rounded-xl disabled:opacity-50 sm:flex-[2]"
                            style={{ boxShadow: 'var(--shadow-neural)' }}
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="loading-ring w-4 h-4 sm:w-5 sm:h-5" />
                                    <span className="text-xs sm:text-sm">Submitting...</span>
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                                    <span className="text-xs sm:text-sm">Submit</span>
                                </>
                            )}
                        </button>
                    </div>
                </>
            ) : (
                /* History Tab */
                <div className="space-y-4">
                    {savedReports.length === 0 ? (
                        <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
                            <FileSpreadsheet className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--text-ghost)' }} />
                            <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>No Reports Yet</h3>
                            <p style={{ color: 'var(--text-tertiary)' }}>Your saved production reports will appear here</p>
                        </div>
                    ) : (
                        savedReports.map((report, index) => (
                            <div key={report.id || index} className="mission-card nominal p-6 transition-all hover:scale-[1.01]">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <span className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>{report.header.lineman}</span>
                                            <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: 'var(--neural-dim)', color: 'var(--neural-core)' }}>
                                                {report.totals.totalSpan.toLocaleString()} ft
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                                            <span className="flex items-center gap-1">
                                                <MapPin className="w-3 h-3" /> {report.header.city || 'No city'}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3 h-3" /> {report.header.startDate}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <FileSpreadsheet className="w-3 h-3" /> {report.entries.length} entries
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm">
                                        <div className="flex items-center gap-1" style={{ color: 'var(--neural-core)' }}>
                                            <Layers className="w-4 h-4" /> {report.totals.anchorCount}
                                        </div>
                                        <div className="flex items-center gap-1" style={{ color: 'var(--online-core)' }}>
                                            <Cable className="w-4 h-4" /> {report.totals.coilCount}
                                        </div>
                                        <div className="flex items-center gap-1" style={{ color: 'var(--alert-core)' }}>
                                            <Hash className="w-4 h-4" /> {report.totals.snowshoeCount}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default DailyProductionForm;
