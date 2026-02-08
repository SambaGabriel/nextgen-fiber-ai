/**
 * Drills Management Component
 * Admin view for managing drills and their investors (underground equipment)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, User, TrendingUp, Search, X, Save, HardHat } from 'lucide-react';
import { getDrills, createDrill, updateDrill, deleteDrill, getDrillStats, getDrillsByInvestor } from '../../services/drillService';
import { getInvestors } from '../../services/truckService';
import type { Drill, DrillStats } from '../../types/equipment';
import type { Investor } from '../../services/truckService';

interface Props {
  onClose?: () => void;
}

const DrillsManagement: React.FC<Props> = ({ onClose }) => {
  const [drills, setDrills] = useState<Drill[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOwnerType, setFilterOwnerType] = useState<'all' | 'company' | 'investor'>('all');

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDrill, setEditingDrill] = useState<Drill | null>(null);
  const [formData, setFormData] = useState({
    label: '',
    equipmentDescription: '',
    ownerType: 'company' as 'company' | 'investor',
    investorId: ''
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Stats
  const [selectedDrillStats, setSelectedDrillStats] = useState<DrillStats | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [drillsData, investorsData] = await Promise.all([
        getDrills(),
        getInvestors()
      ]);
      setDrills(drillsData);
      setInvestors(investorsData);
    } catch (error) {
      console.error('[DrillsManagement] Error loading data:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter drills
  const filteredDrills = drills.filter(drill => {
    const matchesSearch = drill.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      drill.equipmentDescription?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      drill.investorName?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = filterOwnerType === 'all' ||
      (filterOwnerType === 'company' && drill.ownerType !== 'investor') ||
      (filterOwnerType === 'investor' && drill.ownerType === 'investor');

    return matchesSearch && matchesFilter;
  });

  // Open form for new drill
  const handleNew = () => {
    setEditingDrill(null);
    setFormData({
      label: '',
      equipmentDescription: '',
      ownerType: 'company',
      investorId: ''
    });
    setFormError('');
    setIsFormOpen(true);
  };

  // Open form for editing
  const handleEdit = (drill: Drill) => {
    setEditingDrill(drill);
    setFormData({
      label: drill.label,
      equipmentDescription: drill.equipmentDescription || '',
      ownerType: drill.ownerType || 'company',
      investorId: drill.investorId || ''
    });
    setFormError('');
    setIsFormOpen(true);
  };

  // Save drill
  const handleSave = async () => {
    if (!formData.label.trim()) {
      setFormError('Drill label is required');
      return;
    }

    if (formData.ownerType === 'investor' && !formData.investorId) {
      setFormError('Please select an investor');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      if (editingDrill) {
        await updateDrill(editingDrill.id, {
          label: formData.label,
          equipmentDescription: formData.equipmentDescription || undefined,
          ownerType: formData.ownerType,
          investorId: formData.ownerType === 'investor' ? formData.investorId : undefined
        });
      } else {
        await createDrill({
          label: formData.label,
          equipmentDescription: formData.equipmentDescription || undefined,
          ownerType: formData.ownerType,
          investorId: formData.ownerType === 'investor' ? formData.investorId : undefined
        });
      }

      await loadData();
      setIsFormOpen(false);
    } catch (error: any) {
      setFormError(error.message || 'Failed to save drill');
    }

    setSaving(false);
  };

  // Delete drill
  const handleDelete = async (drill: Drill) => {
    if (!confirm(`Delete drill ${drill.label}?`)) return;

    try {
      await deleteDrill(drill.id);
      await loadData();
    } catch (error) {
      console.error('[DrillsManagement] Error deleting drill:', error);
    }
  };

  // Load stats
  const handleViewStats = async (drill: Drill) => {
    try {
      const stats = await getDrillStats(drill.id);
      setSelectedDrillStats(stats);
    } catch (error) {
      console.error('[DrillsManagement] Error loading stats:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Drills Management
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Manage boring/drilling equipment for underground work
          </p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white transition-all"
          style={{ background: 'var(--neural-core)', boxShadow: 'var(--shadow-neural)' }}
        >
          <Plus className="w-5 h-5" />
          Add Drill
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            placeholder="Search drills..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm"
            style={{
              background: 'var(--elevated)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)'
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          {(['all', 'company', 'investor'] as const).map(filter => (
            <button
              key={filter}
              onClick={() => setFilterOwnerType(filter)}
              className="px-3 py-2 rounded-lg text-sm font-medium capitalize transition-all"
              style={{
                background: filterOwnerType === filter ? 'var(--neural-dim)' : 'var(--elevated)',
                color: filterOwnerType === filter ? 'var(--neural-core)' : 'var(--text-secondary)',
                border: filterOwnerType === filter ? '1px solid var(--neural-core)' : '1px solid var(--border-default)'
              }}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Drills Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 rounded-full" style={{ borderColor: 'var(--neural-core)', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDrills.map(drill => (
            <div
              key={drill.id}
              className="p-5 rounded-2xl transition-all"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border-default)'
              }}
            >
              {/* Drill Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: 'var(--warning-dim)' }}
                  >
                    <HardHat className="w-6 h-6" style={{ color: 'var(--warning-core)' }} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                      {drill.label}
                    </h3>
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{
                        background: drill.ownerType === 'investor' ? 'var(--warning-dim)' : 'var(--success-dim)',
                        color: drill.ownerType === 'investor' ? 'var(--warning-core)' : 'var(--success-core)'
                      }}
                    >
                      {drill.ownerType === 'investor' ? 'Investor Owned' : 'Company Owned'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(drill)}
                    className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                  >
                    <Edit2 className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                  </button>
                  <button
                    onClick={() => handleDelete(drill)}
                    className="p-2 rounded-lg transition-colors hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" style={{ color: 'var(--critical-core)' }} />
                  </button>
                </div>
              </div>

              {/* Description */}
              {drill.equipmentDescription && (
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                  {drill.equipmentDescription}
                </p>
              )}

              {/* Investor */}
              {drill.investorName && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg" style={{ background: 'var(--elevated)' }}>
                  <User className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {drill.investorName}
                  </span>
                </div>
              )}

              {/* Stats Button */}
              <button
                onClick={() => handleViewStats(drill)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{
                  background: 'var(--elevated)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-default)'
                }}
              >
                <TrendingUp className="w-4 h-4" />
                View Statistics
              </button>
            </div>
          ))}

          {filteredDrills.length === 0 && (
            <div className="col-span-full py-12 text-center" style={{ color: 'var(--text-tertiary)' }}>
              No drills found
            </div>
          )}
        </div>
      )}

      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="w-full max-w-lg p-6 rounded-2xl mx-4"
            style={{ background: 'var(--surface)' }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {editingDrill ? 'Edit Drill' : 'Add New Drill'}
              </h2>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Drill Label */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Drill ID / Label *
                </label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="e.g., DRILL-001"
                  className="w-full px-4 py-2.5 rounded-xl text-sm"
                  style={{
                    background: 'var(--elevated)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Equipment Description
                </label>
                <input
                  type="text"
                  value={formData.equipmentDescription}
                  onChange={(e) => setFormData({ ...formData, equipmentDescription: e.target.value })}
                  placeholder="e.g., Vermeer D24x40 Series III"
                  className="w-full px-4 py-2.5 rounded-xl text-sm"
                  style={{
                    background: 'var(--elevated)',
                    border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              {/* Owner Type */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Owner Type
                </label>
                <div className="flex gap-3">
                  {(['company', 'investor'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setFormData({ ...formData, ownerType: type, investorId: '' })}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium capitalize transition-all"
                      style={{
                        background: formData.ownerType === type ? 'var(--neural-dim)' : 'var(--elevated)',
                        color: formData.ownerType === type ? 'var(--neural-core)' : 'var(--text-secondary)',
                        border: formData.ownerType === type ? '1px solid var(--neural-core)' : '1px solid var(--border-default)'
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Investor Select */}
              {formData.ownerType === 'investor' && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Investor *
                  </label>
                  <select
                    value={formData.investorId}
                    onChange={(e) => setFormData({ ...formData, investorId: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl text-sm"
                    style={{
                      background: 'var(--elevated)',
                      border: '1px solid var(--border-default)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value="">Select investor...</option>
                    {investors.map(inv => (
                      <option key={inv.id} value={inv.id}>{inv.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Error */}
              {formError && (
                <div className="px-4 py-3 rounded-xl text-sm" style={{ background: 'var(--critical-dim)', color: 'var(--critical-core)' }}>
                  {formError}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                  style={{
                    background: 'var(--elevated)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-default)'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ background: 'var(--neural-core)' }}
                >
                  {saving ? (
                    <div className="animate-spin w-4 h-4 border-2 rounded-full border-white border-t-transparent" />
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Modal */}
      {selectedDrillStats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="w-full max-w-md p-6 rounded-2xl mx-4"
            style={{ background: 'var(--surface)' }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                Drill Statistics
              </h2>
              <button
                onClick={() => setSelectedDrillStats(null)}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-center mb-6">
                <HardHat className="w-12 h-12 mx-auto mb-2" style={{ color: 'var(--warning-core)' }} />
                <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {selectedDrillStats.label}
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl text-center" style={{ background: 'var(--elevated)' }}>
                  <p className="text-2xl font-bold" style={{ color: 'var(--neural-core)' }}>
                    {selectedDrillStats.totalJobs}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Total Jobs</p>
                </div>
                <div className="p-4 rounded-xl text-center" style={{ background: 'var(--elevated)' }}>
                  <p className="text-2xl font-bold" style={{ color: 'var(--neural-core)' }}>
                    {selectedDrillStats.totalFootage.toLocaleString()}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Total Feet</p>
                </div>
                <div className="p-4 rounded-xl text-center" style={{ background: 'var(--elevated)' }}>
                  <p className="text-2xl font-bold" style={{ color: 'var(--success-core)' }}>
                    ${selectedDrillStats.totalRevenue.toLocaleString()}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Revenue</p>
                </div>
                <div className="p-4 rounded-xl text-center" style={{ background: 'var(--elevated)' }}>
                  <p className="text-2xl font-bold" style={{ color: 'var(--warning-core)' }}>
                    ${selectedDrillStats.totalInvestorReturns.toLocaleString()}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Investor Returns</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedDrillStats(null)}
                className="w-full py-2.5 rounded-xl text-sm font-medium mt-4"
                style={{
                  background: 'var(--elevated)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-default)'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DrillsManagement;
