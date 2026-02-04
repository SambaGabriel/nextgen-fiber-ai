/**
 * Fiber Map Analyzer - Premium Apple-inspired design
 * Clean, minimal, and innovative interface
 */

import React, { useState, useCallback } from 'react';
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MapPin,
  Cable,
  Ruler,
  CircleDot,
  Box,
  Download,
  Zap,
  Eye,
  ChevronDown,
  ChevronRight,
  Grid3X3,
  BarChart3,
  FileCode,
  ArrowRight
} from 'lucide-react';
import {
  analyzeMapWithClaude,
  FiberMapAnalysisResult,
  exportToCSV,
  exportToJSON
} from '../services/claudeMapAnalyzer';

// ============================================
// TYPES
// ============================================

type ViewMode = 'upload' | 'results';
type ResultTab = 'overview' | 'spans' | 'cables' | 'equipment' | 'poles' | 'validation';

// ============================================
// MAIN COMPONENT
// ============================================

// Storage keys
const STORAGE_KEY_RESULT = 'fs_map_analyzer_result';
const STORAGE_KEY_FILENAME = 'fs_map_analyzer_filename';

const FiberMapTester: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  // Restore result from localStorage on mount
  const [result, setResult] = useState<FiberMapAnalysisResult | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RESULT);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [savedFileName, setSavedFileName] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY_FILENAME);
  });
  const [error, setError] = useState<string | null>(null);
  // Start in results view if we have saved results
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RESULT);
      return saved ? 'results' : 'upload';
    } catch {
      return 'upload';
    }
  });
  const [activeTab, setActiveTab] = useState<ResultTab>('overview');

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      setError(null);

      if (selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target?.result as string);
        reader.readAsDataURL(selectedFile);
      } else {
        setPreview(null);
      }
    }
  }, []);

  // Clear results and go back to upload
  const handleClearResults = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_RESULT);
    localStorage.removeItem(STORAGE_KEY_FILENAME);
    setResult(null);
    setSavedFileName(null);
    setFile(null);
    setPreview(null);
    setViewMode('upload');
    setError(null);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!file) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        const mimeType = file.type || 'image/png';

        try {
          const analysisResult = await analyzeMapWithClaude(base64, mimeType);
          setResult(analysisResult as any);
          // Save to localStorage for persistence across tab changes
          localStorage.setItem(STORAGE_KEY_RESULT, JSON.stringify(analysisResult));
          localStorage.setItem(STORAGE_KEY_FILENAME, file.name);
          setSavedFileName(file.name);
          setViewMode('results');
        } catch (err: any) {
          setError(err.message || 'Analysis failed');
        } finally {
          setIsAnalyzing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setError(err.message || 'Failed to read file');
      setIsAnalyzing(false);
    }
  }, [file]);

  const handleExportCSV = () => {
    if (!result) return;
    const csv = exportToCSV(result);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.header.projectId}_analysis.csv`;
    a.click();
  };

  const handleExportJSON = () => {
    if (!result) return;
    const json = exportToJSON(result);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.header.projectId}_analysis.json`;
    a.click();
  };

  const handleNewAnalysis = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setViewMode('upload');
    setActiveTab('overview');
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'var(--online-core)';
    if (confidence >= 70) return 'var(--energy-core)';
    return 'var(--critical-core)';
  };

  const getConfidenceBg = (confidence: number) => {
    if (confidence >= 90) return { bg: 'var(--online-glow)', border: 'rgba(16, 185, 129, 0.2)' };
    if (confidence >= 70) return { bg: 'var(--energy-pulse)', border: 'rgba(168, 85, 247, 0.2)' };
    return { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.2)' };
  };

  // ============================================
  // UPLOAD VIEW
  // ============================================

  if (viewMode === 'upload') {
    return (
      <div className="min-h-full flex flex-col" style={{ background: 'var(--void)' }}>
        {/* Hero Header */}
        <div className="text-center pt-8 sm:pt-16 pb-6 sm:pb-12 px-4 sm:px-8">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tighter mb-2 sm:mb-4" style={{ color: 'var(--text-primary)' }}>
            Map <span className="text-gradient-neural">Analyzer</span>
          </h1>

          <p className="text-sm sm:text-lg max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Extract spans, cables, equipment and GPS data from OSP construction maps with precision AI analysis.
          </p>
        </div>

        {/* Upload Card - Centered */}
        <div className="flex-1 flex items-start justify-center px-4 sm:px-8 pb-8 sm:pb-16">
          <div className="w-full max-w-2xl">
            {/* Main Upload Area */}
            <div
              className="rounded-2xl sm:rounded-3xl overflow-hidden"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}
            >
              <label className="block cursor-pointer">
                <div
                  className={`
                    p-6 sm:p-12 text-center transition-all duration-500
                    ${file ? '' : 'hover:bg-white/[0.02]'}
                  `}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)'
                  }}
                >
                  {file ? (
                    <div className="space-y-3 sm:space-y-4">
                      <div
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl mx-auto flex items-center justify-center"
                        style={{ background: 'var(--online-glow)', border: '1px solid rgba(16, 185, 129, 0.2)' }}
                      >
                        <FileText className="w-8 h-8 sm:w-10 sm:h-10" style={{ color: 'var(--online-core)' }} />
                      </div>
                      <div>
                        <p className="text-base sm:text-lg font-bold truncate px-2" style={{ color: 'var(--text-primary)' }}>{file.name}</p>
                        <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--text-ghost)' }}>
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      {preview && (
                        <div className="mt-3 sm:mt-4 rounded-xl overflow-hidden" style={{ background: 'var(--deep)' }}>
                          <img
                            src={preview}
                            alt="Preview"
                            className="w-full h-32 sm:h-48 object-contain"
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3 sm:space-y-4">
                      <div
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl mx-auto flex items-center justify-center transition-transform hover:scale-105"
                        style={{ background: 'var(--deep)', border: '1px solid var(--border-default)' }}
                      >
                        <Upload className="w-8 h-8 sm:w-10 sm:h-10" style={{ color: 'var(--text-ghost)' }} />
                      </div>
                      <div>
                        <p className="text-base sm:text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                          Drop your map here
                        </p>
                        <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--text-ghost)' }}>
                          or click to browse files
                        </p>
                      </div>
                      <div className="flex items-center justify-center gap-2 sm:gap-4 pt-2 sm:pt-4">
                        {['PDF', 'PNG', 'JPG'].map((format) => (
                          <span
                            key={format}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest"
                            style={{ background: 'var(--elevated)', color: 'var(--text-ghost)' }}
                          >
                            {format}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {/* Action Area */}
              <div className="p-4 sm:p-6">
                <button
                  onClick={handleAnalyze}
                  disabled={!file || isAnalyzing}
                  className="w-full py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm uppercase tracking-widest flex items-center justify-center gap-2 sm:gap-3 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: file && !isAnalyzing ? 'var(--gradient-neural)' : 'var(--elevated)',
                    color: file && !isAnalyzing ? 'var(--void)' : 'var(--text-ghost)',
                    boxShadow: file && !isAnalyzing ? 'var(--shadow-neural)' : 'none'
                  }}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing Map...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      Analyze Map
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div
                className="mt-6 p-5 rounded-2xl flex items-start gap-4"
                style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
              >
                <XCircle className="w-6 h-6 flex-shrink-0" style={{ color: 'var(--critical-core)' }} />
                <div>
                  <p className="font-bold" style={{ color: 'var(--critical-core)' }}>Analysis Failed</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{error}</p>
                </div>
              </div>
            )}

            {/* Features */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-6 sm:mt-8">
              {[
                { icon: Grid3X3, label: 'Span Detection', desc: 'Auto-extract cable spans' },
                { icon: MapPin, label: 'GPS Extraction', desc: 'Precise coordinates' },
                { icon: BarChart3, label: 'Smart Validation', desc: 'Quality assurance' }
              ].map((feature, i) => (
                <div
                  key={i}
                  className="p-3 sm:p-5 rounded-xl sm:rounded-2xl text-center"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}
                >
                  <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-2 sm:mb-3" style={{ color: 'var(--neural-core)' }} />
                  <p className="text-[10px] sm:text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{feature.label}</p>
                  <p className="text-[8px] sm:text-[10px] mt-0.5 sm:mt-1 hidden sm:block" style={{ color: 'var(--text-ghost)' }}>{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // RESULTS VIEW
  // ============================================

  if (!result) return null;

  const tabs: { id: ResultTab; label: string; icon: React.FC<any>; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: Eye },
    { id: 'spans', label: 'Spans', icon: Ruler, count: result.spans.length },
    { id: 'cables', label: 'Cables', icon: Cable, count: result.cables.length },
    { id: 'equipment', label: 'Equipment', icon: Box, count: result.equipment.length },
    { id: 'poles', label: 'Poles', icon: CircleDot, count: result.poles.length },
    { id: 'validation', label: 'Validation', icon: result.validation.isValid ? CheckCircle2 : AlertTriangle }
  ];

  return (
    <div className="min-h-full flex flex-col lg:flex-row" style={{ background: 'var(--void)' }}>
      {/* Mobile Top Navigation */}
      <div className="lg:hidden flex-shrink-0 p-3 overflow-x-auto">
        <div
          className="flex gap-2 p-2 rounded-xl min-w-max"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300"
                style={{
                  background: isActive ? 'var(--gradient-neural)' : 'transparent',
                  color: isActive ? 'var(--void)' : 'var(--text-ghost)'
                }}
              >
                <tab.icon className="w-4 h-4" />
                <span className="text-[10px] font-bold whitespace-nowrap">{tab.label}</span>
                {tab.count !== undefined && (
                  <span className="text-[8px] font-black">{tab.count}</span>
                )}
              </button>
            );
          })}
          <button
            onClick={handleNewAnalysis}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300"
            style={{ color: 'var(--text-ghost)' }}
          >
            <Upload className="w-4 h-4" />
            <span className="text-[10px] font-bold">New</span>
          </button>
        </div>
      </div>

      {/* Desktop Side Navigation */}
      <div className="hidden lg:block w-20 flex-shrink-0 p-4">
        <div
          className="sticky top-4 rounded-2xl p-3 space-y-2"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-300 relative group"
                style={{
                  background: isActive ? 'var(--gradient-neural)' : 'transparent',
                  color: isActive ? 'var(--void)' : 'var(--text-ghost)',
                  boxShadow: isActive ? 'var(--shadow-neural)' : 'none'
                }}
                title={tab.label}
              >
                <tab.icon className="w-5 h-5" />
                {tab.count !== undefined && (
                  <span className="text-[8px] font-black">{tab.count}</span>
                )}

                {/* Tooltip */}
                <div
                  className="absolute left-full ml-3 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
                  style={{ background: 'var(--elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
                >
                  {tab.label}
                </div>
              </button>
            );
          })}

          {/* Divider */}
          <div className="h-px my-2" style={{ background: 'var(--border-subtle)' }} />

          {/* New Analysis */}
          <button
            onClick={handleNewAnalysis}
            className="w-full aspect-square rounded-xl flex items-center justify-center transition-all duration-300 group"
            style={{ color: 'var(--text-ghost)' }}
            title="New Analysis"
          >
            <Upload className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 p-4 sm:p-8 overflow-y-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
              <h1 className="text-xl sm:text-3xl font-black tracking-tighter" style={{ color: 'var(--text-primary)' }}>
                {result.header.projectId || 'Analysis Results'}
              </h1>
              <div
                className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[8px] sm:text-[10px] font-black uppercase"
                style={{
                  background: getConfidenceBg(result.validation.overallConfidence).bg,
                  border: `1px solid ${getConfidenceBg(result.validation.overallConfidence).border}`,
                  color: getConfidenceColor(result.validation.overallConfidence)
                }}
              >
                {result.validation.overallConfidence}% Confidence
              </div>
            </div>
            <p className="text-xs sm:text-sm" style={{ color: 'var(--text-ghost)' }}>
              {result.header.location || 'Location not specified'} • {result.header.contractor || 'Unknown contractor'}
              {savedFileName && <span className="hidden sm:inline"> • 📄 {savedFileName}</span>}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              onClick={handleClearResults}
              className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 sm:gap-2 transition-all hover:scale-105"
              style={{ background: '#FF5500', color: 'white' }}
            >
              <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Nova
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 sm:gap-2 transition-all hover:scale-105"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              CSV
            </button>
            <button
              onClick={handleExportJSON}
              className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 sm:gap-2 transition-all hover:scale-105"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
            >
              <FileCode className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              JSON
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <OverviewTab result={result} getConfidenceColor={getConfidenceColor} />
          )}

          {activeTab === 'spans' && (
            <SpansTab result={result} getConfidenceColor={getConfidenceColor} />
          )}

          {activeTab === 'cables' && (
            <CablesTab result={result} getConfidenceColor={getConfidenceColor} />
          )}

          {activeTab === 'equipment' && (
            <EquipmentTab result={result} getConfidenceColor={getConfidenceColor} />
          )}

          {activeTab === 'poles' && (
            <PolesTab result={result} getConfidenceColor={getConfidenceColor} />
          )}

          {activeTab === 'validation' && (
            <ValidationTab result={result} getConfidenceColor={getConfidenceColor} />
          )}
        </div>

      </div>
    </div>
  );
};

