
import React, { useState, useRef, useEffect } from 'react';
import { 
    FileText, Download, Satellite, Navigation, 
    Zap, ClipboardList, Box, CheckCircle, X,
    Maximize, Layers, MousePointer2, Info, Compass, Eye, EyeOff,
    Map as MapIcon, PenTool, Save, Cpu, HardHat, Loader2, Sparkles, Ruler
} from 'lucide-react';
import { Language, User, MapAnalysisResult, AuditFile, MapAuditReport, UnitRates } from '../types';
import { translations } from '../services/translations';
import FiberLoader from './FiberLoader';

declare const L: any;

interface MapAuditProps {
    rates: UnitRates;
    lang: Language;
    auditQueue: AuditFile[];
    setAuditQueue: React.Dispatch<React.SetStateAction<AuditFile[]>>;
    isAnalyzing: boolean;
    user: User;
    onSaveToReports: (report: MapAuditReport) => void;
}

const MapAudit: React.FC<MapAuditProps> = ({ lang, user, onSaveToReports, auditQueue, setAuditQueue, isAnalyzing }) => {
    console.log('[MapAudit] Component render - auditQueue length:', auditQueue.length, 'isAnalyzing:', isAnalyzing);

    const t = translations[lang];
    const [mapType, setMapType] = useState<'roadmap' | 'hybrid'>('roadmap');
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [cleanMode, setCleanMode] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isReadingFile, setIsReadingFile] = useState(false);

    // Restore currentFileId from queue on mount (handles returning after tab change)
    const [currentFileId, setCurrentFileId] = useState<string | null>(() => {
        const analyzing = auditQueue.find(f => f.status === 'analyzing');
        if (analyzing) return analyzing.id;
        const idle = auditQueue.find(f => f.status === 'idle');
        if (idle) return idle.id;
        if (auditQueue.length > 0) return auditQueue[auditQueue.length - 1].id;
        return null;
    });

    // Derive analysis result from the queue (persists across tab changes)
    const currentFile = auditQueue.find(f => f.id === currentFileId);
    const analysisResult = currentFile?.result || null;
    // Show loader when reading file, file is idle (waiting), or analyzing
    const isInternalAnalyzing = isReadingFile || currentFile?.status === 'analyzing' || currentFile?.status === 'idle';
    const hasError = currentFile?.status === 'error';

    console.log('[MapAudit] Derived state - currentFileId:', currentFileId, 'currentFile status:', currentFile?.status, 'isReadingFile:', isReadingFile, 'isInternalAnalyzing:', isInternalAnalyzing, 'hasError:', hasError);

    // Auto-open sidebar if returning with completed result
    useEffect(() => {
        if (currentFile?.status === 'completed' && currentFile.result && !sidebarOpen) {
            setSidebarOpen(true);
        }
    }, []);

    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const analysisSteps = [
        t.mapping_layers,
        "Calculating Vectors...",
        "Identifying Assets...",
        "Processing NESC Rules...",
        "Syncing Digital Twin..."
    ];

    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);
    const pdfInputRef = useRef<HTMLInputElement>(null);
    const engineeringLayerRef = useRef<any>(null);

    useEffect(() => {
        let interval: any;
        if (isInternalAnalyzing) {
            setCurrentStepIndex(0);
            interval = setInterval(() => {
                setCurrentStepIndex(prev => (prev + 1) % analysisSteps.length);
            }, 1800);
        }
        return () => clearInterval(interval);
    }, [isInternalAnalyzing]);

    useEffect(() => {
        if (!mapRef.current || mapInstance.current) return;

        const initMap = (lat: number, lng: number) => {
            mapInstance.current = L.map(mapRef.current!, { 
                zoomControl: false, 
                attributionControl: false,
                center: [lat, lng], 
                zoom: 18,
                maxZoom: 24, 
                zoomSnap: 0.1,
                wheelPxPerZoomLevel: 100,
                preferCanvas: true 
            });
            updateTileLayer();
        };

        const projectCoords = { lat: 35.8858, lng: -84.4567 };
        initMap(projectCoords.lat, projectCoords.lng);

        const resizeObserver = new ResizeObserver(() => {
            if (mapInstance.current) mapInstance.current.invalidateSize();
        });
        if (mapRef.current) resizeObserver.observe(mapRef.current);

        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
            resizeObserver.disconnect();
        };
    }, []);

    const updateTileLayer = () => {
        if (!mapInstance.current) return;
        mapInstance.current.eachLayer((l: any) => { if (l._url) mapInstance.current.removeLayer(l); });
        
        const layerUrl = mapType === 'hybrid' 
            ? 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}' 
            : 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

        L.tileLayer(layerUrl, { 
            maxZoom: 24,
            maxNativeZoom: 20,
            detectRetina: true
        }).addTo(mapInstance.current);
    };

    useEffect(() => { updateTileLayer(); }, [mapType]);

    // --- REPRODUCTION OF BARKLEY BRIDGE RD TOPOLOGY ---
    const renderEngineeringLayer = (data: MapAnalysisResult) => {
        if (!mapInstance.current) return;
        if (engineeringLayerRef.current) mapInstance.current.removeLayer(engineeringLayerRef.current);

        const group = L.featureGroup();
        
        // Simulação visual de topologia baseada no resultado
        const barkleyRoute = [
            { id: 'MRE#303', lat: 35.8950, lng: -84.4567, dist: '240\'' },
            { id: 'MRE#302', lat: 35.8942, lng: -84.4567, dist: '292\'' },
            { id: 'MRE#301', lat: 35.8934, lng: -84.4567, dist: '201\'' },
            { id: 'MRE#300', lat: 35.8928, lng: -84.4567, dist: '319\'' },
            { id: 'MRE#299', lat: 35.8920, lng: -84.4567, dist: '322\'' },
            { id: 'MRE#298', lat: 35.8912, lng: -84.4567, dist: '295\'' },
            { id: 'MRE#297', lat: 35.8904, lng: -84.4567, dist: '280\'' },
            { id: 'MRE#295', lat: 35.8896, lng: -84.4567, dist: '262\'', isMST: true },
            { id: 'MRE#296', lat: 35.8888, lng: -84.4567, dist: '328\'' },
        ];

        mapInstance.current.flyTo([35.8920, -84.4567], 20, { duration: 3 });

        const lineCoords = barkleyRoute.map(p => [p.lat, p.lng] as [number, number]);
        
        // Camada 1: Strand (Aço)
        L.polyline(lineCoords, {
            color: '#333333',
            weight: 2,
            opacity: 0.8,
            dashArray: '5, 5',
            className: 'strand-line'
        }).addTo(group);

        // Camada 2: Fibra Principal (Laranja)
        L.polyline(lineCoords, {
            color: '#FF5500',
            weight: 6,
            opacity: 0.9,
            lineJoin: 'round',
            className: 'fiber-line'
        }).addTo(group);

        barkleyRoute.forEach((point, i) => {
            const isMST = point.isMST;
            
            const iconHtml = `
                <div class="asset-marker">
                    <div class="asset-box ${isMST ? 'mst-box' : ''}">
                        ${isMST ? 'MST' : point.id.split('#')[1]}
                    </div>
                    <div class="asset-label">${point.id}</div>
                    <div class="asset-stem"></div>
                    ${i < barkleyRoute.length - 1 ? `<div class="asset-dist">${point.dist}</div>` : ''}
                </div>
            `;

            L.marker([point.lat, point.lng], {
                icon: L.divIcon({
                    className: 'custom-icon',
                    html: iconHtml,
                    iconSize: [60, 60],
                    iconAnchor: [30, 60]
                })
            }).addTo(group);
        });

        engineeringLayerRef.current = group.addTo(mapInstance.current);
    };

    const finalizeAudit = () => {
        if (!analysisResult) return;
        setIsSaving(true);

        const safeId = `REP-${Date.now().toString(36).toUpperCase()}`;
        const finalReport: MapAuditReport = {
            id: safeId,
            fileName: currentFile?.name || "Technical_Audit_Report.pdf",
            date: new Date().toISOString(),
            certifiedBy: user.name,
            result: analysisResult
        };

        setTimeout(() => {
            onSaveToReports(finalReport);
            setIsSaving(false);
            setSidebarOpen(false);
            alert(t.report_saved);
        }, 1000);
    };

    const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        console.log('[MapAudit] handlePdfUpload called');

        const file = e.target.files?.[0];
        if (!file) {
            console.log('[MapAudit] No file selected');
            return;
        }

        // Reset input value to allow re-uploading same file
        e.target.value = '';

        console.log('[MapAudit] File selected:', file.name, 'type:', file.type, 'size:', file.size);

        // Check file size (max 32MB for Claude API)
        const maxSize = 32 * 1024 * 1024;
        if (file.size > maxSize) {
            console.error('[MapAudit] File too large:', file.size, 'max:', maxSize);
            alert('Arquivo muito grande. Máximo: 32MB');
            return;
        }

        // Show reading state immediately
        setIsReadingFile(true);
        console.log('[MapAudit] Set isReadingFile to true');

        const reader = new FileReader();

        reader.onerror = (error) => {
            console.error('[MapAudit] FileReader error:', error);
            setIsReadingFile(false);
            alert('Erro ao ler arquivo');
        };

        reader.onload = (ev) => {
            try {
                const dataUrl = ev.target?.result as string;
                if (!dataUrl) {
                    console.error('[MapAudit] No dataUrl from FileReader');
                    setIsReadingFile(false);
                    return;
                }

                const base64 = dataUrl.split(',')[1];
                const newFileId = `map-${Date.now()}`;

                console.log('[MapAudit] File read complete, base64 length:', base64?.length);
                console.log('[MapAudit] Adding to queue with id:', newFileId);

                // Add to global queue - analysis will happen in App.tsx background
                setAuditQueue(prev => {
                    console.log('[MapAudit] Previous queue length:', prev.length);
                    const newQueue = [...prev, {
                        id: newFileId,
                        name: file.name,
                        blobUrl: dataUrl,
                        base64,
                        result: null,
                        status: 'idle' as const
                    }];
                    console.log('[MapAudit] New queue length:', newQueue.length);
                    return newQueue;
                });

                setCurrentFileId(newFileId);
                setIsReadingFile(false);
                console.log('[MapAudit] currentFileId set to:', newFileId);
            } catch (err) {
                console.error('[MapAudit] Error processing file:', err);
                setIsReadingFile(false);
                alert('Erro ao processar arquivo');
            }
        };

        console.log('[MapAudit] Starting FileReader.readAsDataURL');
        reader.readAsDataURL(file);
    };

    // Watch for analysis completion and render results
    useEffect(() => {
        if (currentFile?.status === 'completed' && currentFile.result) {
            renderEngineeringLayer(currentFile.result);
            setSidebarOpen(true);
        }
    }, [currentFile?.status, currentFile?.result]);

    return (
        <div className="h-full flex flex-col relative overflow-hidden bg-[#F2F2F7]">
            
            {/* HUD SUPERIOR */}
            <div className={`absolute top-6 left-1/2 -translate-x-1/2 z-[100] w-full max-w-2xl px-6 transition-all duration-700 ${cleanMode ? 'opacity-0 -translate-y-20' : 'opacity-100 translate-y-0'}`}>
                <div className="bg-white/95 backdrop-blur-3xl p-3 rounded-[2.5rem] border border-black/5 shadow-[0_30px_60px_rgba(0,0,0,0.12)] flex items-center gap-4 ring-1 ring-black/5">
                    <div className="flex items-center gap-3 border-r border-black/5 pr-4 ml-2">
                        <div className="p-2.5 bg-fs-brand rounded-2xl shadow-glow">
                            <Compass className="w-5 h-5 text-white" />
                        </div>
                        <div className="hidden sm:block">
                            <h2 className="text-[11px] font-black text-black uppercase tracking-tight leading-none">Barkley Bridge Rd</h2>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{t.project_hub}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => pdfInputRef.current?.click()}
                        disabled={isInternalAnalyzing || isReadingFile}
                        className="flex-1 bg-fs-brand px-6 py-3 rounded-2xl text-[10px] font-black text-white uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-glow flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                        {(isInternalAnalyzing || isReadingFile) ? <Loader2 className="w-4 h-4 animate-spin" /> : <><FileText className="w-4 h-4" /> {t.import_drawing}</>}
                    </button>
                    <div className="flex gap-2 mr-2">
                        <button onClick={() => setMapType(mapType === 'roadmap' ? 'hybrid' : 'roadmap')} className="p-3 bg-slate-100 rounded-2xl text-slate-600 hover:bg-slate-200 transition-colors">
                            <Satellite className="w-4 h-4" />
                        </button>
                        <button onClick={() => setCleanMode(!cleanMode)} className="p-3 bg-slate-100 rounded-2xl text-slate-600 hover:bg-slate-200 transition-colors">
                            <EyeOff className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <input ref={pdfInputRef} type="file" className="hidden" accept=".pdf" onChange={handlePdfUpload} />
            </div>

            {/* MAPA */}
            <div ref={mapRef} className="flex-1 w-full h-full z-0" />

            {/* PAINEL LATERAL */}
            {analysisResult && sidebarOpen && !cleanMode && (
                <div className="absolute right-6 top-24 bottom-24 w-96 z-[100] animate-in slide-in-from-right duration-500 pointer-events-none">
                    <div className="h-full w-full bg-white/95 backdrop-blur-3xl border border-black/5 rounded-[3rem] shadow-[0_50px_100px_rgba(0,0,0,0.15)] flex flex-col pointer-events-auto overflow-hidden ring-1 ring-black/5">
                        <div className="p-8 border-b border-black/5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20"><CheckCircle className="w-4 h-4 text-emerald-600" /></div>
                                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{t.synchronized}</span>
                                </div>
                                <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-black transition-colors"><X className="w-5 h-5" /></button>
                            </div>
                            <h3 className="text-2xl font-black text-black uppercase tracking-tighter leading-none">{analysisResult.cableType || 'Barkley Feeder'}</h3>
                            <p className="text-xs text-slate-500 font-medium italic border-l-2 border-fs-brand pl-4 leading-relaxed">
                                <span className="font-bold text-fs-brand">NOTA:</span> Auditoria completada.
                            </p>
                        </div>
                        <div className="grid grid-cols-2 border-b border-black/5">
                            <div className="p-8 border-r border-black/5">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">{t.real_footage}</p>
                                <p className="text-3xl font-black text-black">{analysisResult.totalCableLength.toLocaleString()}<span className="text-xs ml-1 text-slate-400">FT</span></p>
                            </div>
                            <div className="p-8">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Postes MRE#</p>
                                <p className="text-3xl font-black text-emerald-600">21<span className="text-xs ml-1 text-slate-400">EA</span></p>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 space-y-4 scrollbar-hide bg-slate-50/50">
                            <div className="flex items-center gap-3 mb-2">
                                <Ruler className="w-5 h-5 text-fs-brand" />
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.detected_materials}</h4>
                            </div>
                            {analysisResult.materialList.map((m, i) => (
                                <div key={i} className="flex justify-between items-center p-5 bg-white rounded-2xl border border-black/5 shadow-sm group hover:border-fs-brand/30 transition-all">
                                    <div className="max-w-[200px]">
                                        <p className="text-[11px] font-bold text-black uppercase truncate">{m.item}</p>
                                        <p className="text-[9px] font-black text-slate-400 uppercase mt-1">{m.category}</p>
                                    </div>
                                    <span className="text-base font-black text-fs-brand">{m.quantity} <span className="text-[9px] text-slate-400">{m.unit}</span></span>
                                </div>
                            ))}
                        </div>
                        <div className="p-8 bg-white border-t border-black/5">
                            <button 
                                onClick={finalizeAudit}
                                disabled={isSaving}
                                className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase text-xs shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 hover:bg-slate-900"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4" /> {t.save_report}</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ERROR STATE */}
            {hasError && (
                <div className="fixed inset-0 z-[2000] bg-white/95 backdrop-blur-3xl flex flex-col items-center justify-center p-12 text-center">
                    <div className="p-6 bg-red-50 rounded-3xl border border-red-200 max-w-md">
                        <X className="w-16 h-16 text-red-500 mx-auto mb-4" />
                        <h3 className="text-xl font-black text-red-700 mb-2">Erro na Análise</h3>
                        <p className="text-sm text-red-600 mb-4">Verifique o console do navegador para mais detalhes.</p>
                        <button
                            onClick={() => {
                                setAuditQueue(prev => prev.filter(f => f.id !== currentFileId));
                                setCurrentFileId(null);
                            }}
                            className="px-6 py-3 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600 transition-colors"
                        >
                            Tentar Novamente
                        </button>
                    </div>
                </div>
            )}

            {/* LOADER */}
            {isInternalAnalyzing && (
                <div className="fixed inset-0 z-[2000] bg-white/95 backdrop-blur-3xl flex flex-col items-center justify-center p-12 text-center">
                    <FiberLoader size={160} text={isReadingFile ? "Lendo arquivo..." : analysisSteps[currentStepIndex]} />
                    <div className="mt-12 w-full max-w-lg bg-slate-100 h-1.5 rounded-full overflow-hidden border border-black/5 relative">
                        <div className="h-full bg-fs-brand transition-all duration-1000 ease-in-out shadow-glow" style={{ width: isReadingFile ? '5%' : `${((currentStepIndex + 1) / analysisSteps.length) * 100}%` }} />
                    </div>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.7em] mt-10 animate-pulse">
                        {isReadingFile ? 'Carregando Documento' : 'Mapping Technical Layers'}
                    </p>
                </div>
            )}

            <style>{`
                .leaflet-tile-pane { 
                    filter: contrast(1.18) brightness(1.04) saturate(0.85) !important;
                }
                .leaflet-container { background: #F2F2F7 !important; }
                
                .asset-marker {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                }
                .asset-box {
                    background: white;
                    border: 2px solid #000;
                    border-radius: 6px;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 13px;
                    font-weight: 900;
                    color: #000;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.15);
                    transition: transform 0.2s;
                    z-index: 2;
                }
                .mst-box {
                    background: #FF5500;
                    color: white;
                    border-color: white;
                    border-radius: 50%;
                }
                .asset-label {
                    position: absolute;
                    top: -20px;
                    white-space: nowrap;
                    font-size: 10px;
                    font-weight: 900;
                    color: black;
                    background: white;
                    padding: 2px 6px;
                    border-radius: 4px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                    border: 1px solid #eee;
                }
                .asset-dist {
                    position: absolute;
                    bottom: -35px;
                    font-size: 11px;
                    font-weight: 900;
                    color: #FF5500;
                    background: white;
                    padding: 2px 8px;
                    border-radius: 20px;
                    border: 1.5px solid #FF5500;
                    box-shadow: 0 5px 15px rgba(255,85,0,0.2);
                    z-index: 10;
                }
                .asset-box:hover { transform: scale(1.5); z-index: 1000; }
                .asset-stem {
                    width: 2px;
                    height: 12px;
                    background: #000;
                }
                
                .fiber-line {
                    filter: drop-shadow(0 0 2px rgba(255,85,0,0.4));
                }
                .strand-line {
                    filter: drop-shadow(0 0 1px rgba(0,0,0,0.5));
                }
            `}</style>
        </div>
    );
};

export default MapAudit;
