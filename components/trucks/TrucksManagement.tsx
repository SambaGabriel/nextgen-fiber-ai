/**
 * Trucks Management Component
 * Admin view for managing trucks and their investors
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Truck, Plus, Edit2, Trash2, User, DollarSign, TrendingUp, Search, Filter, X, Save, Check, ChevronDown } from 'lucide-react';
import { getTrucks, createTruck, updateTruck, deleteTruck, getInvestors, getTruckStats } from '../../services/truckService';
import type { Truck as TruckType, Investor } from '../../services/truckService';
import type { TruckStats } from '../../types/equipment';

interface Props {
  onClose?: () => void;
}

const TrucksManagement: React.FC<Props> = ({ onClose }) => {
  const [trucks, setTrucks] = useState<TruckType[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOwnerType, setFilterOwnerType] = useState<'all' | 'company' | 'investor'>('all');

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState<TruckType | null>(null);
  const [formData, setFormData] = useState({
    truck_number: '',
    description: '',
    owner_type: 'company' as 'company' | 'investor',
    investor_id: ''
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Stats
  const [selectedTruckStats, setSelectedTruckStats] = useState<TruckStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [trucksData, investorsData] = await Promise.all([
        getTrucks(),
        getInvestors()
      ]);
      setTrucks(trucksData);
      setInvestors(investorsData);
    } catch (error) {
      console.error('[TrucksManagement] Error loading data:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter trucks
  const filteredTrucks = trucks.filter(truck => {
    const matchesSearch = truck.truck_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      truck.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      truck.investor_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = filterOwnerType === 'all' ||
      (filterOwnerType === 'company' && truck.owner_type !== 'investor') ||
      (filterOwnerType === 'investor' && truck.owner_type === 'investor');

    return matchesSearch && matchesFilter;
  });

  // Open form for new truck
  const handleNew = () => {
    setEditingTruck(null);
    setFormData({
      truck_number: '',
      description: '',
      owner_type: 'company',
      investor_id: ''
    });
    setFormError('');
    setIsFormOpen(true);
  };

  // Open form for editing
  const handleEdit = (truck: TruckType) => {
    setEditingTruck(truck);
    setFormData({
      truck_number: truck.truck_number,
      description: truck.description || '',
      owner_type: truck.owner_type || 'company',
      investor_id: truck.investor_id || ''
    });
    setFormError('');
    setIsFormOpen(true);
  };

  // Save truck
  const handleSave = async () => {
    if (!formData.truck_number.trim()) {
      setFormError('Truck number is required');
      return;
    }

    if (formData.owner_type === 'investor' && !formData.investor_id) {
      setFormError('Please select an investor');
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      if (editingTruck) {
        await updateTruck(editingTruck.id, {
          truck_number: formData.truck_number,
          description: formData.description || undefined,
          owner_type: formData.owner_type,
          investor_id: formData.owner_type === 'investor' ? formData.investor_id : undefined
        });
      } else {
        await createTruck(
          formData.truck_number,
          formData.description || undefined,
          formData.owner_type === 'investor' ? formData.investor_id : undefined
        );
      }

      await loadData();
      setIsFormOpen(false);
    } catch (error: any) {
      setFormError(error.message || 'Failed to save truck');
    }

    setSaving(false);
  };

  // Delete truck
  const handleDelete = async (truck: TruckType) => {
    if (!confirm(`Delete truck ${truck.truck_number}?`)) return;

    try {
      await deleteTruck(truck.id);
      await loadData();
    } catch (error) {
      console.error('[TrucksManagement] Error deleting truck:', error);
    }
  };

  // Load stats
  const handleViewStats = async (truck: TruckType) => {
    setLoadingStats(true);
    try {
      const stats = await getTruckStats(truck.id);
      setSelectedTruckStats(stats);
    } catch (error) {
      console.error('[TrucksManagement] Error loading stats:', error);
    }
    setLoadingStats(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Trucks Management
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Manage company and investor-owned trucks
          </p>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white transition-all"
          style={{ background: 'var(--neural-core)', boxShadow: 'var(--shadow-neural)' }}
        >
          <Plus className="w-5 h-5" />
          Add Truck
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            placeholder="Search trucks..."
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

      {/* Trucks Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 rounded-full" style={{ borderColor: 'var(--neural-core)', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTrucks.map(truck => (
            <div
              key={truck.id}
              className="p-5 rounded-2xl transition-all"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border-default)'
              }}
            >
              {/* Truck Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: 'var(--neural-dim)' }}
                  >
                    <Truck className="w-6 h-6" style={{ color: 'var(--neural-core)' }} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                      {truck.truck_number}
                    </h3>
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{
                        background: truck.owner_type === 'investor' ? 'var(--warning-dim)' : 'var(--success-dim)',
                        color: truck.owner_type === 'investor' ? 'var(--warning-core)' : 'var(--success-core)'
                      }}
                    >
                      {truck.owner_type === 'investor' ? 'Investor Owned' : 'Company Owned'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEdit(truck)}
                    className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                  >
                    <Edit2 className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                  </button>
                  <button
                    onClick={() => handleDelete(truck)}
                    className="p-2 rounded-lg transition-colors hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" style={{ color: 'var(--critical-core)' }} />
                  </button>
                </div>
              </div>

              {/* Description */}
              {truck.description && (
                <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                  {truck.description}
                </p>
              )}

              {/* Investor */}
              {truck.investor_name && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg" style={{ background: 'var(--elevated)' }}>
                  <User className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {truck.investor_name}
                  </span>
                </div>
              )}

              {/* Stats Button */}
              <button
                onClick={() => handleViewStats(truck)}
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

          {filteredTrucks.length === 0 && (
            <div className="col-span-full py-12 text-center" style={{ color: 'var(--text-tertiary)' }}>
              No trucks found
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
                {editingTruck ? 'Edit Truck' : 'Add New Truck'}
              </h2>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Truck Number */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Truck Number *
                </label>
                <input
                  type="text"
                  value={formData.truck_number}
                  onChange={(e) => setFormData({ ...formData, truck_number: e.target.value })}
                  placeholder="e.g., TRK-101"
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
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="e.g., 2023 Ford F-250 Bucket Truck"
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
                      onClick={() => setFormData({ ...formData, owner_type: type, investor_id: '' })}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium capitalize transition-all"
                      style={{
                        background: formData.owner_type === type ? 'var(--neural-dim)' : 'var(--elevated)',
                        color: formData.owner_type === type ? 'var(--neural-core)' : 'var(--text-secondary)',
                        border: formData.owner_type === type ? '1px solid var(--neural-core)' : '1px solid var(--border-default)'
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Investor Select */}
              {formData.owner_type === 'investor' && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Investor *
                  </label>
                  <select
                    value={formData.investor_id}
                    onChange={(e) => setFormData({ ...formData, investor_id: e.target.value })}
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
      {selectedTruckStats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="w-full max-w-md p-6 rounded-2xl mx-4"
            style={{ background: 'var(--surface)' }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                Truck Statistics
              </h2>
              <button
                onClick={() => setSelectedTruckStats(null)}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-center mb-6">
                <Truck className="w-12 h-12 mx-auto mb-2" style={{ color: 'var(--neural-core)' }} />
                <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                  {selectedTruckStats.truckNumber}
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl text-center" style={{ background: 'var(--elevated)' }}>
                  <p className="text-2xl font-bold" style={{ color: 'var(--neural-core)' }}>
                    {selectedTruckStats.totalJobs}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Total Jobs</p>
                </div>
                <div className="p-4 rounded-xl text-center" style={{ background: 'var(--elevated)' }}>
                  <p className="text-2xl font-bold" style={{ color: 'var(--neural-core)' }}>
                    {selectedTruckStats.totalFootage.toLocaleString()}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Total Feet</p>
                </div>
                <div className="p-4 rounded-xl text-center" style={{ background: 'var(--elevated)' }}>
                  <p className="text-2xl font-bold" style={{ color: 'var(--success-core)' }}>
                    ${selectedTruckStats.totalRevenue.toLocaleString()}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Revenue</p>
                </div>
                <div className="p-4 rounded-xl text-center" style={{ background: 'var(--elevated)' }}>
                  <p className="text-2xl font-bold" style={{ color: 'var(--warning-core)' }}>
                    ${selectedTruckStats.totalInvestorReturns.toLocaleString()}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Investor Returns</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedTruckStats(null)}
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

export default TrucksManagement;