// ============================================
// TAB COMPONENTS
// ============================================

const OverviewTab: React.FC<{
  result: FiberMapAnalysisResult;
  getConfidenceColor: (c: number) => string;
}> = ({ result, getConfidenceColor }) => (
  <div className="space-y-6">
    {/* Hero Stats */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        { label: 'Total Spans', value: result.totals.spanCount, sub: `${result.totals.totalCableFt.toLocaleString()} ft`, icon: Ruler, color: 'neural' },
        { label: 'Poles', value: result.totals.poleCount, sub: `${result.totals.anchorCount} anchors`, icon: CircleDot, color: 'energy' },
        { label: 'Cables', value: result.cables.length, sub: 'segments', icon: Cable, color: 'online' },
        { label: 'Equipment', value: result.equipment.length, sub: 'items', icon: Box, color: 'critical' }
      ].map((stat, i) => (
        <div
          key={i}
          className="p-6 rounded-2xl relative overflow-hidden group hover:scale-[1.02] transition-transform"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}
        >
          <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${
            stat.color === 'neural' ? 'from-[var(--neural-core)] to-transparent' :
            stat.color === 'energy' ? 'from-[var(--energy-core)] to-transparent' :
            stat.color === 'online' ? 'from-[var(--online-core)] to-transparent' :
            'from-[var(--critical-core)] to-transparent'
          }`} />
          <stat.icon className="w-5 h-5 mb-3" style={{ color: 'var(--text-ghost)' }} />
          <p className="text-4xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
          <p className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: 'var(--text-ghost)' }}>{stat.label}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-ghost)' }}>{stat.sub}</p>
        </div>
      ))}
    </div>

    {/* Project Info */}
    <div
      className="p-6 rounded-2xl"
      style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}
    >
      <h3 className="text-sm font-black uppercase tracking-widest mb-4" style={{ color: 'var(--text-ghost)' }}>Project Details</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { label: 'Project ID', value: result.header.projectId },
          { label: 'Location', value: result.header.location },
          { label: 'FSA', value: result.header.fsa },
          { label: 'Page', value: `${result.header.pageNumber} of ${result.header.totalPages}` },
          { label: 'Contractor', value: result.header.contractor },
          { label: 'Permits', value: result.header.permits.join(', ') || 'None' }
        ].map((info, i) => (
          <div key={i}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-ghost)' }}>{info.label}</p>
            <p className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{info.value || '-'}</p>
          </div>
        ))}
      </div>
    </div>

    {/* GPS Points */}
    {result.gpsPoints.length > 0 && (
      <div
        className="p-6 rounded-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}
      >
        <h3 className="text-sm font-black uppercase tracking-widest mb-4" style={{ color: 'var(--text-ghost)' }}>GPS Coordinates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {result.gpsPoints.map((gps, i) => (
            <div
              key={i}
              className="p-4 rounded-xl flex items-center gap-4"
              style={{ background: 'var(--deep)', border: '1px solid var(--border-subtle)' }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--online-glow)' }}
              >
                <MapPin className="w-5 h-5" style={{ color: 'var(--online-core)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate" style={{ color: 'var(--text-primary)' }}>{gps.label}</p>
                <p className="text-xs font-mono" style={{ color: 'var(--text-ghost)' }}>
                  {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}
                </p>
              </div>
              <span className="text-xs font-bold" style={{ color: getConfidenceColor(gps.confidence) }}>
                {gps.confidence}%
              </span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

const SpansTab: React.FC<{
  result: FiberMapAnalysisResult;
  getConfidenceColor: (c: number) => string;
}> = ({ result, getConfidenceColor }) => (
  <div
    className="rounded-2xl overflow-hidden"
    style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}
  >
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: 'var(--deep)' }}>
            {['Length', 'Start Pole', 'End Pole', 'Grid', 'Confidence', 'Flags'].map((h) => (
              <th key={h} className="text-left py-4 px-4 text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-ghost)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.spans.slice(0, 100).map((span, i) => (
            <tr
              key={i}
              className="transition-colors"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
            >
              <td className="py-3 px-4 font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{span.lengthFt} ft</td>
              <td className="py-3 px-4 font-mono" style={{ color: 'var(--text-secondary)' }}>{span.startPole || '-'}</td>
              <td className="py-3 px-4 font-mono" style={{ color: 'var(--text-secondary)' }}>{span.endPole || '-'}</td>
              <td className="py-3 px-4" style={{ color: 'var(--text-ghost)' }}>{span.gridRef || '-'}</td>
              <td className="py-3 px-4">
                <span className="text-xs font-bold" style={{ color: getConfidenceColor(span.confidence) }}>
                  {span.confidence}%
                </span>
              </td>
              <td className="py-3 px-4">
                {span.isLongSpan && (
                  <span
                    className="px-2 py-1 rounded-lg text-[10px] font-black uppercase"
                    style={{ background: 'var(--energy-pulse)', color: 'var(--energy-core)' }}
                  >
                    Long
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {result.spans.length > 100 && (
      <p className="text-center py-4 text-xs" style={{ color: 'var(--text-ghost)' }}>
        Showing 100 of {result.spans.length} spans
      </p>
    )}
  </div>
);

const CablesTab: React.FC<{
  result: FiberMapAnalysisResult;
  getConfidenceColor: (c: number) => string;
}> = ({ result, getConfidenceColor }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {result.cables.map((cable, i) => (
      <div
        key={i}
        className="p-5 rounded-2xl hover:scale-[1.02] transition-transform"
        style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-start justify-between mb-3">
          <p className="font-mono text-xs truncate flex-1" style={{ color: 'var(--text-ghost)' }}>{cable.id}</p>
          <span className="text-xs font-bold ml-2" style={{ color: getConfidenceColor(cable.confidence) }}>
            {cable.confidence}%
          </span>
        </div>
        <p className="text-4xl font-black tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>
          {cable.fiberCount}F
        </p>
        <div className="flex gap-2">
          <span
            className="px-2 py-1 rounded-lg text-[10px] font-black uppercase"
            style={{ background: 'var(--energy-pulse)', color: 'var(--energy-core)' }}
          >
            {cable.cableType}
          </span>
          <span
            className="px-2 py-1 rounded-lg text-[10px] font-black uppercase"
            style={{ background: 'var(--online-glow)', color: 'var(--online-core)' }}
          >
            {cable.category}
          </span>
        </div>
      </div>
    ))}
  </div>
);

const EquipmentTab: React.FC<{
  result: FiberMapAnalysisResult;
  getConfidenceColor: (c: number) => string;
}> = ({ result, getConfidenceColor }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {result.equipment.map((eq, i) => (
      <div
        key={i}
        className="p-5 rounded-2xl hover:scale-[1.02] transition-transform"
        style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <span
            className="px-2 py-1 rounded-lg text-[10px] font-black uppercase"
            style={{ background: 'var(--neural-dim)', border: '1px solid var(--border-neural)', color: 'var(--neural-core)' }}
          >
            {eq.type}
          </span>
          <span className="text-xs font-bold" style={{ color: getConfidenceColor(eq.confidence) }}>
            {eq.confidence}%
          </span>
        </div>
        <p className="font-mono text-sm truncate" style={{ color: 'var(--text-primary)' }}>{eq.id}</p>
        {eq.subType && <p className="text-xs mt-1" style={{ color: 'var(--text-ghost)' }}>{eq.subType}</p>}
        {eq.size && <p className="text-xs" style={{ color: 'var(--text-ghost)' }}>Size: {eq.size}</p>}
        {eq.slackLength && <p className="text-xs" style={{ color: 'var(--text-ghost)' }}>Slack: {eq.slackLength}'</p>}
        {eq.dimensions && <p className="text-xs" style={{ color: 'var(--text-ghost)' }}>Dim: {eq.dimensions}</p>}
      </div>
    ))}
  </div>
);

const PolesTab: React.FC<{
  result: FiberMapAnalysisResult;
  getConfidenceColor: (c: number) => string;
}> = ({ result }) => (
  <div
    className="p-6 rounded-2xl"
    style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}
  >
    <div className="flex flex-wrap gap-2">
      {result.poles.slice(0, 200).map((pole, i) => (
        <div
          key={i}
          className="px-3 py-2 rounded-xl text-xs font-mono transition-transform hover:scale-105"
          style={{
            background: pole.hasAnchor ? 'var(--energy-pulse)' : 'var(--deep)',
            border: pole.hasAnchor ? '1px solid rgba(168, 85, 247, 0.2)' : '1px solid var(--border-subtle)',
            color: pole.hasAnchor ? 'var(--energy-core)' : 'var(--text-secondary)'
          }}
          title={`Confidence: ${pole.confidence}%${pole.hasAnchor ? ' | Has Anchor' : ''}`}
        >
          {pole.poleId}
          {pole.hasAnchor && ' ⚓'}
        </div>
      ))}
    </div>
    {result.poles.length > 200 && (
      <p className="text-center mt-4 text-xs" style={{ color: 'var(--text-ghost)' }}>
        Showing 200 of {result.poles.length} poles
      </p>
    )}
  </div>
);

const ValidationTab: React.FC<{
  result: FiberMapAnalysisResult;
  getConfidenceColor: (c: number) => string;
}> = ({ result }) => (
  <div className="space-y-6">
    {/* Checks */}
    <div
      className="p-6 rounded-2xl"
      style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}
    >
      <h3 className="text-sm font-black uppercase tracking-widest mb-4" style={{ color: 'var(--text-ghost)' }}>Validation Checks</h3>
      <div className="space-y-3">
        {result.validation.checks.map((check, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-4 rounded-xl"
            style={{
              background: check.passed ? 'var(--online-glow)' : 'rgba(239, 68, 68, 0.1)',
              border: check.passed ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)'
            }}
          >
            {check.passed ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--online-core)' }} />
            ) : (
              <XCircle className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--critical-core)' }} />
            )}
            <div className="flex-1">
              <p className="font-bold" style={{ color: 'var(--text-primary)' }}>{check.name}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-ghost)' }}>{check.message}</p>
            </div>
            {check.actual !== undefined && (
              <span className="text-xs font-mono" style={{ color: 'var(--text-ghost)' }}>
                {check.actual}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>

    {/* Warnings */}
    {result.validation.warnings.length > 0 && (
      <div
        className="p-6 rounded-2xl"
        style={{ background: 'var(--energy-pulse)', border: '1px solid rgba(168, 85, 247, 0.2)' }}
      >
        <h3 className="text-sm font-black uppercase tracking-widest mb-4" style={{ color: 'var(--energy-core)' }}>Warnings</h3>
        <div className="space-y-2">
          {result.validation.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--energy-core)' }} />
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{w}</span>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Errors */}
    {result.validation.errors.length > 0 && (
      <div
        className="p-6 rounded-2xl"
        style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
      >
        <h3 className="text-sm font-black uppercase tracking-widest mb-4" style={{ color: 'var(--critical-core)' }}>Errors</h3>
        <div className="space-y-2">
          {result.validation.errors.map((e, i) => (
            <div key={i} className="flex items-start gap-2">
              <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--critical-core)' }} />
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{e}</span>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

export default FiberMapTester;
