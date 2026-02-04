/**
 * AdminPortal - Bang & Olufsen / Tesla inspired admin interface
 * Premium minimalist design for enterprise management
 */

import React, { useState, useRef } from 'react';
import {
    DollarSign, CheckCircle, TrendingUp,
    Save, ScrollText, Building2, MapPin, Phone, Hash, Camera, Link as LinkIcon,
    Map as MapIcon, UploadCloud, FileJson, Trash2
} from 'lucide-react';
import { Invoice, Transaction, UnitRates, User, Language } from '../types';
import { translations } from '../services/translations';

interface AdminPortalProps {
    invoices: Invoice[];
    onPayInvoice: (invoiceId: string, transaction: Transaction) => void;
    rates: UnitRates;
    onUpdateRates: (rates: UnitRates) => void;
    user: User;
    onUpdateUser: (user: User) => void;
    lang?: Language;
}

const AdminPortal: React.FC<AdminPortalProps> = ({ invoices, onPayInvoice, rates, onUpdateRates, user, onUpdateUser, lang = Language.PT }) => {
    const t = translations[lang];
    const [activeTab, setActiveTab] = useState<'invoices' | 'rates' | 'profile' | 'maps'>('invoices');
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [filterText, setFilterText] = useState('');

    const [companyInfo, setCompanyInfo] = useState<User>(user);
    const [tempRates, setTempRates] = useState<any>(rates);
    const [operationalMaps, setOperationalMaps] = useState<{name: string, size: string, date: string}[]>([
        { name: 'VALOUD0409_PERMIT_PACKET.pdf', size: '4.2 MB', date: new Date().toLocaleDateString() }
    ]);
    const mapInputRef = useRef<HTMLInputElement>(null);
    const [isSaved, setIsSaved] = useState(false);
    const logoInputRef = useRef<HTMLInputElement>(null);

    const handleSaveProfile = () => {
        onUpdateUser(companyInfo);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCompanyInfo({ ...companyInfo, companyLogo: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleMapUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const newMap = {
                name: file.name,
                size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
                date: new Date().toLocaleDateString()
            };
            setOperationalMaps([newMap, ...operationalMaps]);
        }
    };

    const handleDeleteMap = (index: number) => {
        const newMaps = [...operationalMaps];
        newMaps.splice(index, 1);
        setOperationalMaps(newMaps);
    };

    const handleRateChange = (key: keyof UnitRates, value: string) => {
        setTempRates((prev: any) => ({ ...prev, [key]: value }));
        setIsSaved(false);
    };

    const saveRates = () => {
        const finalRates: UnitRates = {
            fiber: parseFloat(tempRates.fiber) || 0,
            anchor: parseFloat(tempRates.anchor) || 0,
            composite: parseFloat(tempRates.composite) || 0,
            strand: parseFloat(tempRates.strand) || 0,
            riser: parseFloat(tempRates.riser) || 0
        };
        onUpdateRates(finalRates);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
    };

    const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 9);

    const tabs = [
        { id: 'invoices' as const, label: t.tab_invoices },
        { id: 'rates' as const, label: t.tab_rates, icon: ScrollText },
        { id: 'profile' as const, label: t.tab_profile, icon: Building2 },
        { id: 'maps' as const, label: t.tab_maps, icon: MapIcon }
    ];

    return (
        <div className="space-y-8 animate-fade-in-up pb-12 relative px-2">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h2 className="text-4xl font-black tracking-tighter mb-2 uppercase text-gradient-neural">{t.enterprise_mgmt}</h2>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--text-ghost)' }}>{t.us_ops}</p>
                </div>

                {/* Tab Switcher - Tesla Style */}
                <div className="flex p-1 rounded-xl overflow-x-auto scrollbar-hide shrink-0" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className="px-6 py-3 rounded-lg text-[10px] font-bold uppercase transition-all whitespace-nowrap flex items-center gap-2"
                            style={{
                                background: activeTab === tab.id ? 'var(--gradient-neural)' : 'transparent',
                                color: activeTab === tab.id ? 'var(--void)' : 'var(--text-tertiary)',
                                boxShadow: activeTab === tab.id ? 'var(--shadow-neural)' : 'none'
                            }}
                        >
                            {tab.icon && <tab.icon className="w-4 h-4" />}
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === 'profile' ? (
                <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
                    <div className="surface-premium p-10 rounded-2xl space-y-10 relative overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
                        {/* Company Header */}
                        <div className="flex flex-col md:flex-row items-center gap-8 pb-10" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <div
                                onClick={() => logoInputRef.current?.click()}
                                className="w-32 h-32 rounded-2xl flex items-center justify-center overflow-hidden cursor-pointer group relative transition-all"
                                style={{ background: 'var(--neural-dim)', border: '1px solid var(--border-neural)' }}
                            >
                                {companyInfo.companyLogo ? (
                                    <img src={companyInfo.companyLogo} className="w-full h-full object-contain p-4 group-hover:opacity-40 transition-opacity" />
                                ) : (
                                    <Building2 className="w-12 h-12 group-hover:scale-110 transition-transform" style={{ color: 'var(--neural-core)' }} />
                                )}
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.6)' }}>
                                    <Camera className="w-8 h-8" style={{ color: 'var(--text-primary)' }} />
                                </div>
                                <input ref={logoInputRef} type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                            </div>
                            <div className="text-center md:text-left">
                                <h3 className="text-3xl font-black uppercase tracking-tighter leading-none mb-2" style={{ color: 'var(--text-primary)' }}>
                                    {companyInfo.companyName || 'Your Company LLC'}
                                </h3>
                                <div className="flex flex-wrap justify-center md:justify-start gap-4">
                                    <p className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text-ghost)' }}>
                                        <Hash className="w-3 h-3" /> {companyInfo.companyTaxId || 'XX-XXXXXXX'}
                                    </p>
                                    <p className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text-ghost)' }}>
                                        <MapPin className="w-3 h-3" /> {companyInfo.companyAddress || 'Ashburn, VA'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Form Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {[
                                { label: t.company_legal, icon: Building2, value: companyInfo.companyName, field: 'companyName', placeholder: 'NextGen Fiber Corp' },
                                { label: t.tax_id, icon: Hash, value: companyInfo.companyTaxId, field: 'companyTaxId', placeholder: 'XX-XXXXXXX' },
                                { label: t.address, icon: MapPin, value: companyInfo.companyAddress, field: 'companyAddress', placeholder: '123 Innovation Dr, Suite 100', span: 2 },
                                { label: t.phone, icon: Phone, value: companyInfo.companyPhone, field: 'companyPhone', placeholder: '+1 (703) 555-0123' },
                                { label: t.website, icon: LinkIcon, value: companyInfo.companyWebsite, field: 'companyWebsite', placeholder: 'www.yourcompany.com' }
                            ].map((input, i) => (
                                <div key={i} className={`space-y-3 ${input.span === 2 ? 'md:col-span-2' : ''}`}>
                                    <label className="text-[10px] font-bold uppercase tracking-widest ml-1 flex items-center gap-2" style={{ color: 'var(--text-ghost)' }}>
                                        <input.icon className="w-3.5 h-3.5" /> {input.label}
                                    </label>
                                    <input
                                        value={(companyInfo as any)[input.field] || ''}
                                        onChange={e => setCompanyInfo({...companyInfo, [input.field]: e.target.value})}
                                        className="input-neural w-full"
                                        placeholder={input.placeholder}
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end pt-4">
                            <button
                                onClick={handleSaveProfile}
                                className="btn-neural px-12 py-5 rounded-xl font-bold uppercase text-xs flex items-center gap-4 transition-all active:scale-95"
                                style={{
                                    background: isSaved ? 'var(--online-core)' : 'var(--gradient-neural)',
                                    boxShadow: isSaved ? '0 0 20px var(--online-glow)' : 'var(--shadow-neural)'
                                }}
                            >
                                {isSaved ? <><CheckCircle className="w-5 h-5" /> {t.profile_saved}</> : <><Save className="w-5 h-5" /> {t.update_profile}</>}
                            </button>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'rates' ? (
                <div className="max-w-4xl mx-auto animate-fade-in-up">
                    <div className="surface-premium p-10 rounded-2xl space-y-10" style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
                        <div className="flex items-center gap-5">
                            <div className="p-4 rounded-xl" style={{ background: 'var(--neural-dim)', border: '1px solid var(--border-neural)' }}>
                                <DollarSign className="w-8 h-8" style={{ color: 'var(--neural-core)' }} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black uppercase tracking-tighter" style={{ color: 'var(--text-primary)' }}>{t.unit_rates}</h3>
                                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-ghost)' }}>{t.base_calc}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            {[
                                { label: 'Fiber / Strand (ft)', key: 'fiber' as const },
                                { label: 'Anchor / Guy (ea)', key: 'anchor' as const }
                            ].map((rate, i) => (
                                <div key={i} className="space-y-4">
                                    <label className="text-[10px] font-bold uppercase tracking-widest flex justify-between" style={{ color: 'var(--text-ghost)' }}>
                                        {rate.label}
                                        <span style={{ color: 'var(--neural-core)' }}>$ {tempRates[rate.key]}</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={tempRates[rate.key]}
                                        onChange={e => handleRateChange(rate.key, e.target.value)}
                                        className="w-full p-5 rounded-xl text-3xl font-black outline-none transition-all"
                                        style={{ background: 'var(--deep)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end">
                            <button
                                onClick={saveRates}
                                className="btn-neural px-12 py-5 rounded-xl font-bold uppercase text-xs transition-all active:scale-95"
                                style={{
                                    background: isSaved ? 'var(--online-core)' : 'var(--gradient-neural)',
                                    boxShadow: isSaved ? '0 0 20px var(--online-glow)' : 'var(--shadow-neural)'
                                }}
                            >
                                {isSaved ? t.rates_saved : t.save_rates}
                            </button>
                        </div>
                    </div>
                </div>
            ) : activeTab === 'maps' ? (
                <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
                    <div className="surface-premium p-10 rounded-2xl space-y-10" style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <div className="flex items-center gap-5">
                                <div className="p-4 rounded-xl" style={{ background: 'var(--neural-dim)', border: '1px solid var(--border-neural)' }}>
                                    <MapIcon className="w-8 h-8" style={{ color: 'var(--neural-core)' }} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black uppercase tracking-tighter" style={{ color: 'var(--text-primary)' }}>{t.active_maps}</h3>
                                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-ghost)' }}>{t.master_blueprints}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => mapInputRef.current?.click()}
                                className="btn-neural px-8 py-4 rounded-xl font-bold uppercase text-xs flex items-center gap-2 active:scale-95"
                                style={{ boxShadow: 'var(--shadow-neural)' }}
                            >
                                <UploadCloud className="w-4 h-4" /> {t.upload_map}
                            </button>
                            <input ref={mapInputRef} type="file" className="hidden" accept=".pdf,.kml,.kmz,.jpg,.png" onChange={handleMapUpload} />
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {operationalMaps.map((map, idx) => (
                                <div
                                    key={idx}
                                    className="mission-card nominal flex items-center justify-between p-6 transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 rounded-xl" style={{ background: 'var(--deep)' }}>
                                            <FileJson className="w-6 h-6" style={{ color: 'var(--online-core)' }} />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold mb-1 transition-colors" style={{ color: 'var(--text-primary)' }}>{map.name}</h4>
                                            <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-ghost)' }}>
                                                <span>{map.size}</span>
                                                <span>•</span>
                                                <span>Added: {map.date}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest" style={{ background: 'var(--online-glow)', color: 'var(--online-core)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                            ACTIVE
                                        </span>
                                        <button
                                            onClick={() => handleDeleteMap(idx)}
                                            className="p-3 rounded-xl transition-all"
                                            style={{ color: 'var(--text-ghost)' }}
                                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--critical-glow)'; e.currentTarget.style.color = 'var(--critical-core)'; }}
                                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-ghost)'; }}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {operationalMaps.length === 0 && (
                                <div className="text-center py-12 rounded-2xl" style={{ border: '2px dashed var(--border-default)' }}>
                                    <MapIcon className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-ghost)' }} />
                                    <p className="font-bold text-sm" style={{ color: 'var(--text-tertiary)' }}>{t.no_maps}</p>
                                </div>
                            )}
                        </div>

                        <div className="p-6 rounded-xl flex items-start gap-4" style={{ background: 'var(--neural-dim)', border: '1px solid var(--border-neural)' }}>
                            <div className="status-processing shrink-0 mt-1"></div>
                            <div>
                                <h4 className="text-xs font-bold uppercase mb-1" style={{ color: 'var(--neural-core)' }}>{t.system_intelligence}</h4>
                                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                    {t.system_intelligence_desc}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-8 animate-fade-in-up">
                    <div className="surface-premium p-8 rounded-2xl flex flex-col items-center text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
                        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ background: 'var(--online-glow)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                            <TrendingUp className="w-10 h-10" style={{ color: 'var(--online-core)' }} />
                        </div>
                        <h3 className="text-xl font-black uppercase tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>{t.invoice_dashboard}</h3>
                        <p className="text-[10px] uppercase tracking-widest mb-6" style={{ color: 'var(--text-ghost)' }}>{t.manage_payments}</p>

                        <div className="w-full">
                            <div className="flex pb-4 mb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <div className="flex-1 text-[10px] font-bold uppercase tracking-widest text-left pl-4" style={{ color: 'var(--text-ghost)' }}>{t.crew_name}</div>
                                <div className="flex-1 text-[10px] font-bold uppercase tracking-widest text-center" style={{ color: 'var(--text-ghost)' }}>{t.amount}</div>
                                <div className="flex-1 text-[10px] font-bold uppercase tracking-widest text-right pr-4" style={{ color: 'var(--text-ghost)' }}>{t.action}</div>
                            </div>

                            {invoices.length === 0 ? (
                                <div className="py-12 text-sm font-medium" style={{ color: 'var(--text-ghost)' }}>No pending invoices.</div>
                            ) : (
                                invoices.map(inv => (
                                    <div
                                        key={inv.id}
                                        className="flex items-center justify-between p-4 rounded-xl transition-colors"
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--elevated)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <div className="flex-1 text-left font-bold text-sm pl-2" style={{ color: 'var(--text-primary)' }}>{inv.crewName}</div>
                                        <div className="flex-1 text-center font-black text-sm" style={{ color: 'var(--online-core)' }}>${inv.totalAmount.toLocaleString()}</div>
                                        <div className="flex-1 text-right pr-2">
                                            {inv.status === 'PENDING_QC' ? (
                                                <button
                                                    onClick={() => onPayInvoice(inv.id, { id: generateId(), date: new Date().toISOString(), amount: inv.totalAmount, fee: 0, netAmount: inv.totalAmount, status: 'COMPLETED', type: 'PAYOUT', description: `Payout to ${inv.crewName}` })}
                                                    className="btn-neural px-4 py-2 rounded-lg text-[9px] font-bold uppercase"
                                                >
                                                    {t.approve}
                                                </button>
                                            ) : (
                                                <span className="text-[9px] font-bold uppercase" style={{ color: 'var(--text-ghost)' }}>{inv.status}</span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPortal;
