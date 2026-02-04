/**
 * Billing App - Main entry point for the billing module
 * Tesla/SpaceX/Nothing/B&O inspired premium design
 */

import React, { useState, useCallback } from 'react';
import BillingLayout, { BillingView } from './BillingLayout';
import ProductionInbox from './ProductionInbox';
import LineReviewPanel from './LineReviewPanel';
import BatchBuilder from './BatchBuilder';
import ARTracker from './ARTracker';
import QuickInvoice from './QuickInvoice';
import {
  ProductionLine,
  ProductionLineStatus,
  InvoiceBatch
} from '../../types/billing';
import { Receipt, Calculator, FileText, Settings, Zap } from 'lucide-react';

// ============================================
// MOCK LINE FOR REVIEW PANEL
// ============================================

const MOCK_LINE: ProductionLine = {
  id: 'line_001',
  externalId: 'SS-ROW-456',
  sourceSystem: 'smartsheet',
  jobId: 'JOB-2024-0001',
  description: 'Install 288F Aerial - Main St to Oak Ave (Pole 30054 to 30067)',
  quantity: 1250,
  unit: 'FT',
  projectId: 'PROJ-001',
  projectName: 'Spectrum Loudoun Phase 2',
  primeContractor: 'Spectrum',
  crewId: 'CREW-A',
  crewName: 'Potomac Valley Utility Services',
  workDate: '2024-01-15',
  completedDate: '2024-01-15',
  location: {
    latitude: 39.0458,
    longitude: -77.4875,
    address: 'Main St & Oak Ave, Leesburg VA 20176',
    poleId: 'P-30054'
  },
  workType: 'AERIAL',
  activityCode: 'FIBER-288-AERIAL',
  status: ProductionLineStatus.PENDING_REVIEW,
  statusChangedAt: '2024-01-16T10:30:00Z',
  statusChangedBy: 'system',
  evidenceAssets: [
    {
      id: 'ev_001',
      type: 'PHOTO',
      filename: 'pole_30054_install.jpg',
      mimeType: 'image/jpeg',
      fileSize: 2456789,
      url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200',
      metadata: {
        latitude: 39.0458,
        longitude: -77.4875,
        capturedAt: '2024-01-15T14:30:00Z',
        deviceModel: 'iPhone 14 Pro'
      },
      uploadedBy: 'user_field1',
      uploadedAt: '2024-01-15T16:00:00Z',
      isVerified: true,
      verifiedBy: 'user_reviewer1',
      verifiedAt: '2024-01-16T10:00:00Z'
    },
    {
      id: 'ev_002',
      type: 'PHOTO',
      filename: 'pole_30060_install.jpg',
      mimeType: 'image/jpeg',
      fileSize: 2123456,
      url: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=200',
      metadata: {
        latitude: 39.0462,
        longitude: -77.4880,
        capturedAt: '2024-01-15T15:45:00Z',
        deviceModel: 'iPhone 14 Pro'
      },
      uploadedBy: 'user_field1',
      uploadedAt: '2024-01-15T17:00:00Z',
      isVerified: false
    },
    {
      id: 'ev_003',
      type: 'PHOTO',
      filename: 'pole_30067_install.jpg',
      mimeType: 'image/jpeg',
      fileSize: 1987654,
      url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=200',
      metadata: {
        latitude: 39.0470,
        longitude: -77.4890,
        capturedAt: '2024-01-15T16:30:00Z',
        deviceModel: 'iPhone 14 Pro'
      },
      uploadedBy: 'user_field1',
      uploadedAt: '2024-01-15T18:00:00Z',
      isVerified: false
    }
  ],
  evidenceCount: 3,
  hasRequiredEvidence: true,
  billingLineItemId: 'LI-AERIAL-288',
  billingLineItemDescription: 'Aerial Fiber Installation - 288F',
  appliedRateCardId: 'RC-SPECTRUM-001',
  appliedRateCardVersion: 2,
  appliedRate: 0.42,
  extendedAmount: 525.00,
  validationResults: [
    {
      id: 'val_001',
      ruleId: 'EVIDENCE_REQUIRED',
      ruleName: 'Required Evidence',
      passed: true,
      severity: 'ERROR',
      message: 'All required evidence present (3 photos)',
      checkedAt: '2024-01-16T10:30:00Z'
    },
    {
      id: 'val_002',
      ruleId: 'QTY_RANGE',
      ruleName: 'Quantity Range',
      passed: true,
      severity: 'WARNING',
      message: 'Quantity 1250 FT within expected range (100-5000)',
      checkedAt: '2024-01-16T10:30:00Z'
    },
    {
      id: 'val_003',
      ruleId: 'GPS_MATCH',
      ruleName: 'GPS Location',
      passed: true,
      severity: 'INFO',
      message: 'Photo GPS matches reported location',
      checkedAt: '2024-01-16T10:30:00Z'
    },
    {
      id: 'val_004',
      ruleId: 'DUPLICATE_CHECK',
      ruleName: 'Duplicate Check',
      passed: true,
      severity: 'ERROR',
      message: 'No duplicate entries found',
      checkedAt: '2024-01-16T10:30:00Z'
    }
  ],
  complianceScore: 95,
  flags: [],
  createdAt: '2024-01-15T18:00:00Z',
  updatedAt: '2024-01-16T10:30:00Z',
  syncedAt: '2024-01-16T08:00:00Z'
};

// ============================================
// PLACEHOLDER VIEWS
// ============================================

