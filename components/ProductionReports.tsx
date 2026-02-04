/**
 * NextGen Fiber AI Agent - Production Reports Component
 * Upload, view, and validate daily production reports (Produção Diária)
 */

import React, { useState, useRef, useEffect } from 'react';
import {
    FileText, Upload, CheckCircle, XCircle, AlertTriangle,
    Loader2, ChevronDown, ChevronUp, FileCheck, Zap,
    MapPin, Calendar, User as UserIcon, Hash, Ruler,
    RefreshCw, Link2, ExternalLink, Table2
} from 'lucide-react';
import {
    Language, User, ProductionReport, ProductionValidationResult,
    PoleEntry, QCStatus
} from '../types';
import { translations } from '../services/translations';
import { extractProductionReport } from '../services/productionService';
import {
    testConnection, listSheets, syncReport,
    SheetInfo, ConnectionStatus, SyncResult
} from '../services/smartsheetsService';
import FiberLoader from './FiberLoader';

interface ProductionReportsProps {
    user: User;
    lang: Language;
}

const QC_STATUS_CONFIG: Record<QCStatus, { color: string; bgColor: string; icon: React.ReactNode }> = {
    'PASSED': { color: 'text-emerald-400', bgColor: 'bg-emerald-500/10', icon: <CheckCircle className="w-5 h-5" /> },
    'FAILED': { color: 'text-red-400', bgColor: 'bg-red-500/10', icon: <XCircle className="w-5 h-5" /> },
    'NEEDS_REVIEW': { color: 'text-amber-400', bgColor: 'bg-amber-500/10', icon: <AlertTriangle className="w-5 h-5" /> },
    'PENDING': { color: 'text-slate-400', bgColor: 'bg-slate-500/10', icon: <Loader2 className="w-5 h-5" /> }
};

