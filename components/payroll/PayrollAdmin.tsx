/**
 * Payroll Admin Component
 * Admin view for managing weekly payroll and investor returns
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign, Users, Calendar, Check, X, Clock, ChevronLeft, ChevronRight,
  Download, Filter, Search, TrendingUp, Truck, HardHat, Loader2
} from 'lucide-react';
import {
  getPayableWeeks,
  getWeeklyPayroll,
  getPayWeekLabel,
  approvePayroll,
  markPayrollAsPaid,
  markInvestorReturnAsPaid
} from '../../services/payrollService';
import type { PayPeriodSummary, WeeklyPayrollSummary, PayrollRecord, InvestorReturn } from '../../types/payroll';
import type { User } from '../../types';

interface Props {
  user: User | null;
}

const PayrollAdmin: React.FC<Props> = ({ user }) => {
  const [weeks, setWeeks] = useState<PayPeriodSummary[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyPayrollSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingWeekly, setLoadingWeekly] = useState(false);
  const [activeTab, setActiveTab] = useState<'workers' | 'investors'>('workers');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'paid'>('all');

  // Load weeks
  const loadWeeks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPayableWeeks(12);
      setWeeks(data);
      if (data.length > 0 && !selectedWeek) {
        setSelectedWeek(data[0].weekKey);
      }
    } catch (error) {
      console.error('[PayrollAdmin] Error loading weeks:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadWeeks();
  }, [loadWeeks]);

  // Load weekly data when week changes
  useEffect(() => {
    if (!selectedWeek) return;

    const loadWeeklyData = async () => {
      setLoadingWeekly(true);
      try {
        const data = await getWeeklyPayroll(selectedWeek);
        setWeeklyData(data);
      } catch (error) {
        console.error('[PayrollAdmin] Error loading weekly data:', error);
      }
      setLoadingWeekly(false);
    };

    loadWeeklyData();
  }, [selectedWeek]);

  // Filter workers
  const filteredWorkers = (weeklyData?.workers || []).filter(worker => {
    const matchesSearch = worker.userName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || worker.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Filter investors
  const filteredInvestors = (weeklyData?.investors || []).filter(inv => {
    const matchesSearch = inv.investorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.equipmentLabel.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || inv.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Actions
  const handleApprove = async (record: PayrollRecord) => {
    if (!user) return;
    try {
      await approvePayroll(record.id, user.id);
      // Reload
      if (selectedWeek) {
        const data = await getWeeklyPayroll(selectedWeek);
        setWeeklyData(data);
      }
    } catch (error) {
      console.error('[PayrollAdmin] Error approving:', error);
    }
  };

  const handleMarkPaid = async (record: PayrollRecord) => {
    if (!user) return;
    const ref = prompt('Enter payment reference (check #, wire ref, etc.):');
    if (ref === null) return;

    try {
      await markPayrollAsPaid(record.id, user.id, ref || undefined);
      if (selectedWeek) {
        const data = await getWeeklyPayroll(selectedWeek);
        setWeeklyData(data);
      }
    } catch (error) {
      console.error('[PayrollAdmin] Error marking paid:', error);
    }
  };

  const handleMarkInvestorPaid = async (inv: InvestorReturn) => {
    if (!user) return;
    const ref = prompt('Enter payment reference:');
    if (ref === null) return;

    try {
      await markInvestorReturnAsPaid(inv.id, user.id, ref || undefined);
      if (selectedWeek) {
        const data = await getWeeklyPayroll(selectedWeek);
        setWeeklyData(data);
      }
    } catch (error) {
      console.error('[PayrollAdmin] Error marking investor paid:', error);
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string; label: string }> = {
      pending: { bg: 'var(--warning-dim)', color: 'var(--warning-core)', label: 'Pending' },
      approved: { bg: 'var(--info-dim)', color: 'var(--info-core)', label: 'Approved' },
      paid: { bg: 'var(--success-dim)', color: 'var(--success-core)', label: 'Paid' },
      disputed: { bg: 'var(--critical-dim)', color: 'var(--critical-core)', label: 'Disputed' }
    };
    const s = styles[status] || styles.pending;
    return (
      <span
        className="px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ background: s.bg, color: s.color }}
      >
        {s.label}
      </span>
    );
  };

  const currentWeek = weeks.find(w => w.weekKey === selectedWeek);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Payroll Management
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Manage weekly payroll and investor returns
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all"
          style={{
            background: 'var(--elevated)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-default)'
          }}
        >
          <Download className="w-5 h-5" />
          Export
        </button>
      </div>

      {/* Week Selector */}
      <div className="flex items-center gap-4 overflow-x-auto pb-2">
        {loading ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--neural-core)' }} />
            <span style={{ color: 'var(--text-tertiary)' }}>Loading weeks...</span>
          </div>
        ) : (
          weeks.slice(0, 8).map(week => (
            <button
              key={week.weekKey}
              onClick={() => setSelectedWeek(week.weekKey)}
              className="flex-shrink-0 px-4 py-3 rounded-xl transition-all min-w-[160px]"
              style={{
                background: selectedWeek === week.weekKey ? 'var(--neural-dim)' : 'var(--surface)',
                border: selectedWeek === week.weekKey ? '2px solid var(--neural-core)' : '1px solid var(--border-default)'
              }}
            >
              <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                Week {week.weekNumber}
              </p>
              <p className="font-semibold" style={{ color: selectedWeek === week.weekKey ? 'var(--neural-core)' : 'var(--text-primary)' }}>
                {getPayWeekLabel(week.weekKey)}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {week.recordsCount} workers
                </span>
                {week.pendingCount > 0 && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full"
                    style={{ background: 'var(--warning-dim)', color: 'var(--warning-core)' }}
                  >
                    {week.pendingCount} pending
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Summary Cards */}
      {weeklyData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--neural-dim)' }}>
                <Users className="w-5 h-5" style={{ color: 'var(--neural-core)' }} />
              </div>
              <span className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>Worker Pay</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              ${weeklyData.totals.workerPayTotal.toLocaleString()}
            </p>
          </div>

          <div className="p-5 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--warning-dim)' }}>
                <TrendingUp className="w-5 h-5" style={{ color: 'var(--warning-core)' }} />
              </div>
              <span className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>Investor Returns</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              ${weeklyData.totals.investorReturnTotal.toLocaleString()}
            </p>
          </div>

          <div className="p-5 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--success-dim)' }}>
                <DollarSign className="w-5 h-5" style={{ color: 'var(--success-core)' }} />
              </div>
              <span className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>Total Payout</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              ${weeklyData.totals.grandTotal.toLocaleString()}
            </p>
          </div>

          <div className="p-5 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--info-dim)' }}>
                <Calendar className="w-5 h-5" style={{ color: 'var(--info-core)' }} />
              </div>
              <span className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>Pay Date</span>
            </div>
            <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {currentWeek ? new Date(currentWeek.payDate).toLocaleDateString() : '-'}
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b" style={{ borderColor: 'var(--border-default)' }}>
        <button
          onClick={() => setActiveTab('workers')}
          className="px-4 py-3 font-medium transition-all relative"
          style={{
            color: activeTab === 'workers' ? 'var(--neural-core)' : 'var(--text-tertiary)'
          }}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Workers ({weeklyData?.workers.length || 0})
          </div>
          {activeTab === 'workers' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'var(--neural-core)' }} />
          )}
        </button>
        <button
          onClick={() => setActiveTab('investors')}
          className="px-4 py-3 font-medium transition-all relative"
          style={{
            color: activeTab === 'investors' ? 'var(--neural-core)' : 'var(--text-tertiary)'
          }}
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Investors ({weeklyData?.investors.length || 0})
          </div>
          {activeTab === 'investors' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'var(--neural-core)' }} />
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            placeholder="Search..."
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
          {(['all', 'pending', 'approved', 'paid'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className="px-3 py-2 rounded-lg text-sm font-medium capitalize transition-all"
              style={{
                background: filterStatus === status ? 'var(--neural-dim)' : 'var(--elevated)',
                color: filterStatus === status ? 'var(--neural-core)' : 'var(--text-secondary)',
                border: filterStatus === status ? '1px solid var(--neural-core)' : '1px solid var(--border-default)'
              }}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loadingWeekly ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--neural-core)' }} />
        </div>
      ) : activeTab === 'workers' ? (
        /* Workers Table */
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--elevated)' }}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>Worker</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>Role</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>Jobs</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>Footage</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>Amount</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkers.map((worker, i) => (
                <tr
                  key={worker.id}
                  className="border-t transition-colors hover:bg-gray-50"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{worker.userName}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        background: worker.userRole === 'FOREMAN' ? 'var(--warning-dim)' : 'var(--info-dim)',
                        color: worker.userRole === 'FOREMAN' ? 'var(--warning-core)' : 'var(--info-core)'
                      }}
                    >
                      {worker.userRole}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--text-secondary)' }}>
                    {worker.jobsCount}
                  </td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--text-secondary)' }}>
                    {worker.totalFootage.toLocaleString()} ft
                  </td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--success-core)' }}>
                    ${worker.totalAmount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getStatusBadge(worker.status)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      {worker.status === 'pending' && (
                        <button
                          onClick={() => handleApprove(worker)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-blue-50"
                          title="Approve"
                        >
                          <Check className="w-4 h-4" style={{ color: 'var(--info-core)' }} />
                        </button>
                      )}
                      {worker.status === 'approved' && (
                        <button
                          onClick={() => handleMarkPaid(worker)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-green-50"
                          title="Mark Paid"
                        >
                          <DollarSign className="w-4 h-4" style={{ color: 'var(--success-core)' }} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredWorkers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>
                    No workers found for this week
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Investors Table */
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          <table className="w-full">
            <thead>
              <tr style={{ background: 'var(--elevated)' }}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>Investor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>Equipment</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>Type</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>Jobs</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>Footage</th>
                <th className="text-right px-4 py-3 text-xs font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>Returns</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase" style={{ color: 'var(--text-tertiary)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvestors.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-t transition-colors hover:bg-gray-50"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{inv.investorName}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {inv.investorType === 'truck' ? (
                        <Truck className="w-4 h-4" style={{ color: 'var(--neural-core)' }} />
                      ) : (
                        <HardHat className="w-4 h-4" style={{ color: 'var(--warning-core)' }} />
                      )}
                      <span style={{ color: 'var(--text-secondary)' }}>{inv.equipmentLabel}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium capitalize"
                      style={{
                        background: inv.investorType === 'truck' ? 'var(--neural-dim)' : 'var(--warning-dim)',
                        color: inv.investorType === 'truck' ? 'var(--neural-core)' : 'var(--warning-core)'
                      }}
                    >
                      {inv.investorType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--text-secondary)' }}>
                    {inv.jobsCount}
                  </td>
                  <td className="px-4 py-3 text-right" style={{ color: 'var(--text-secondary)' }}>
                    {inv.totalFootage.toLocaleString()} ft
                  </td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--warning-core)' }}>
                    ${inv.totalReturns.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getStatusBadge(inv.status)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      {inv.status !== 'paid' && (
                        <button
                          onClick={() => handleMarkInvestorPaid(inv)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-green-50"
                          title="Mark Paid"
                        >
                          <DollarSign className="w-4 h-4" style={{ color: 'var(--success-core)' }} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredInvestors.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>
                    No investor returns found for this week
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PayrollAdmin;
