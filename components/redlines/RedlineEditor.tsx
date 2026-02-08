/**
 * RedlineEditor - Create and edit rate card redlines
 * Shows diff view of proposed changes
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  GitBranch, Save, Send, X, Plus, Trash2, ArrowLeft,
  Loader2, AlertCircle, ChevronDown, DollarSign
} from 'lucide-react';
import { User, Language } from '../../types';
import { Redline, RedlineChange, CreateRedlineRequest } from '../../types/redline';
import { redlineService } from '../../services/redlineService';
import { supabase } from '../../services/supabase';

interface RedlineEditorProps {
  user: User;
  lang: Language;
  redline?: Redline;  // Existing redline for editing, undefined for new
  onSave?: (redline: Redline) => void;
  onCancel?: () => void;
}

interface RateCardGroup {
  id: string;
  customerName: string;
  region: string;
  clientName?: string;
}

interface RateCardProfile {
  id: string;
  groupId: string;
  name: string;
  type: string;
}

interface RateCardItem {
  id: string;
  code: string;
  description: string;
  unit: string;
  nextgenRate: number;
  linemanRate: number;
  truckInvestorRate: number;
}

const RedlineEditor: React.FC<RedlineEditorProps> = ({
  user,
  lang,
  redline,
  onSave,
  onCancel
}) => {
  // Form state
  const [selectedGroupId, setSelectedGroupId] = useState(redline?.sourceGroupId || '');
  const [selectedProfileId, setSelectedProfileId] = useState(redline?.sourceProfileId || '');
  const [versionLabel, setVersionLabel] = useState(redline?.versionLabel || '');
  const [changeSummary, setChangeSummary] = useState(redline?.changeSummary || '');
  const [srNumber, setSrNumber] = useState(redline?.srNumber || '');
  const [proposedChanges, setProposedChanges] = useState<RedlineChange[]>(redline?.proposedChanges || []);

  // Data state
  const [groups, setGroups] = useState<RateCardGroup[]>([]);
  const [profiles, setProfiles] = useState<RateCardProfile[]>([]);
  const [rateItems, setRateItems] = useState<RateCardItem[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load groups on mount
  useEffect(() => {
    const loadGroups = async () => {
      try {
        const { data, error } = await supabase
          .from('rate_card_groups')
          .select(`
            id,
            customer_name,
            region,
            client:clients(name)
          `)
          .eq('is_active', true)
          .order('customer_name');

        if (error) throw error;

        setGroups((data || []).map(g => ({
          id: g.id,
          customerName: g.customer_name,
          region: g.region,
          clientName: (g.client as any)?.name
        })));
      } catch (err) {
        console.error('[RedlineEditor] Error loading groups:', err);
        setError('Failed to load rate card groups');
      } finally {
        setIsLoading(false);
      }
    };

    loadGroups();
  }, []);

  // Load profiles when group changes
  useEffect(() => {
    if (!selectedGroupId) {
      setProfiles([]);
      return;
    }

    const loadProfiles = async () => {
      try {
        const { data, error } = await supabase
          .from('rate_card_profiles')
          .select('id, group_id, name, type')
          .eq('group_id', selectedGroupId)
          .eq('is_active', true)
          .order('name');

        if (error) throw error;

        setProfiles((data || []).map(p => ({
          id: p.id,
          groupId: p.group_id,
          name: p.name,
          type: p.type
        })));
      } catch (err) {
        console.error('[RedlineEditor] Error loading profiles:', err);
      }
    };

    loadProfiles();
  }, [selectedGroupId]);

  // Load rate items when profile changes
  useEffect(() => {
    if (!selectedProfileId) {
      setRateItems([]);
      return;
    }

    const loadRateItems = async () => {
      try {
        const { data, error } = await supabase
          .from('rate_card_items')
          .select('id, code, description, unit, nextgen_rate, lineman_rate, truck_investor_rate')
          .eq('profile_id', selectedProfileId)
          .eq('is_active', true)
          .order('code');

        if (error) throw error;

        setRateItems((data || []).map(item => ({
          id: item.id,
          code: item.code,
          description: item.description,
          unit: item.unit,
          nextgenRate: parseFloat(item.nextgen_rate) || 0,
          linemanRate: parseFloat(item.lineman_rate) || 0,
          truckInvestorRate: parseFloat(item.truck_investor_rate) || 0
        })));
      } catch (err) {
        console.error('[RedlineEditor] Error loading rate items:', err);
      }
    };

    loadRateItems();
  }, [selectedProfileId]);

  // Add a change
  const addChange = useCallback((code: string, field: 'nextgen_rate' | 'lineman_rate' | 'truck_investor_rate') => {
    const item = rateItems.find(r => r.code === code);
    if (!item) return;

    const oldValue = field === 'nextgen_rate' ? item.nextgenRate :
                     field === 'lineman_rate' ? item.linemanRate :
                     item.truckInvestorRate;

    // Check if already exists
    const exists = proposedChanges.find(c => c.code === code && c.field === field);
    if (exists) return;

    setProposedChanges(prev => [...prev, {
      code,
      field,
      oldValue,
      newValue: oldValue // Start with same value, user will edit
    }]);
  }, [rateItems, proposedChanges]);

  // Update a change
  const updateChange = useCallback((index: number, newValue: number) => {
    setProposedChanges(prev => prev.map((c, i) =>
      i === index ? { ...c, newValue } : c
    ));
  }, []);

  // Remove a change
  const removeChange = useCallback((index: number) => {
    setProposedChanges(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Save as draft
  const handleSaveDraft = useCallback(async () => {
    if (!selectedProfileId || !selectedGroupId) {
      setError('Please select a rate card group and profile');
      return;
    }

    if (proposedChanges.length === 0) {
      setError('Please add at least one change');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      let savedRedline: Redline;

      if (redline?.id) {
        // Update existing
        savedRedline = await redlineService.updateRedline(redline.id, {
          proposedChanges,
          changeSummary,
          versionLabel,
          srNumber
        });
      } else {
        // Create new
        const request: CreateRedlineRequest = {
          sourceProfileId: selectedProfileId,
          sourceGroupId: selectedGroupId,
          proposedChanges,
          changeSummary,
          versionLabel,
          srNumber
        };
        savedRedline = await redlineService.createRedline(request, user.id, user.name);
      }

      onSave?.(savedRedline);
    } catch (err) {
      console.error('[RedlineEditor] Error saving:', err);
      setError('Failed to save redline');
    } finally {
      setIsSaving(false);
    }
  }, [selectedProfileId, selectedGroupId, proposedChanges, changeSummary, versionLabel, srNumber, redline, user, onSave]);

  // Submit for review
  const handleSubmit = useCallback(async () => {
    if (!redline?.id) {
      // Save first, then submit
      await handleSaveDraft();
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const submitted = await redlineService.submitRedline(redline.id, user.id);
      onSave?.(submitted);
    } catch (err) {
      console.error('[RedlineEditor] Error submitting:', err);
      setError('Failed to submit for review');
    } finally {
      setIsSaving(false);
    }
  }, [redline, user, handleSaveDraft, onSave]);

  // Format currency
  const formatRate = (value: number) => `$${value.toFixed(2)}`;

  // Get field label
  const getFieldLabel = (field: string) => {
    switch (field) {
      case 'nextgen_rate': return 'NextGen Rate';
      case 'lineman_rate': return 'Lineman Rate';
      case 'truck_investor_rate': return 'Investor Rate';
      default: return field;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--neural-core)' }} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--abyss)' }}>
      {/* Header */}
      <div className="p-6 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onCancel && (
              <button
                onClick={onCancel}
                className="p-2 rounded-xl hover:bg-white/5"
              >
                <ArrowLeft className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
              </button>
            )}
            <div className="p-3 rounded-2xl" style={{ background: 'var(--neural-dim)' }}>
              <GitBranch className="w-6 h-6" style={{ color: 'var(--neural-core)' }} />
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {redline ? 'Edit Redline' : 'New Redline'}
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Propose changes to rate card values
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Draft
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSaving || proposedChanges.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all hover:scale-105 disabled:opacity-50"
              style={{ background: 'var(--gradient-neural)', color: '#000' }}
            >
              <Send className="w-4 h-4" />
              Submit for Review
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-6 mt-4 p-4 rounded-xl flex items-center gap-3" style={{ background: 'var(--critical-glow)', border: '1px solid var(--critical-core)' }}>
          <AlertCircle className="w-5 h-5" style={{ color: 'var(--critical-core)' }} />
          <p className="text-sm" style={{ color: 'var(--critical-core)' }}>{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" style={{ color: 'var(--critical-core)' }} />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Rate Card Selection */}
          <div className="p-6 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
            <h2 className="text-sm font-bold uppercase mb-4" style={{ color: 'var(--text-tertiary)' }}>
              Rate Card Selection
            </h2>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-ghost)' }}>
                  Rate Card Group *
                </label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => {
                    setSelectedGroupId(e.target.value);
                    setSelectedProfileId('');
                    setProposedChanges([]);
                  }}
                  disabled={!!redline}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
                >
                  <option value="">Select Group</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.customerName} - {g.region} {g.clientName ? `(${g.clientName})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-ghost)' }}>
                  Rate Card Profile *
                </label>
                <select
                  value={selectedProfileId}
                  onChange={(e) => {
                    setSelectedProfileId(e.target.value);
                    setProposedChanges([]);
                  }}
                  disabled={!selectedGroupId || !!redline}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
                >
                  <option value="">Select Profile</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.type})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-ghost)' }}>
                  Version Label
                </label>
                <input
                  type="text"
                  value={versionLabel}
                  onChange={(e) => setVersionLabel(e.target.value)}
                  placeholder="e.g., Q1 2024 Update"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-ghost)' }}>
                  SR Number
                </label>
                <input
                  type="text"
                  value={srNumber}
                  onChange={(e) => setSrNumber(e.target.value)}
                  placeholder="e.g., SR-2024-0042"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-ghost)' }}>
                Change Summary
              </label>
              <textarea
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder="Describe the reason for these changes..."
                rows={2}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                style={{ background: 'var(--elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
              />
            </div>
          </div>

          {/* Rate Items - Add Changes */}
          {selectedProfileId && rateItems.length > 0 && (
            <div className="p-6 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
              <h2 className="text-sm font-bold uppercase mb-4" style={{ color: 'var(--text-tertiary)' }}>
                Add Rate Changes
              </h2>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {rateItems.slice(0, 20).map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg"
                    style={{ background: 'var(--elevated)' }}
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {item.code}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-ghost)' }}>
                        {item.description} ({item.unit})
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => addChange(item.code, 'nextgen_rate')}
                        className="px-2 py-1 rounded text-[10px] font-bold"
                        style={{ background: 'var(--neural-dim)', color: 'var(--neural-core)' }}
                      >
                        NextGen {formatRate(item.nextgenRate)}
                      </button>
                      <button
                        onClick={() => addChange(item.code, 'lineman_rate')}
                        className="px-2 py-1 rounded text-[10px] font-bold"
                        style={{ background: 'var(--energy-dim)', color: 'var(--energy-core)' }}
                      >
                        Lineman {formatRate(item.linemanRate)}
                      </button>
                      <button
                        onClick={() => addChange(item.code, 'truck_investor_rate')}
                        className="px-2 py-1 rounded text-[10px] font-bold"
                        style={{ background: 'var(--online-glow)', color: 'var(--online-core)' }}
                      >
                        Investor {formatRate(item.truckInvestorRate)}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Proposed Changes */}
          {proposedChanges.length > 0 && (
            <div className="p-6 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
              <h2 className="text-sm font-bold uppercase mb-4" style={{ color: 'var(--text-tertiary)' }}>
                Proposed Changes ({proposedChanges.length})
              </h2>

              <div className="space-y-3">
                {proposedChanges.map((change, index) => (
                  <div
                    key={`${change.code}-${change.field}-${index}`}
                    className="flex items-center gap-4 p-4 rounded-xl"
                    style={{ background: 'var(--elevated)', border: '1px solid var(--border-subtle)' }}
                  >
                    <div className="flex-1">
                      <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                        {change.code}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-ghost)' }}>
                        {getFieldLabel(change.field)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Old Value */}
                      <div className="text-center">
                        <p className="text-[10px] uppercase" style={{ color: 'var(--text-ghost)' }}>Current</p>
                        <p className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
                          {formatRate(change.oldValue)}
                        </p>
                      </div>

                      <ChevronDown className="w-4 h-4 rotate-[-90deg]" style={{ color: 'var(--text-ghost)' }} />

                      {/* New Value Input */}
                      <div className="text-center">
                        <p className="text-[10px] uppercase" style={{ color: 'var(--text-ghost)' }}>New</p>
                        <div className="flex items-center gap-1">
                          <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={change.newValue}
                            onChange={(e) => updateChange(index, parseFloat(e.target.value) || 0)}
                            className="w-20 px-2 py-1 rounded text-sm font-mono text-center outline-none"
                            style={{
                              background: 'var(--surface)',
                              color: change.newValue !== change.oldValue ? 'var(--energy-core)' : 'var(--text-primary)',
                              border: '1px solid var(--border-default)'
                            }}
                          />
                        </div>
                      </div>

                      {/* Diff */}
                      {change.newValue !== change.oldValue && (
                        <div className="text-center min-w-[60px]">
                          <p className="text-[10px] uppercase" style={{ color: 'var(--text-ghost)' }}>Diff</p>
                          <p
                            className="text-sm font-bold"
                            style={{
                              color: change.newValue > change.oldValue ? 'var(--online-core)' : 'var(--critical-core)'
                            }}
                          >
                            {change.newValue > change.oldValue ? '+' : ''}
                            {formatRate(change.newValue - change.oldValue)}
                          </p>
                        </div>
                      )}

                      {/* Remove */}
                      <button
                        onClick={() => removeChange(index)}
                        className="p-2 rounded-lg hover:bg-white/5"
                      >
                        <Trash2 className="w-4 h-4" style={{ color: 'var(--critical-core)' }} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RedlineEditor;