const ProductionReports: React.FC<ProductionReportsProps> = ({ user, lang }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentReport, setCurrentReport] = useState<ProductionReport | null>(null);
    const [validation, setValidation] = useState<ProductionValidationResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [expandedEntries, setExpandedEntries] = useState(false);

    // SmartSheets state
    const [ssConnection, setSsConnection] = useState<ConnectionStatus | null>(null);
    const [ssSheets, setSsSheets] = useState<SheetInfo[]>([]);
    const [selectedSheet, setSelectedSheet] = useState<number | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
    const [ssLoading, setSsLoading] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Check SmartSheets connection on mount
    useEffect(() => {
        checkSmartSheetsConnection();
    }, []);

    const checkSmartSheetsConnection = async () => {
        setSsLoading(true);
        try {
            const status = await testConnection();
            setSsConnection(status);

            if (status.connected) {
                const sheets = await listSheets();
                setSsSheets(sheets);
            }
        } catch (err) {
            setSsConnection({ connected: false, error: 'Service unavailable' });
        } finally {
            setSsLoading(false);
        }
    };

    const handleSyncToSmartSheets = async () => {
        if (!currentReport || !selectedSheet) return;

        setIsSyncing(true);
        setSyncResult(null);

        try {
            const result = await syncReport(selectedSheet, currentReport);
            setSyncResult(result);
        } catch (err) {
            setSyncResult({
                success: false,
                error: err instanceof Error ? err.message : 'Sync failed'
            });
        } finally {
            setIsSyncing(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.pdf')) {
            setError('Only PDF files are accepted');
            return;
        }

        setIsProcessing(true);
        setError(null);
        setCurrentReport(null);
        setValidation(null);

        try {
            // Convert to base64
            const base64 = await fileToBase64(file);

            // Call backend API
            const response = await extractProductionReport(base64, file.name);

            if (response.success && response.report && response.validation) {
                setCurrentReport(response.report);
                setValidation(response.validation);
            } else {
                setError(response.message || 'Extraction failed');
            }
        } catch (err) {
            console.error('Processing error:', err);
            setError(err instanceof Error ? err.message : 'Processing failed');
        } finally {
            setIsProcessing(false);
        }
    };

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                // Remove data URL prefix if present
                const base64 = result.includes('base64,')
                    ? result.split('base64,')[1]
                    : result;
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const renderQCBadge = (status: QCStatus) => {
        const config = QC_STATUS_CONFIG[status];
        return (
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl ${config.bgColor} ${config.color}`}>
                {config.icon}
                <span className="text-sm font-black uppercase tracking-wider">{status.replace('_', ' ')}</span>
            </div>
        );
    };

    const renderEntryRow = (entry: PoleEntry, index: number) => {
        const hasIssue = entry.is_splice_point && !entry.coil;

        return (
            <tr
                key={index}
                className={`border-b border-white/5 ${hasIssue ? 'bg-red-500/5' : 'hover:bg-white/5'}`}
            >
                <td className="px-4 py-3 text-sm font-mono text-slate-300">{index + 1}</td>
                <td className="px-4 py-3 text-sm font-bold text-white">{entry.span_feet}</td>
                <td className="px-4 py-3 text-sm font-mono text-slate-300">{entry.pole_id_raw}</td>
                <td className="px-4 py-3 text-center">
                    {entry.anchor && <div className="w-3 h-3 bg-blue-500 rounded-full mx-auto" />}
                </td>
                <td className="px-4 py-3 text-center">
                    {entry.coil && <div className="w-3 h-3 bg-emerald-500 rounded-full mx-auto" />}
                    {entry.is_splice_point && !entry.coil && (
                        <div className="w-3 h-3 bg-red-500 rounded-full mx-auto animate-pulse" title="Missing coil!" />
                    )}
                </td>
                <td className="px-4 py-3 text-center">
                    {entry.snowshoe && <div className="w-3 h-3 bg-amber-500 rounded-full mx-auto" />}
                </td>
                <td className="px-4 py-3 text-sm font-mono text-slate-400">{entry.cumulative_feet}</td>
                <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate">{entry.notes}</td>
            </tr>
        );
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-8">
                <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fs-brand/10 border border-fs-brand/20 text-fs-brand text-[10px] font-bold uppercase">
                        <Zap className="w-3 h-3" /> Production Module
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase">
                        Produção Diária
                    </h1>
                    <p className="text-slate-500 font-medium text-sm">
                        Upload daily production reports for AI extraction and validation
                    </p>
                </div>

                {/* Upload Button */}
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                    className="flex items-center gap-3 px-6 py-4 bg-fs-brand rounded-2xl text-white font-bold uppercase text-sm shadow-glow hover:scale-105 transition-transform disabled:opacity-50"
                >
                    {isProcessing ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <Upload className="w-5 h-5" />
                    )}
                    Upload PDF
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleFileUpload}
                />
            </div>

            {/* Error */}
            {error && (
                <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3">
                    <XCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Processing Loader */}
            {isProcessing && (
                <div className="flex flex-col items-center justify-center py-20">
                    <FiberLoader size={120} text="Extracting Production Data..." />
                    <p className="text-slate-500 text-sm mt-6 animate-pulse">
                        AI is analyzing the PDF with absolute precision
                    </p>
                </div>
            )}

            {/* Results */}
            {validation && currentReport && !isProcessing && (
                <div className="space-y-8">
                    {/* QC Status Card */}
                    <div className="glass-panel rounded-3xl p-8 border border-white/10">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div className="space-y-2">
                                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">QC Status</p>
                                {renderQCBadge(validation.qc_status)}
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                <div className="text-center">
                                    <p className="text-3xl font-black text-white">{validation.metrics.declared_total_ft.toLocaleString()}</p>
                                    <p className="text-xs text-slate-500 uppercase">Declared (ft)</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-3xl font-black text-emerald-400">{validation.metrics.calculated_total_ft.toLocaleString()}</p>
                                    <p className="text-xs text-slate-500 uppercase">Calculated (ft)</p>
                                </div>
                                <div className="text-center">
                                    <p className={`text-3xl font-black ${validation.metrics.discrepancy_ft > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {validation.metrics.discrepancy_ft > 0 ? '+' : ''}{validation.metrics.discrepancy_ft}
                                    </p>
                                    <p className="text-xs text-slate-500 uppercase">Discrepancy (ft)</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-3xl font-black text-slate-300">{validation.metrics.entry_count}</p>
                                    <p className="text-xs text-slate-500 uppercase">Entries</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Report Details */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Header Info */}
                        <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <FileText className="w-4 h-4" /> Report Info
                            </h3>

                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <UserIcon className="w-4 h-4 text-slate-500" />
                                    <span className="text-white font-bold">{currentReport.header.lineman_name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <MapPin className="w-4 h-4 text-slate-500" />
                                    <span className="text-slate-300">{currentReport.header.project_name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Hash className="w-4 h-4 text-slate-500" />
                                    <span className="text-slate-300 font-mono">{currentReport.header.run_id}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Calendar className="w-4 h-4 text-slate-500" />
                                    <span className="text-slate-300">{currentReport.header.start_date}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Ruler className="w-4 h-4 text-slate-500" />
                                    <span className="text-slate-300">{currentReport.header.fiber_count}F - {currentReport.header.service_type}</span>
                                </div>
                            </div>
                        </div>

                        {/* Metrics */}
                        <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Metrics</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-blue-500/10 rounded-xl p-4 text-center">
                                    <p className="text-2xl font-black text-blue-400">{validation.metrics.anchor_count}</p>
                                    <p className="text-xs text-slate-500 uppercase">Anchors</p>
                                </div>
                                <div className="bg-emerald-500/10 rounded-xl p-4 text-center">
                                    <p className="text-2xl font-black text-emerald-400">{validation.metrics.coil_count}</p>
                                    <p className="text-xs text-slate-500 uppercase">Coils</p>
                                </div>
                                <div className="bg-amber-500/10 rounded-xl p-4 text-center">
                                    <p className="text-2xl font-black text-amber-400">{validation.metrics.snowshoe_count}</p>
                                    <p className="text-xs text-slate-500 uppercase">Snowshoes</p>
                                </div>
                                <div className="bg-purple-500/10 rounded-xl p-4 text-center">
                                    <p className="text-2xl font-black text-purple-400">{validation.metrics.splice_point_count}</p>
                                    <p className="text-xs text-slate-500 uppercase">Splice Points</p>
                                </div>
                            </div>
                        </div>

                        {/* Issues */}
                        <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Issues</h3>

                            {validation.errors.length === 0 && validation.warnings.length === 0 ? (
                                <div className="flex items-center gap-3 text-emerald-400">
                                    <CheckCircle className="w-5 h-5" />
                                    <span className="font-bold">No issues found</span>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[200px] overflow-y-auto">
                                    {validation.errors.map((err, i) => (
                                        <div key={i} className="flex items-start gap-2 text-red-400 text-sm">
                                            <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                            <span>{err.message}</span>
                                        </div>
                                    ))}
                                    {validation.warnings.map((warn, i) => (
                                        <div key={i} className="flex items-start gap-2 text-amber-400 text-sm">
                                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                            <span>{warn.message}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recommendations */}
                    {validation.recommendations.length > 0 && (
                        <div className="glass-panel rounded-3xl p-6 border border-white/10">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">
                                AI Recommendations
                            </h3>
                            <ul className="space-y-2">
                                {validation.recommendations.map((rec, i) => (
                                    <li key={i} className="flex items-start gap-3 text-slate-300">
                                        <FileCheck className="w-4 h-4 text-fs-brand flex-shrink-0 mt-1" />
                                        <span>{rec}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* SmartSheets Sync Panel */}
                    <div className="glass-panel rounded-3xl p-6 border border-white/10">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Table2 className="w-4 h-4" /> SmartSheets Sync
                            </h3>
                            <button
                                onClick={checkSmartSheetsConnection}
                                disabled={ssLoading}
                                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                            >
                                <RefreshCw className={`w-4 h-4 text-slate-500 ${ssLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        {/* Connection Status */}
                        <div className="flex items-center gap-3 mb-6">
                            <div className={`w-3 h-3 rounded-full ${ssConnection?.connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                            <span className="text-sm text-slate-400">
                                {ssLoading ? 'Connecting...' :
                                    ssConnection?.connected ?
                                        `Connected as ${ssConnection.name}` :
                                        'Not connected'
                                }
                            </span>
                        </div>

                        {ssConnection?.connected && (
                            <div className="space-y-4">
                                {/* Sheet Selector */}
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">
                                        Target Sheet
                                    </label>
                                    <select
                                        value={selectedSheet || ''}
                                        onChange={(e) => setSelectedSheet(Number(e.target.value) || null)}
                                        className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-fs-brand focus:outline-none"
                                    >
                                        <option value="">Select a sheet...</option>
                                        {ssSheets.map((sheet) => (
                                            <option key={sheet.id} value={sheet.id}>
                                                {sheet.name} ({sheet.total_row_count} rows)
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Sync Button */}
                                <button
                                    onClick={handleSyncToSmartSheets}
                                    disabled={!selectedSheet || isSyncing}
                                    className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:opacity-50 rounded-xl text-white font-bold uppercase text-sm transition-colors"
                                >
                                    {isSyncing ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Syncing...
                                        </>
                                    ) : (
                                        <>
                                            <Link2 className="w-5 h-5" />
                                            Sync to SmartSheets
                                        </>
                                    )}
                                </button>

                                {/* Sync Result */}
                                {syncResult && (
                                    <div className={`p-4 rounded-xl border ${syncResult.success ?
                                        'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                        'bg-red-500/10 border-red-500/20 text-red-400'
                                        }`}>
                                        <div className="flex items-center gap-2">
                                            {syncResult.success ? (
                                                <CheckCircle className="w-5 h-5" />
                                            ) : (
                                                <XCircle className="w-5 h-5" />
                                            )}
                                            <span className="font-bold">
                                                {syncResult.success ?
                                                    `Row ${syncResult.operation}: #${syncResult.row_id}` :
                                                    syncResult.error
                                                }
                                            </span>
                                        </div>
                                        {syncResult.success && (
                                            <p className="text-xs mt-2 opacity-75">
                                                Run ID: {syncResult.run_id}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {!ssConnection?.connected && !ssLoading && (
                            <div className="text-center py-6">
                                <p className="text-slate-500 text-sm mb-2">
                                    SmartSheets integration not configured
                                </p>
                                <p className="text-xs text-slate-600">
                                    Set SMARTSHEET_API_KEY in backend environment
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Entries Table */}
                    <div className="glass-panel rounded-3xl border border-white/10 overflow-hidden">
                        <button
                            onClick={() => setExpandedEntries(!expandedEntries)}
                            className="w-full flex items-center justify-between p-6 hover:bg-white/5 transition-colors"
                        >
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">
                                Pole Entries ({currentReport.entries.length})
                            </h3>
                            {expandedEntries ? (
                                <ChevronUp className="w-5 h-5 text-slate-500" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-slate-500" />
                            )}
                        </button>

                        {expandedEntries && (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-white/5">
                                        <tr className="text-left text-xs font-bold text-slate-500 uppercase">
                                            <th className="px-4 py-3">#</th>
                                            <th className="px-4 py-3">Span (ft)</th>
                                            <th className="px-4 py-3">Pole ID</th>
                                            <th className="px-4 py-3 text-center">Anchor</th>
                                            <th className="px-4 py-3 text-center">Coil</th>
                                            <th className="px-4 py-3 text-center">Snowshoe</th>
                                            <th className="px-4 py-3">Cumulative</th>
                                            <th className="px-4 py-3">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentReport.entries.map((entry, i) => renderEntryRow(entry, i))}
                                    </tbody>
                                    <tfoot className="bg-white/5">
                                        <tr className="text-white font-bold">
                                            <td className="px-4 py-3" colSpan={1}>Total</td>
                                            <td className="px-4 py-3">{currentReport.calculated_total_feet}</td>
                                            <td className="px-4 py-3" colSpan={6}></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!isProcessing && !currentReport && !error && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 rounded-3xl bg-slate-800/50 flex items-center justify-center mb-6">
                        <FileText className="w-10 h-10 text-slate-600" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">No Report Loaded</h3>
                    <p className="text-slate-500 max-w-md">
                        Upload a "Produção Diária" PDF to extract production data and validate against business rules.
                    </p>
                </div>
            )}
        </div>
    );
};

export default ProductionReports;