interface PlaceholderViewProps {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const PlaceholderView: React.FC<PlaceholderViewProps> = ({ title, description, icon }) => (
  <div className="flex flex-col items-center justify-center h-full" style={{ background: 'var(--void)' }}>
    <div
      className="p-6 rounded-3xl mb-6"
      style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
    >
      <div className="w-16 h-16 flex items-center justify-center" style={{ color: 'var(--text-ghost)' }}>
        {icon}
      </div>
    </div>
    <h2 className="text-2xl font-black tracking-tighter mb-2" style={{ color: 'var(--text-primary)' }}>{title}</h2>
    <p className="text-sm" style={{ color: 'var(--text-ghost)' }}>{description}</p>
    <button
      className="mt-6 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
      style={{ background: 'var(--neural-dim)', border: '1px solid var(--border-neural)', color: 'var(--neural-core)' }}
    >
      <Zap className="w-4 h-4" />
      Coming Soon
    </button>
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

const BillingApp: React.FC = () => {
  // View state
  const [currentView, setCurrentView] = useState<BillingView>('inbox');

  // Review panel state
  const [reviewPanelOpen, setReviewPanelOpen] = useState(false);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);

  // Batch builder state
  const [batchBuilderOpen, setBatchBuilderOpen] = useState(false);
  const [batchLineIds, setBatchLineIds] = useState<string[]>([]);

  // Handlers
  const handleOpenReview = useCallback((lineId: string) => {
    setSelectedLineId(lineId);
    setReviewPanelOpen(true);
  }, []);

  const handleCloseReview = useCallback(() => {
    setReviewPanelOpen(false);
    setSelectedLineId(null);
  }, []);

  const handleCreateBatch = useCallback((lineIds: string[]) => {
    setBatchLineIds(lineIds);
    setBatchBuilderOpen(true);
    setCurrentView('batch-builder');
  }, []);

  const handleSaveLine = useCallback(async (lineId: string, updates: Partial<ProductionLine>) => {
    console.log('Saving line:', lineId, updates);
    await new Promise(r => setTimeout(r, 500));
  }, []);

  const handleApproveLine = useCallback(async (lineId: string) => {
    console.log('Approving line:', lineId);
    await new Promise(r => setTimeout(r, 500));
    handleCloseReview();
  }, [handleCloseReview]);

  const handleRejectLine = useCallback(async (lineId: string, reason: string) => {
    console.log('Rejecting line:', lineId, reason);
    await new Promise(r => setTimeout(r, 500));
    handleCloseReview();
  }, [handleCloseReview]);

  const handleSaveBatch = useCallback(async (batch: Partial<InvoiceBatch>) => {
    console.log('Saving batch:', batch);
    await new Promise(r => setTimeout(r, 500));
  }, []);

  const handleSubmitBatch = useCallback(async (batchId: string) => {
    console.log('Submitting batch:', batchId);
    await new Promise(r => setTimeout(r, 500));
    setBatchBuilderOpen(false);
    setCurrentView('tracker');
  }, []);

  const handleCancelBatch = useCallback(() => {
    setBatchBuilderOpen(false);
    setBatchLineIds([]);
    setCurrentView('inbox');
  }, []);

  const handleViewInvoice = useCallback((batchId: string) => {
    console.log('Viewing invoice:', batchId);
  }, []);

  const handleRecordPayment = useCallback((batchId: string) => {
    console.log('Recording payment for:', batchId);
  }, []);

  // Get selected line for review panel
  const selectedLine = selectedLineId ? MOCK_LINE : null;

  // Render content based on current view
  const renderContent = () => {
    switch (currentView) {
      case 'inbox':
        return (
          <ProductionInbox
            onOpenReview={handleOpenReview}
            onCreateBatch={handleCreateBatch}
          />
        );

      case 'batch-builder':
        return (
          <BatchBuilder
            initialLineIds={batchLineIds}
            onSave={handleSaveBatch}
            onSubmit={handleSubmitBatch}
            onCancel={handleCancelBatch}
          />
        );

      case 'tracker':
        return (
          <ARTracker
            onViewInvoice={handleViewInvoice}
            onRecordPayment={handleRecordPayment}
          />
        );

      case 'quick-invoice':
        return <QuickInvoice />;

      case 'batches':
        return (
          <PlaceholderView
            title="Invoice Batches"
            description="List of all invoice batches would appear here"
            icon={<Receipt className="w-12 h-12" />}
          />
        );

      case 'rate-cards':
        return (
          <PlaceholderView
            title="Rate Card Manager"
            description="Rate card configuration would appear here"
            icon={<Calculator className="w-12 h-12" />}
          />
        );

      case 'reports':
        return (
          <PlaceholderView
            title="Reports & Analytics"
            description="Aging reports, rejection analysis, forecasts would appear here"
            icon={<FileText className="w-12 h-12" />}
          />
        );

      case 'settings':
        return (
          <PlaceholderView
            title="Settings"
            description="User management, permissions, audit log would appear here"
            icon={<Settings className="w-12 h-12" />}
          />
        );

      default:
        return null;
    }
  };

  return (
    <BillingLayout
      currentView={currentView}
      onViewChange={setCurrentView}
    >
      {renderContent()}

      {/* Review Side Panel */}
      <LineReviewPanel
        line={selectedLine}
        isOpen={reviewPanelOpen}
        onClose={handleCloseReview}
        onSave={handleSaveLine}
        onApprove={handleApproveLine}
        onReject={handleRejectLine}
      />
    </BillingLayout>
  );
};

export default BillingApp;
