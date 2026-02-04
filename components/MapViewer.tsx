/**
 * MapViewer - Tesla/SpaceX Mission Control style map interface
 * Premium minimalist design for fiber construction mapping
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Globe, Satellite, Zap, FileText, Split, Download,
    Navigation, Cpu, Wifi, WifiOff, CloudDownload, RefreshCw, UploadCloud
} from 'lucide-react';
import FiberLoader from './FiberLoader';
import { analyzeMapBoQ } from '../services/geminiService';
import { MapAnalysisResult, Language } from '../types';
import { translations } from '../services/translations';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

declare const L: any;
declare const JSZip: any;
declare const toGeoJSON: any;

const MapViewer: React.FC<{ lang: Language }> = ({ lang }) => {
    const t = translations[lang];

    const [kmzFile, setKmzFile] = useState<{name: string, data: any} | null>(null);
    const [pdfFile, setPdfFile] = useState<{name: string, blobUrl: string, base64: string} | null>(null);
    const [viewMode, setViewMode] = useState<'split' | 'map' | 'pdf'>('split');
    const [mapType, setMapType] = useState<'hybrid' | 'roadmap'>('hybrid');

    const [gpsActive, setGpsActive] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<MapAnalysisResult | null>(null);
    const [analysisStatus, setAnalysisStatus] = useState<string>('');

    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [cachingStatus, setCachingStatus] = useState<'idle' | 'caching' | 'done' | 'error'>('idle');

    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);
    const geoLayerRef = useRef<any>(null);
    const tileLayerRef = useRef<any>(null);
    const userMarkerRef = useRef<any>(null);

    const pdfInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        if (!mapContainerRef.current || mapInstance.current) return;
        mapInstance.current = L.map(mapContainerRef.current, {
            center: [-23.5505, -46.6333],
            zoom: 18,
            maxZoom: 23,
            zoomControl: false,
            attributionControl: false
        });
        updateTileLayer();
        mapInstance.current.on('locationfound', (e: any) => {
            const userIcon = L.divIcon({
                className: 'bg-transparent',
                html: `<div class="relative flex h-4 w-4 transform -translate-x-1.5 -translate-y-1.5">
                          <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style="background: var(--neural-core);"></span>
                          <span class="relative inline-flex rounded-full h-4 w-4 border-2 border-white shadow-lg" style="background: var(--neural-core);"></span>
                       </div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            if (userMarkerRef.current) userMarkerRef.current.setLatLng(e.latlng);
            else userMarkerRef.current = L.marker(e.latlng, { icon: userIcon }).addTo(mapInstance.current);
            mapInstance.current.flyTo(e.latlng, 19);
            setGpsActive(true);
        });
        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, []);

    useEffect(() => { updateTileLayer(); }, [mapType]);

    const updateTileLayer = () => {
        if (!mapInstance.current) return;
        if (tileLayerRef.current) mapInstance.current.removeLayer(tileLayerRef.current);
        const url = mapType === 'hybrid' ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

        tileLayerRef.current = L.tileLayer(url, {
            maxZoom: 23,
            subdomains: mapType === 'hybrid' ? [] : ['a', 'b', 'c', 'd'],
            errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
        }).addTo(mapInstance.current);

        tileLayerRef.current.on('tileerror', () => {
            if (!isOffline && navigator.onLine) {
               // Silent fail
            }
        });
    };

    const lng2tile = (lon: number, zoom: number) => { return (Math.floor((lon + 180) / 360 * Math.pow(2, zoom))); }
    const lat2tile = (lat: number, zoom: number) => { return (Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom))); }

    const cacheCurrentView = async () => {
        if (!mapInstance.current) return;

        const zoom = mapInstance.current.getZoom();

        if (zoom < 15) {
            alert(t.cache_limit);
            return;
        }

        setCachingStatus('caching');
        const bounds = mapInstance.current.getBounds();
        const north = bounds.getNorth();
        const south = bounds.getSouth();
        const east = bounds.getEast();
        const west = bounds.getWest();

        const top = lat2tile(north, zoom);
        const left = lng2tile(west, zoom);
        const bottom = lat2tile(south, zoom);
        const right = lng2tile(east, zoom);

        const urlsToFetch: string[] = [];

        for (let x = left; x <= right; x++) {
            for (let y = top; y <= bottom; y++) {
                let url = '';
                if (mapType === 'hybrid') {
                    url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`;
                } else {
                    url = `https://a.basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${x}/${y}.png`;
                }
                urlsToFetch.push(url);
            }
        }

        if (urlsToFetch.length > 200) {
            alert(t.cache_limit);
            setCachingStatus('idle');
            return;
        }

        let completed = 0;
        const promises = urlsToFetch.map(url =>
            fetch(url, { mode: 'no-cors' })
                .then(() => { completed++; })
                .catch(e => console.warn("Failed to cache tile", url))
        );

        await Promise.all(promises);

        setCachingStatus('done');
        setTimeout(() => setCachingStatus('idle'), 3000);
    };

    const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsAnalyzing(true);
        setAnalysisStatus(t.auditing);

        const reader = new FileReader();
        reader.onloadend = () => {
            try {
                const base64 = (reader.result as string).split(',')[1];
                if (!base64) throw new Error("Base64 Error");

                const byteCharacters = atob(base64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], {type: 'application/pdf'});

                setPdfFile({
                    name: file.name,
                    blobUrl: URL.createObjectURL(blob),
                    base64
                });
                setAnalysisResult(null);
            } catch (err) {
                alert("Upload error.");
            } finally {
                setIsAnalyzing(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const runAiAudit = useCallback(async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!pdfFile?.base64 || isAnalyzing) return;

        setIsAnalyzing(true);
        setAnalysisStatus(t.auditing);

        try {
            const result = await analyzeMapBoQ(pdfFile.base64, 'application/pdf', lang);
            setAnalysisResult(result);
            setAnalysisStatus('Complete.');
        } catch (err: any) {
            console.error("Audit Fail:", err);
            alert("Audit Error.");
        } finally {
            setIsAnalyzing(false);
        }
    }, [pdfFile, isAnalyzing, lang]);

    const drawLogo = (doc: jsPDF, x: number, y: number) => {
        doc.setFillColor(0, 212, 255);
        doc.ellipse(x + 5, y + 5, 5, 4, 'F');
        doc.rect(x, y + 5, 10, 1.5, 'F');
        doc.setFillColor(255, 255, 255);
        doc.rect(x + 4, y + 2, 2, 2.5, 'F');
    };

    const generateOfficialReport = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!analysisResult) return;

        try {
            const doc = new jsPDF();
            const width = doc.internal.pageSize.getWidth();
            const height = doc.internal.pageSize.getHeight();

            doc.saveGraphicsState();
            doc.setTextColor(245, 245, 245);
            doc.setFontSize(50);
            doc.setFont('helvetica', 'bold');
            doc.text('OFFICIAL CERTIFIED REPORT', width / 2, height / 2, { align: 'center', angle: 45 });
            doc.restoreGraphicsState();

            doc.setFillColor(3, 7, 18);
            doc.rect(0, 0, width, 40, 'F');

            drawLogo(doc, 15, 12);

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text('NEXTGEN AI AGENT', 28, 22);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text('FIBER INTELLIGENCE - AUDIT & MANAGEMENT', 28, 28);

            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text('TECHNICAL PRODUCTION REPORT', width - 15, 22, { align: 'right' });
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text(`ID: PRJ-${Math.random().toString(36).substr(2, 9).toUpperCase()}`, width - 15, 28, { align: 'right' });

            doc.setTextColor(11, 17, 33);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('PROJECT INFORMATION:', 15, 50);
            doc.setFont('helvetica', 'normal');
            doc.text(`Drawing: ${pdfFile?.name}`, 15, 56);
            doc.text(`Date: ${new Date().toLocaleString()}`, 15, 61);
            doc.text(`Status: Certified by AI Precision Engine`, 15, 66);

            autoTable(doc, {
                startY: 75,
                head: [['Consolidated Metric', 'Quantity', 'Unit']],
                body: [
                    ['Total Aerial Production', (analysisResult.aerialFootage || 0).toLocaleString(), 'FT'],
                    ['Total Underground Production', (analysisResult.undergroundFootage || 0).toLocaleString(), 'FT'],
                    ['CONSOLIDATED CABLE LENGTH', (analysisResult.totalCableLength || 0).toLocaleString(), 'FT'],
                    ['Pole Count (Verified Spans)', (analysisResult.spanCount || 0).toString(), 'EA'],
                    ['Estimated Labor Cost', `$${(analysisResult.financials?.estimatedLaborCost || 0).toFixed(2)}`, 'USD']
                ],
                theme: 'grid',
                headStyles: { fillColor: [0, 212, 255], textColor: [0, 0, 0] },
                columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' }, 2: { halign: 'center' } }
            });

            let currentY = (doc as any).lastAutoTable.finalY + 15;

            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('AERIAL INFRASTRUCTURE BOQ:', 15, currentY);

            const aerialItems = (analysisResult.materialList || []).filter(m => m.category === 'AERIAL');
            autoTable(doc, {
                startY: currentY + 5,
                head: [['Material / Hardware', 'Quantity', 'Unit']],
                body: aerialItems.length > 0 ? aerialItems.map(m => [m.item, m.quantity, m.unit]) : [['No aerial items detected', '0', '-']],
                theme: 'striped',
                headStyles: { fillColor: [51, 65, 85] }
            });

            currentY = (doc as any).lastAutoTable.finalY + 15;

            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('UNDERGROUND INFRASTRUCTURE BOQ:', 15, currentY);

            const ugItems = (analysisResult.materialList || []).filter(m => m.category === 'UNDERGROUND');
            autoTable(doc, {
                startY: currentY + 5,
                head: [['Material / Hardware', 'Quantity', 'Unit']],
                body: ugItems.length > 0 ? ugItems.map(m => [m.item, m.quantity, m.unit]) : [['No underground items detected', '0', '-']],
                theme: 'striped',
                headStyles: { fillColor: [3, 7, 18] }
            });

            const pageCount = doc.internal.pages.length - 1;
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text('NextGen AI Agent - Certified Technical Document', 15, height - 10);
                doc.text(`Page ${i} of ${pageCount}`, width - 15, height - 10, { align: 'right' });
            }

            doc.save(`Technical_Report_${pdfFile?.name.replace('.pdf', '')}.pdf`);
        } catch (error) {
            console.error("PDF Gen Error:", error);
            alert("PDF generation error.");
        }
    };

    return (
        <div className="h-full flex flex-col space-y-6 animate-fade-in-up pb-10" style={{ background: 'var(--abyss)' }}>
            {/* Header Control Panel - SpaceX Mission Control Style */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 p-5 rounded-2xl relative z-[1000]" style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
                <div className="flex p-1 rounded-xl items-center gap-1" style={{ background: 'var(--deep)', border: '1px solid var(--border-subtle)' }}>
                    {[
                        { mode: 'split' as const, icon: Split, label: t.split_view },
                        { mode: 'map' as const, icon: Globe, label: t.map_view },
                        { mode: 'pdf' as const, icon: FileText, label: t.pdf_view }
                    ].map(({ mode, icon: Icon, label }) => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className="px-5 py-2.5 rounded-lg flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-all"
                            style={{
                                background: viewMode === mode ? 'var(--gradient-neural)' : 'transparent',
                                color: viewMode === mode ? 'var(--void)' : 'var(--text-tertiary)'
                            }}
                        >
                            <Icon className="w-4 h-4" /> {label}
                        </button>
                    ))}

                    {/* Offline Status Indicator */}
                    <div
                        className="ml-2 px-3 py-2 rounded-lg flex items-center gap-2 transition-all"
                        style={{
                            background: isOffline ? 'var(--critical-glow)' : 'var(--online-glow)',
                            border: `1px solid ${isOffline ? 'var(--critical-core)' : 'var(--online-core)'}`,
                            color: isOffline ? 'var(--critical-core)' : 'var(--online-core)'
                        }}
                    >
                        {isOffline ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
                        <span className="text-[10px] font-bold uppercase tracking-widest hidden lg:inline">
                            {isOffline ? t.offline_mode : t.online_mode}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={runAiAudit}
                        disabled={!pdfFile || isAnalyzing}
                        className="btn-neural px-10 py-4 rounded-xl font-bold uppercase text-sm disabled:opacity-30 flex items-center gap-3 active:scale-95 transition-transform"
                        style={{ boxShadow: 'var(--shadow-neural)' }}
                    >
                        {isAnalyzing ? (
                            <>
                                <div className="loading-ring w-4 h-4" />
                                {t.auditing}
                            </>
                        ) : (
                            <>
                                <Zap className="w-5 h-5" /> {t.audit_pdf}
                            </>
                        )}
                    </button>
                    {analysisResult && (
                        <button
                            onClick={generateOfficialReport}
                            className="px-6 py-4 rounded-xl font-bold uppercase text-xs transition-all flex items-center gap-2 active:scale-95"
                            style={{ background: 'var(--online-core)', color: 'var(--void)', boxShadow: '0 0 20px var(--online-glow)' }}
                        >
                            <Download className="w-4 h-4" /> {t.download_report}
                        </button>
                    )}
                </div>
            </div>

            {/* Viewer Stage */}
            <div className={`grid gap-6 h-[720px] flex-1 ${viewMode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                {/* Map View */}
                <div className={`relative rounded-2xl overflow-hidden transition-all ${viewMode === 'pdf' ? 'hidden' : ''}`} style={{ background: 'var(--void)', border: `2px solid ${kmzFile ? 'var(--neural-core)' : 'var(--border-subtle)'}` }}>
                    <div ref={mapContainerRef} className="w-full h-full z-0" />

                    {/* Map Controls - Tesla Style */}
                    <div className="absolute top-6 right-6 flex flex-col gap-3 z-[400]">
                        <button
                            onClick={() => setMapType(prev => prev === 'hybrid' ? 'roadmap' : 'hybrid')}
                            className="p-3 rounded-lg transition-all"
                            style={{ background: 'var(--surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                        >
                            <Satellite className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => mapInstance.current?.locate({setView: true, watch: true})}
                            className="p-3 rounded-lg transition-all"
                            style={{
                                background: gpsActive ? 'var(--neural-core)' : 'var(--surface)',
                                border: `1px solid ${gpsActive ? 'var(--neural-core)' : 'var(--border-default)'}`,
                                color: gpsActive ? 'var(--void)' : 'var(--text-primary)'
                            }}
                        >
                            <Navigation className="w-5 h-5" />
                        </button>

                        {/* Offline Download Button */}
                        <button
                            onClick={cacheCurrentView}
                            disabled={cachingStatus === 'caching'}
                            className="p-3 rounded-lg transition-all"
                            style={{
                                background: cachingStatus === 'caching' ? 'var(--alert-glow)' : cachingStatus === 'done' ? 'var(--online-core)' : 'var(--surface)',
                                border: `1px solid ${cachingStatus === 'caching' ? 'var(--alert-core)' : cachingStatus === 'done' ? 'var(--online-core)' : 'var(--border-default)'}`,
                                color: cachingStatus === 'done' ? 'var(--void)' : 'var(--text-primary)'
                            }}
                            title={t.download_area}
                        >
                            <CloudDownload className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Caching Feedback Overlay */}
                    {cachingStatus !== 'idle' && (
                        <div className="absolute bottom-6 left-6 z-[400] backdrop-blur-md px-4 py-2 rounded-xl flex items-center gap-3" style={{ background: 'rgba(0,0,0,0.8)', border: '1px solid var(--border-default)' }}>
                            <RefreshCw className="w-4 h-4 animate-spin" style={{ color: 'var(--neural-core)' }} />
                            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>{t.caching_map}</span>
                        </div>
                    )}
                </div>

                {/* PDF/Split View */}
                <div className={`relative rounded-2xl overflow-hidden flex flex-col items-center justify-center ${viewMode === 'map' ? 'hidden' : ''}`} style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
                    {pdfFile ? (
                        <div className="w-full h-full relative group">
                            <iframe src={pdfFile.blobUrl} className="w-full h-full border-none" />
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => pdfInputRef.current?.click()}
                                    className="tesla-button px-4 py-2 text-xs"
                                >
                                    {t.replace_pdf}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div
                            onClick={() => pdfInputRef.current?.click()}
                            className="text-center cursor-pointer p-10 rounded-2xl transition-colors w-full h-full flex flex-col items-center justify-center"
                            style={{ border: '2px dashed var(--border-default)' }}
                            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--neural-core)'}
                            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-default)'}
                        >
                            <UploadCloud className="w-16 h-16 mb-4" style={{ color: 'var(--text-ghost)' }} />
                            <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{t.upload_drawing}</h3>
                            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>PDF, JPG, PNG</p>
                        </div>
                    )}
                    <input ref={pdfInputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={handlePdfUpload} />
                </div>
            </div>
        </div>
    );
};

export default MapViewer;
