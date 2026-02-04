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
// SELECTED LINE - Will be fetched from real data when available
// ============================================

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

  // Get selected line for review panel - will fetch from real data
  const selectedLine: ProductionLine | null = null;

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
