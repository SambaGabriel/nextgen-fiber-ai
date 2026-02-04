
import React, { useState, useRef } from 'react';
import { Camera, UploadCloud, Sparkles, ArrowRight } from 'lucide-react';
import { analyzeConstructionImage } from '../services/claudeService';
import { AuditResult, User, Language } from '../types';
import { translations } from '../services/translations';
import FiberLoader from './FiberLoader';

interface AuditUploadProps {
    onAnalysisComplete?: (result: AuditResult) => void;
    user?: User | null;
    lang: Language;
}

const AuditUpload: React.FC<AuditUploadProps> = ({ onAnalysisComplete, user, lang }) => {
    const t = translations[lang];
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<AuditResult | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const runAnalysis = async () => {
        if (!selectedImage) return;
        setIsAnalyzing(true);
        try {
            const auditResult = await analyzeConstructionImage(selectedImage.split(',')[1], lang);
            setResult(auditResult);
            if (onAnalysisComplete) onAnalysisComplete(auditResult);
        } catch (error) {
            alert("Analysis error.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-10 pb-10">
            <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-white/5 pb-8">
                <div className="space-y-4 max-w-2xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fs-brand/10 border border-fs-brand/20 text-fs-brand text-[10px] font-bold uppercase">
                        <Sparkles className="w-3 h-3" /> Field Solutions.ai 3.0 Pro Vision
                    </div>
                    <h2 className="text-4xl md:text-6xl font-extrabold text-white tracking-tighter uppercase">{t.audit_vision}</h2>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Strict NESC (USA) Standards Enforcement</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div className="space-y-6">
                    <div onClick={() => fileInputRef.current?.click()} className="relative aspect-[4/3] rounded-3xl border-2 border-dashed border-slate-700 hover:border-fs-brand/50 bg-slate-800/20 cursor-pointer overflow-hidden flex flex-col items-center justify-center">
                        {selectedImage ? <img src={selectedImage} className="w-full h-full object-contain" /> : <Camera className="w-12 h-12 text-slate-600" />}
                        <input type="file" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f){ const r = new FileReader(); r.onloadend = () => setSelectedImage(r.result as string); r.readAsDataURL(f); } }} className="hidden" />
                    </div>
                    <button onClick={runAnalysis} disabled={!selectedImage || isAnalyzing} className="w-full py-5 rounded-2xl bg-action-gradient text-white font-bold flex items-center justify-center gap-3 uppercase shadow-glow">
                        {isAnalyzing ? <FiberLoader size={20} showText={false} /> : <><Sparkles className="w-5 h-5" /> Run NESC Audit <ArrowRight className="w-5 h-5" /></>}
                    </button>
                </div>

                <div className="glass-panel rounded-3xl p-8 border border-white/10 min-h-[400px]">
                    {!result ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center opacity-50">
                            <Sparkles className="w-12 h-12 mb-4" />
                            <p className="text-sm font-bold uppercase">{t.ai_analyzing}</p>
                            <p className="text-[10px] mt-2">Checking 40" Neutral Safety Zone & Ground Clearances</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex justify-between items-baseline border-b border-white/5 pb-4">
                                <span className="text-4xl font-black text-white">{result.complianceScore}%</span>
                                <span className="text-xs font-black uppercase text-fs-brand">{result.status}</span>
                            </div>
                            <p className="text-slate-300 text-sm leading-relaxed">{result.aiSummary}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuditUpload;