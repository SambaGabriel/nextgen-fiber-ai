/**
 * Investor Dashboard Component
 * Shows investor's equipment and returns summary
 */

import React, { useState, useEffect, useCallback } from 'react';
import { DollarSign, Truck as TruckIcon, HardHat, TrendingUp, Calendar, ChevronRight, Loader2 } from 'lucide-react';
import { getTrucksByInvestor, getTruckStats, type Truck } from '../../services/truckService';
import { getDrillsByInvestor, getDrillStats } from '../../services/drillService';
import { getInvestorReturnHistory } from '../../services/payrollService';
import type { Drill, TruckStats, DrillStats } from '../../types/equipment';
import type { InvestorReturn } from '../../types/payroll';
import type { User } from '../../types';

interface Props {
  user: User | null;
}

const InvestorDashboard: React.FC<Props> = ({ user }) => {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [drills, setDrills] = useState<Drill[]>([]);
  const [returns, setReturns] = useState<InvestorReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEquipment, setSelectedEquipment] = useState<{
    type: 'truck' | 'drill';
    stats: TruckStats | DrillStats;
  } | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const [trucksData, drillsData, returnsData] = await Promise.all([
        getTrucksByInvestor(user.id),
        getDrillsByInvestor(user.id),
        getInvestorReturnHistory(user.id, 12)
      ]);
      setTrucks(trucksData);
      setDrills(drillsData);
      setReturns(returnsData);
    } catch (error) {
      console.error('[InvestorDashboard] Error loading data:', error);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculate totals
  const totals = returns.reduce((acc, r) => ({
    totalReturns: acc.totalReturns + r.totalReturns,
    totalJobs: acc.totalJobs + r.jobsCount,
    totalFootage: acc.totalFootage + r.totalFootage
  }), { totalReturns: 0, totalJobs: 0, totalFootage: 0 });

  // Get pending returns
  const pendingReturns = returns.filter(r => r.status === 'pending' || r.status === 'approved');
  const pendingAmount = pendingReturns.reduce((sum, r) => sum + r.totalReturns, 0);

  // View equipment stats
  const handleViewTruckStats = async (truck: Truck) => {
    const stats = await getTruckStats(truck.id);
    if (stats) {
      setSelectedEquipment({ type: 'truck', stats });
    }
  };

  const handleViewDrillStats = async (drill: Drill) => {
    const stats = await getDrillStats(drill.id);
    if (stats) {
      setSelectedEquipment({ type: 'drill', stats });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--neural-core)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Investor Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
          Monitor your equipment performance and returns
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--success-dim)' }}>
              <DollarSign className="w-5 h-5" style={{ color: 'var(--success-core)' }} />
            </div>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--success-core)' }}>
            ${totals.totalReturns.toLocaleString()}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Total Returns</p>
        </div>

        <div className="p-5 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--warning-dim)' }}>
              <Calendar className="w-5 h-5" style={{ color: 'var(--warning-core)' }} />
            </div>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--warning-core)' }}>
            ${pendingAmount.toLocaleString()}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Pending Payment</p>
        </div>

        <div className="p-5 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--neural-dim)' }}>
              <TruckIcon className="w-5 h-5" style={{ color: 'var(--neural-core)' }} />
            </div>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {trucks.length}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Trucks</p>
        </div>

        <div className="p-5 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--info-dim)' }}>
              <HardHat className="w-5 h-5" style={{ color: 'var(--info-core)' }} />
            </div>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {drills.length}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Drills</p>
        </div>
      </div>

      {/* Equipment Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trucks */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-3 mb-4">
            <TruckIcon className="w-5 h-5" style={{ color: 'var(--neural-core)' }} />
            <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>My Trucks</h2>
          </div>

          {trucks.length === 0 ? (
            <p className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
              No trucks registered
            </p>
          ) : (
            <div className="space-y-3">
              {trucks.map(truck => (
                <button
                  key={truck.id}
                  onClick={() => handleViewTruckStats(truck)}
                  className="w-full flex items-center justify-between p-4 rounded-xl transition-colors"
                  style={{ background: 'var(--elevated)' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--neural-dim)' }}>
                      <TruckIcon className="w-5 h-5" style={{ color: 'var(--neural-core)' }} />
                    </div>
                    <div className="text-left">
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{truck.truck_number}</p>
                      {truck.description && (
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{truck.description}</p>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Drills */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-3 mb-4">
            <HardHat className="w-5 h-5" style={{ color: 'var(--warning-core)' }} />
            <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>My Drills</h2>
          </div>

          {drills.length === 0 ? (
            <p className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
              No drills registered
            </p>
          ) : (
            <div className="space-y-3">
              {drills.map(drill => (
                <button
                  key={drill.id}
                  onClick={() => handleViewDrillStats(drill)}
                  className="w-full flex items-center justify-between p-4 rounded-xl transition-colors"
                  style={{ background: 'var(--elevated)' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--warning-dim)' }}>
                      <HardHat className="w-5 h-5" style={{ color: 'var(--warning-core)' }} />
                    </div>
                    <div className="text-left">
                      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{drill.label}</p>
                      {drill.equipmentDescription && (
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{drill.equipmentDescription}</p>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Returns */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5" style={{ color: 'var(--success-core)' }} />
            <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Recent Returns</h2>
          </div>
        </div>

        {returns.length === 0 ? (
          <p className="text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
            No returns yet
          </p>
        ) : (
          <div className="space-y-3">
            {returns.slice(0, 5).map(ret => (
              <div
                key={ret.id}
                className="flex items-center justify-between p-4 rounded-xl"
                style={{ background: 'var(--elevated)' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: ret.investorType === 'truck' ? 'var(--neural-dim)' : 'var(--warning-dim)' }}
                  >
                    {ret.investorType === 'truck' ? (
                      <TruckIcon className="w-5 h-5" style={{ color: 'var(--neural-core)' }} />
                    ) : (
                      <HardHat className="w-5 h-5" style={{ color: 'var(--warning-core)' }} />
                    )}
                  </div>
                  <div>
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{ret.equipmentLabel}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {ret.jobsCount} jobs · {ret.totalFootage.toLocaleString()} ft
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold" style={{ color: 'var(--success-core)' }}>
                    ${ret.totalReturns.toLocaleString()}
                  </p>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: ret.status === 'paid' ? 'var(--success-dim)' : 'var(--warning-dim)',
                      color: ret.status === 'paid' ? 'var(--success-core)' : 'var(--warning-core)'
                    }}
                  >
                    {ret.status === 'paid' ? 'Paid' : 'Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Equipment Stats Modal */}
      {selectedEquipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="w-full max-w-md p-6 rounded-2xl mx-4"
            style={{ background: 'var(--surface)' }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                Equipment Stats
              </h2>
              <button
                onClick={() => setSelectedEquipment(null)}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <div className="text-center mb-6">
              {selectedEquipment.type === 'truck' ? (
                <TruckIcon className="w-12 h-12 mx-auto mb-2" style={{ color: 'var(--neural-core)' }} />
              ) : (
                <HardHat className="w-12 h-12 mx-auto mb-2" style={{ color: 'var(--warning-core)' }} />
              )}
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {selectedEquipment.type === 'truck'
                  ? (selectedEquipment.stats as TruckStats).truckNumber
                  : (selectedEquipment.stats as DrillStats).label
                }
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl text-center" style={{ background: 'var(--elevated)' }}>
                <p className="text-2xl font-bold" style={{ color: 'var(--neural-core)' }}>
                  {selectedEquipment.stats.totalJobs}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Total Jobs</p>
              </div>
              <div className="p-4 rounded-xl text-center" style={{ background: 'var(--elevated)' }}>
                <p className="text-2xl font-bold" style={{ color: 'var(--neural-core)' }}>
                  {selectedEquipment.stats.totalFootage.toLocaleString()}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Total Feet</p>
              </div>
              <div className="p-4 rounded-xl text-center" style={{ background: 'var(--elevated)' }}>
                <p className="text-2xl font-bold" style={{ color: 'var(--success-core)' }}>
                  ${selectedEquipment.stats.totalRevenue.toLocaleString()}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Revenue Generated</p>
              </div>
              <div className="p-4 rounded-xl text-center" style={{ background: 'var(--elevated)' }}>
                <p className="text-2xl font-bold" style={{ color: 'var(--warning-core)' }}>
                  ${selectedEquipment.stats.totalInvestorReturns.toLocaleString()}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Your Returns</p>
              </div>
            </div>

            <button
              onClick={() => setSelectedEquipment(null)}
              className="w-full py-2.5 rounded-xl text-sm font-medium mt-6"
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
      )}
    </div>
  );
};

export default InvestorDashboard;
