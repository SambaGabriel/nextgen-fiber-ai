/**
 * Line Review Panel - Side panel for reviewing production line details
 * Tesla/SpaceX/Nothing/B&O inspired premium design
 */

import React, { useState, useMemo } from 'react';
import {
  X, Camera, MapPin, Calendar, Users, Clock,
  CheckCircle, XCircle, AlertTriangle, FileText,
  DollarSign, ChevronLeft, ChevronRight, ExternalLink,
  Edit3, Save, RotateCcw, Send, Flag, History,
  Maximize2, Download, ZoomIn, ZoomOut
} from 'lucide-react';
import {
  ProductionLine,
  ProductionLineStatus,
  EvidenceAsset,
  ValidationResult,
  ValidationSeverity
} from '../../types/billing';

// ============================================
// SUB-COMPONENTS
// ============================================

interface EvidenceViewerProps {
  assets: EvidenceAsset[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
}

const EvidenceViewer: React.FC<EvidenceViewerProps> = ({
  assets,
  currentIndex,
  onIndexChange
}) => {
  const [zoom, setZoom] = useState(1);
  const currentAsset = assets[currentIndex];

  if (!currentAsset) {
    return (
      <div
        className="h-64 flex items-center justify-center rounded-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
      >
        <div className="text-center">
          <Camera className="w-8 h-8 mx-auto mb-2 opacity-50" style={{ color: 'var(--text-ghost)' }} />
          <p className="text-xs font-medium" style={{ color: 'var(--text-ghost)' }}>No evidence attached</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Main Image */}
      <div className="relative h-64 rounded-2xl overflow-hidden group" style={{ background: 'var(--void)' }}>
        <img
          src={currentAsset.thumbnailUrl || currentAsset.url}
          alt={currentAsset.filename}
          className="w-full h-full object-contain transition-transform"
          style={{ transform: `scale(${zoom})` }}
        />

        {/* Controls Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Top Controls */}
          <div className="absolute top-3 right-3 flex items-center gap-2">
            {[
              { icon: ZoomIn, action: () => setZoom(z => Math.min(z + 0.25, 3)) },
              { icon: ZoomOut, action: () => setZoom(z => Math.max(z - 0.25, 1)) },
              { icon: Maximize2, action: () => {} },
              { icon: Download, action: () => {} }
            ].map((btn, i) => (
              <button
                key={i}
                onClick={btn.action}
                className="p-2 rounded-xl backdrop-blur-md transition-all hover:scale-110"
                style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <btn.icon className="w-4 h-4 text-white" />
              </button>
            ))}
          </div>

          {/* Navigation */}
          {assets.length > 1 && (
            <>
              <button
                onClick={() => onIndexChange(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full backdrop-blur-md disabled:opacity-30 transition-all hover:scale-110"
                style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={() => onIndexChange(Math.min(assets.length - 1, currentIndex + 1))}
                disabled={currentIndex === assets.length - 1}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full backdrop-blur-md disabled:opacity-30 transition-all hover:scale-110"
                style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <ChevronRight className="w-5 h-5 text-white" />
              </button>
            </>
          )}

          {/* Counter */}
          <div
            className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs font-bold backdrop-blur-md"
            style={{ background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {currentIndex + 1} / {assets.length}
          </div>
        </div>

        {/* Verified Badge */}
        {currentAsset.isVerified && (
          <div
            className="absolute top-3 left-3 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"
            style={{ background: 'var(--online-core)', color: 'var(--void)' }}
          >
            <CheckCircle className="w-3 h-3" />
            Verified
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {assets.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {assets.map((asset, i) => (
            <button
              key={asset.id}
              onClick={() => onIndexChange(i)}
              className="flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden transition-all hover:scale-105"
              style={{
                border: i === currentIndex ? '2px solid var(--neural-core)' : '2px solid transparent',
                boxShadow: i === currentIndex ? 'var(--shadow-neural)' : 'none'
              }}
            >
              <img
                src={asset.thumbnailUrl || asset.url}
                alt={asset.filename}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Metadata */}
      <div
        className="p-4 rounded-xl space-y-3 text-xs"
        style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
      >
        <div className="flex items-center justify-between">
          <span style={{ color: 'var(--text-ghost)' }}>File</span>
          <span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{currentAsset.filename}</span>
        </div>
        {currentAsset.metadata.capturedAt && (
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--text-ghost)' }}>Captured</span>
            <span style={{ color: 'var(--text-primary)' }}>
              {new Date(currentAsset.metadata.capturedAt).toLocaleString()}
            </span>
          </div>
        )}
        {currentAsset.metadata.latitude && (
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--text-ghost)' }}>Location</span>
            <a
              href={`https://maps.google.com/?q=${currentAsset.metadata.latitude},${currentAsset.metadata.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-bold transition-colors"
              style={{ color: 'var(--neural-core)' }}
            >
              <MapPin className="w-3 h-3" />
              View on Map
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
        {currentAsset.metadata.deviceModel && (
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--text-ghost)' }}>Device</span>
            <span style={{ color: 'var(--text-primary)' }}>{currentAsset.metadata.deviceModel}</span>
          </div>
        )}
      </div>
    </div>
  );
};

interface ValidationListProps {
  results: ValidationResult[];
}

const ValidationList: React.FC<ValidationListProps> = ({ results }) => {
  const grouped = useMemo(() => {
    return {
      errors: results.filter(r => r.severity === ValidationSeverity.ERROR && !r.passed),
      warnings: results.filter(r => r.severity === ValidationSeverity.WARNING && !r.passed),
      passed: results.filter(r => r.passed),
    };
  }, [results]);

  return (
    <div className="space-y-4">
      {/* Errors */}
      {grouped.errors.length > 0 && (
        <div className="space-y-2">
          <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--critical-core)' }}>
            Blocking Issues ({grouped.errors.length})
          </p>
          {grouped.errors.map(result => (
            <div
              key={result.id}
              className="p-4 rounded-xl"
              style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}
            >
              <div className="flex items-start gap-3">
                <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--critical-core)' }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: '#fca5a5' }}>{result.message}</p>
                  {result.suggestion && (
                    <p className="text-xs mt-1" style={{ color: 'rgba(239, 68, 68, 0.7)' }}>{result.suggestion}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {grouped.warnings.length > 0 && (
        <div className="space-y-2">
          <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--energy-core)' }}>
            Warnings ({grouped.warnings.length})
          </p>
          {grouped.warnings.map(result => (
            <div
              key={result.id}
              className="p-4 rounded-xl"
              style={{ background: 'var(--energy-pulse)', border: '1px solid rgba(168, 85, 247, 0.2)' }}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--energy-core)' }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: '#c4b5fd' }}>{result.message}</p>
                  {result.suggestion && (
                    <p className="text-xs mt-1" style={{ color: 'rgba(168, 85, 247, 0.7)' }}>{result.suggestion}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Passed */}
      {grouped.passed.length > 0 && (
        <div className="space-y-2">
          <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--online-core)' }}>
            Passed ({grouped.passed.length})
          </p>
          <div
            className="p-4 rounded-xl"
            style={{ background: 'var(--online-glow)', border: '1px solid rgba(16, 185, 129, 0.2)' }}
          >
            <div className="flex flex-wrap gap-2">
              {grouped.passed.map(result => (
                <span
                  key={result.id}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"
                  style={{ background: 'rgba(16, 185, 129, 0.2)', color: 'var(--online-core)' }}
                >
                  <CheckCircle className="w-3 h-3" />
                  {result.ruleName}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {results.length === 0 && (
        <div
          className="p-6 rounded-xl text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
        >
          <p className="text-sm" style={{ color: 'var(--text-ghost)' }}>No validations run yet</p>
          <button
            className="mt-2 text-xs font-black uppercase tracking-widest"
            style={{ color: 'var(--neural-core)' }}
          >
            Run Validations
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

interface LineReviewPanelProps {
  line: ProductionLine | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (lineId: string, updates: Partial<ProductionLine>) => Promise<void>;
  onApprove: (lineId: string) => Promise<void>;
  onReject: (lineId: string, reason: string) => Promise<void>;
}

const LineReviewPanel: React.FC<LineReviewPanelProps> = ({
  line,
  isOpen,
  onClose,
  onSave,
  onApprove,
  onReject
}) => {
  const [currentEvidenceIndex, setCurrentEvidenceIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'evidence' | 'mapping' | 'validation' | 'history'>('evidence');
  const [isEditing, setIsEditing] = useState(false);
  const [editedQty, setEditedQty] = useState<number>(0);
  const [editedRate, setEditedRate] = useState<number>(0);
  const [editReason, setEditReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset state when line changes
  React.useEffect(() => {
    if (line) {
      setEditedQty(line.quantity);
      setEditedRate(line.appliedRate || 0);
      setCurrentEvidenceIndex(0);
      setIsEditing(false);
    }
  }, [line?.id]);

  if (!isOpen || !line) return null;

  const handleSave = async () => {
    if (!editReason && (editedQty !== line.quantity || editedRate !== line.appliedRate)) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(line.id, {
        quantity: editedQty,
        appliedRate: editedRate,
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const canApprove = line.complianceScore >= 80 &&
    line.validationResults.every(r => r.severity !== ValidationSeverity.ERROR || r.passed);

  return (
    <div
      className="fixed inset-y-0 right-0 w-[600px] shadow-2xl z-50 flex flex-col"
      style={{ background: 'var(--deep)', borderLeft: '1px solid var(--border-subtle)' }}
    >
      {/* Header */}
      <header
        className="flex-shrink-0 px-6 py-5"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 rounded-xl transition-all hover:scale-105"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
            >
              <X className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
            </button>
            <div>
              <h2 className="text-lg font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>{line.jobId}</h2>
              <p className="text-xs" style={{ color: 'var(--text-ghost)' }}>{line.projectName} • {line.crewName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
                  style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || (!editReason && (editedQty !== line.quantity || editedRate !== line.appliedRate))}
                  className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                  style={{ background: 'var(--gradient-neural)', color: 'var(--void)' }}
                >
                  <Save className="w-3 h-3" />
                  Save Changes
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all hover:scale-105"
                style={{ background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}
              >
                <Edit3 className="w-3 h-3" />
                Edit
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {[
            { id: 'evidence', label: 'Evidence', icon: Camera, badge: line.evidenceCount },
            { id: 'mapping', label: 'Billing', icon: DollarSign },
            { id: 'validation', label: 'Validation', icon: CheckCircle },
            { id: 'history', label: 'History', icon: History },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className="flex-1 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
              style={{
                background: activeTab === tab.id ? 'var(--neural-dim)' : 'transparent',
                border: activeTab === tab.id ? '1px solid var(--border-neural)' : '1px solid transparent',
                color: activeTab === tab.id ? 'var(--neural-core)' : 'var(--text-ghost)'
              }}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.badge && (
                <span
                  className="px-1.5 rounded text-[9px]"
                  style={{ background: 'var(--elevated)' }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Production Data Summary */}
        <div
          className="p-5 rounded-2xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
        >
          <h3 className="text-[9px] font-black uppercase tracking-[0.2em] mb-4" style={{ color: 'var(--text-ghost)' }}>
            Production Data
          </h3>
          <p className="text-sm font-medium mb-4" style={{ color: 'var(--text-primary)' }}>{line.description}</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-ghost)' }}>Quantity</p>
              {isEditing ? (
                <input
                  type="number"
                  value={editedQty}
                  onChange={(e) => setEditedQty(Number(e.target.value))}
                  className="w-full mt-2 px-4 py-2.5 rounded-xl text-sm font-bold focus:outline-none"
                  style={{ background: 'var(--elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                />
              ) : (
                <p className="text-xl font-black mt-1" style={{ color: 'var(--text-primary)' }}>
                  {line.quantity.toLocaleString()} <span className="text-sm font-bold" style={{ color: 'var(--text-ghost)' }}>{line.unit}</span>
                </p>
              )}
            </div>

            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-ghost)' }}>Work Date</p>
              <p className="text-xl font-black mt-1 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Calendar className="w-4 h-4" style={{ color: 'var(--text-ghost)' }} />
                {new Date(line.workDate).toLocaleDateString()}
              </p>
            </div>

            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-ghost)' }}>Work Type</p>
              <p className="text-xl font-black mt-1" style={{ color: 'var(--text-primary)' }}>{line.workType}</p>
            </div>

            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-ghost)' }}>Activity Code</p>
              <p className="text-xl font-black font-mono mt-1" style={{ color: 'var(--text-primary)' }}>{line.activityCode || '-'}</p>
            </div>
          </div>

          {line.location && (
            <div
              className="mt-4 p-4 rounded-xl flex items-center justify-between"
              style={{ background: 'var(--elevated)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" style={{ color: 'var(--text-ghost)' }} />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{line.location.address || 'GPS Location'}</span>
              </div>
              <a
                href={`https://maps.google.com/?q=${line.location.latitude},${line.location.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold flex items-center gap-1"
                style={{ color: 'var(--neural-core)' }}
              >
                View Map
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        {/* Tab Content */}
        {activeTab === 'evidence' && (
          <EvidenceViewer
            assets={line.evidenceAssets}
            currentIndex={currentEvidenceIndex}
            onIndexChange={setCurrentEvidenceIndex}
          />
        )}

        {activeTab === 'mapping' && (
          <div className="space-y-4">
            <div
              className="p-5 rounded-2xl"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
            >
              <h3 className="text-[9px] font-black uppercase tracking-[0.2em] mb-4" style={{ color: 'var(--text-ghost)' }}>
                Billing Line Item
              </h3>

              <div className="space-y-4">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-ghost)' }}>Line Item</p>
                  <p className="text-sm font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
                    {line.billingLineItemDescription || 'Not mapped'}
                  </p>
                  {line.billingLineItemId && (
                    <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-ghost)' }}>
                      Code: {line.billingLineItemId}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-ghost)' }}>Rate</p>
                    {isEditing ? (
                      <div className="relative mt-2">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-ghost)' }}>$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={editedRate}
                          onChange={(e) => setEditedRate(Number(e.target.value))}
                          className="w-full pl-8 pr-4 py-2.5 rounded-xl text-sm font-bold focus:outline-none"
                          style={{ background: 'var(--elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                        />
                      </div>
                    ) : (
                      <p className="text-xl font-black mt-1" style={{ color: 'var(--text-primary)' }}>
                        ${line.appliedRate?.toFixed(2) || '0.00'} <span className="text-sm font-bold" style={{ color: 'var(--text-ghost)' }}>/{line.unit}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-ghost)' }}>Extended Amount</p>
                    <p className="text-xl font-black mt-1" style={{ color: 'var(--online-core)' }}>
                      ${((isEditing ? editedQty : line.quantity) * (isEditing ? editedRate : line.appliedRate || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {line.rateOverride && (
                  <div
                    className="p-4 rounded-xl"
                    style={{ background: 'var(--energy-pulse)', border: '1px solid rgba(168, 85, 247, 0.2)' }}
                  >
                    <p className="text-xs font-bold flex items-center gap-1" style={{ color: 'var(--energy-core)' }}>
                      <AlertTriangle className="w-3 h-3" />
                      Rate Override Applied
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'rgba(168, 85, 247, 0.7)' }}>
                      Original: ${line.rateOverride.originalRate} → ${line.rateOverride.overrideRate}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-ghost)' }}>
                      Reason: {line.rateOverride.reason}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {line.appliedRateCardId && (
              <div
                className="p-5 rounded-2xl"
                style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
              >
                <h3 className="text-[9px] font-black uppercase tracking-[0.2em] mb-3" style={{ color: 'var(--text-ghost)' }}>
                  Rate Card
                </h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{line.appliedRateCardId}</p>
                    <p className="text-xs" style={{ color: 'var(--text-ghost)' }}>Version {line.appliedRateCardVersion}</p>
                  </div>
                  <button
                    className="text-xs font-bold flex items-center gap-1"
                    style={{ color: 'var(--neural-core)' }}
                  >
                    View Card
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Edit Reason */}
            {isEditing && (editedQty !== line.quantity || editedRate !== line.appliedRate) && (
              <div
                className="p-5 rounded-2xl"
                style={{ background: 'var(--energy-pulse)', border: '1px solid rgba(168, 85, 247, 0.2)' }}
              >
                <label className="block text-xs font-bold mb-2" style={{ color: 'var(--energy-core)' }}>
                  Reason for changes (required) *
                </label>
                <textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Explain why you're adjusting the quantity or rate..."
                  className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none resize-none"
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    color: 'var(--text-primary)'
                  }}
                  rows={2}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'validation' && (
          <ValidationList results={line.validationResults} />
        )}

        {activeTab === 'history' && (
          <div
            className="p-6 rounded-2xl text-center"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
          >
            <History className="w-8 h-8 mx-auto mb-2 opacity-50" style={{ color: 'var(--text-ghost)' }} />
            <p className="text-sm" style={{ color: 'var(--text-ghost)' }}>Audit history will appear here</p>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <footer
        className="flex-shrink-0 px-6 py-5"
        style={{ background: 'var(--void)', borderTop: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => onReject(line.id, 'Manual rejection')}
            className="flex-1 px-5 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: 'var(--critical-core)'
            }}
          >
            <XCircle className="w-4 h-4" />
            Reject
          </button>

          <button
            className="flex-1 px-5 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
            style={{
              background: 'var(--energy-pulse)',
              border: '1px solid rgba(168, 85, 247, 0.2)',
              color: 'var(--energy-core)'
            }}
          >
            <Flag className="w-4 h-4" />
            Needs Info
          </button>

          <button
            onClick={() => onApprove(line.id)}
            disabled={!canApprove}
            className="flex-1 px-5 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
            style={{
              background: canApprove ? 'var(--online-core)' : 'var(--surface)',
              color: canApprove ? 'var(--void)' : 'var(--text-ghost)',
              cursor: canApprove ? 'pointer' : 'not-allowed'
            }}
          >
            <CheckCircle className="w-4 h-4" />
            Approve
          </button>
        </div>
      </footer>
    </div>
  );
};

export default LineReviewPanel;
