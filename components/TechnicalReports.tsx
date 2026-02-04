
import React, { useState } from 'react';
import { 
    FileText, Download, Printer, ShieldCheck, Building2, 
    User as UserIcon, MapPin, Phone, Hash, Layers, LayoutGrid
} from 'lucide-react';
import { User, AuditResult, MapAuditReport, Language } from '../types';
import { translations } from '../services/translations';

interface TechnicalReportsProps {
    user: User;
    auditData: AuditResult[];
    mapReports: MapAuditReport[];
    lang: Language;
}

const TechnicalReports: React.FC<TechnicalReportsProps> = ({ user, auditData, mapReports, lang }) => {
    const t = translations[lang];
    const [activeSection, setActiveSection] = useState<'visual' | 'map'>('map');
    const handlePrint = () => window.print();

    return (
        <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-col lg:flex-row justify-between items-center gap-6 no-print">
                <div className="text-center lg:text-left">
                    <h2 className="text-2xl lg:text-4xl font-black text-[var(--text-primary)] tracking-tighter uppercase">{t.official_documents}</h2>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 opacity-70">{t.audit_vault}</p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    <div className="flex bg-white/80 backdrop-blur-md p-1 rounded-xl border border-[var(--border-default)] shadow-sharp">
                        <button 
                            onClick={() => setActiveSection('map')}
                            className={`flex-1 px-4 lg:px-6 py-2.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 ${activeSection === 'map' ? 'bg-fs-brand text-white shadow-glow' : 'text-slate-500'}`}
                        >
                            <Layers className="w-4 h-4" /> {t.view_invoices}
                        </button>
                        <button 
                            onClick={() => setActiveSection('visual')}
                            className={`flex-1 px-4 lg:px-6 py-2.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center justify-center gap-2 ${activeSection === 'visual' ? 'bg-fs-brand text-white shadow-glow' : 'text-slate-500'}`}
                        >
                            <LayoutGrid className="w-4 h-4" /> {t.view_visual}
                        </button>
                    </div>
                    <button onClick={handlePrint} className="px-6 py-3 rounded-xl bg-[var(--elevated)] border border-white/10 text-slate-300 text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-3">
                        <Printer className="w-4 h-4" /> {t.export}
                    </button>
                </div>
            </div>

            {activeSection === 'map' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-8 animate-in slide-in-from-right duration-500">
                    {mapReports.length > 0 ? (
                        mapReports.map((report) => (
                            <div key={report.id} className="glass-panel p-6 rounded-2xl border border-white/10 group relative overflow-hidden">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-2 bg-fs-brand/10 rounded-lg border border-fs-brand/20"><FileText className="w-5 h-5 text-fs-brand" /></div>
                                    <span className="text-[9px] font-bold text-slate-500">{new Date(report.date).toLocaleDateString()}</span>
                                </div>
                                <h4 className="text-base font-black text-white uppercase tracking-tighter truncate mb-4">{report.fileName}</h4>
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="flex flex-col"><span className="text-[8px] font-black text-slate-500 uppercase">{t.field_ops}</span><span className="text-sm font-black text-emerald-400">{report.result.totalCableLength.toLocaleString()} ft</span></div>
                                    <div className="flex flex-col"><span className="text-[8px] font-black text-slate-500 uppercase">Cost</span><span className="text-sm font-black text-white">${report.result.financials.estimatedLaborCost.toLocaleString()}</span></div>
                                </div>
                                <div className="pt-4 border-t border-[var(--border-subtle)] flex justify-between items-center">
                                    <div className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3 text-emerald-500" /><span className="text-[8px] font-black text-slate-500 uppercase">AI Certified</span></div>
                                    <button className="text-fs-brand"><Download className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full text-center py-20 lg:py-40 border-2 border-dashed border-white/5 rounded-3xl">
                            <Layers className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">No archived reports</p>
                        </div>
                    )}
                </div>
            )}

            {activeSection === 'visual' && (
                <div className="w-full overflow-x-auto scrollbar-hide no-print">
                    <div className="min-w-[700px] lg:min-w-0 bg-white rounded-2xl overflow-hidden shadow-2xl p-10 lg:p-16 text-slate-900 mx-auto max-w-[850px] border border-slate-100 report-print-container animate-in slide-in-from-left duration-500 origin-top transform sm:scale-100 scale-90">
                        <div className="flex justify-between items-start border-b-4 border-slate-900 pb-8 mb-8">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 bg-[var(--deep)] text-white rounded-xl flex items-center justify-center">
                                    <Building2 className="w-8 h-8" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black uppercase tracking-tighter leading-none">{user.companyName}</h1>
                                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">Audit Report // v3.2</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <ShieldCheck className="w-6 h-6 text-emerald-600 ml-auto mb-2" />
                                <p className="text-[10px] font-black text-slate-900 uppercase">{new Date().toLocaleDateString()}</p>
                            </div>
                        </div>

                        <div className="space-y-8">
                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                <h3 className="text-sm font-black uppercase tracking-tight mb-4 flex items-center gap-2">
                                    <UserIcon className="w-4 h-4" /> Inspector Information
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><span className="text-[8px] font-bold text-slate-500 uppercase">Name</span><p className="font-bold">{user.name}</p></div>
                                    <div><span className="text-[8px] font-bold text-slate-500 uppercase">Company</span><p className="font-bold">{user.companyName}</p></div>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                <h3 className="text-sm font-black uppercase tracking-tight mb-4 flex items-center gap-2">
                                    <Hash className="w-4 h-4" /> Audit Summary
                                </h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="text-center p-4 bg-white rounded-xl">
                                        <p className="text-2xl font-black text-emerald-600">{auditData.length}</p>
                                        <p className="text-[8px] font-bold text-slate-500 uppercase">Total Audits</p>
                                    </div>
                                    <div className="text-center p-4 bg-white rounded-xl">
                                        <p className="text-2xl font-black text-blue-600">{mapReports.length}</p>
                                        <p className="text-[8px] font-bold text-slate-500 uppercase">Map Reports</p>
                                    </div>
                                    <div className="text-center p-4 bg-white rounded-xl">
                                        <p className="text-2xl font-black text-purple-600">100%</p>
                                        <p className="text-[8px] font-bold text-slate-500 uppercase">Compliance</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TechnicalReports;