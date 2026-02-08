/**
 * Foreman Pay Stub Component
 * Shows foreman earnings with day rate, conduit pay, and bonus details
 */

import React, { useState, useEffect, useCallback } from 'react';
import { DollarSign, Calendar, HardHat, ChevronDown, ChevronUp, Check, Clock, AlertCircle, Award, Ruler } from 'lucide-react';
import { getUserPayrollHistory, getPayWeekLabel } from '../../services/payrollService';
import { getForemanBonusProgress } from '../../services/undergroundCalculationService';
import type { PayrollRecord, ForemanPayDetails } from '../../types/payroll';
import type { User } from '../../types';

interface Props {
  user: User | null;
}

const ForemanPayStub: React.FC<Props> = ({ user }) => {
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [bonusProgress, setBonusProgress] = useState<{
    currentFootage: number;
    targetFootage: number;
    percentComplete: number;
    isEligible: boolean;
    bonusAmount: number;
  } | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const [payrollData, progressData] = await Promise.all([
        getUserPayrollHistory(user.id, 12),
        getForemanBonusProgress(user.id)
      ]);
      setRecords(payrollData);
      setBonusProgress(progressData);
    } catch (error) {
      console.error('[ForemanPayStub] Error loading data:', error);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Get status styling
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'paid':
        return { bg: 'var(--success-dim)', color: 'var(--success-core)', icon: Check, label: 'Paid' };
      case 'approved':
        return { bg: 'var(--info-dim)', color: 'var(--info-core)', icon: Clock, label: 'Processing' };
      case 'disputed':
        return { bg: 'var(--critical-dim)', color: 'var(--critical-core)', icon: AlertCircle, label: 'Disputed' };
      default:
        return { bg: 'var(--warning-dim)', color: 'var(--warning-core)', icon: Clock, label: 'Pending' };
    }
  };

  // Calculate YTD totals
  const ytdTotals = records.reduce((acc, r) => {
    const foreman = r.breakdown?.foremanDetails;
    return {
      amount: acc.amount + r.totalAmount,
      days: acc.days + (foreman?.fullDays || 0) + (foreman?.halfDays || 0) * 0.5,
      footage: acc.footage + r.totalFootage,
      bonuses: acc.bonuses + (foreman?.weeklyBonus ? 1 : 0)
    };
  }, { amount: 0, days: 0, footage: 0, bonuses: 0 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          My Pay Stubs
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
          View your foreman earnings - day rate, conduit, and bonuses
        </p>
      </div>

      {/* Weekly Bonus Progress */}
      {bonusProgress && (
        <div
          className="p-5 rounded-2xl"
          style={{
            background: bonusProgress.isEligible ? 'var(--success-dim)' : 'var(--surface)',
            border: `2px solid ${bonusProgress.isEligible ? 'var(--success-core)' : 'var(--border-default)'}`
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: bonusProgress.isEligible ? 'var(--success-core)' : 'var(--warning-dim)' }}
              >
                <Award className="w-6 h-6" style={{ color: bonusProgress.isEligible ? 'white' : 'var(--warning-core)' }} />
              </div>
              <div>
                <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>
                  {bonusProgress.isEligible ? 'Bonus Earned!' : 'Weekly Bonus Progress'}
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  {bonusProgress.isEligible
                    ? `You've earned the $${bonusProgress.bonusAmount} weekly bonus!`
                    : `${(bonusProgress.targetFootage - bonusProgress.currentFootage).toLocaleString()} ft to go`
                  }
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold" style={{ color: bonusProgress.isEligible ? 'var(--success-core)' : 'var(--text-primary)' }}>
                {bonusProgress.currentFootage.toLocaleString()} ft
              </p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                / {bonusProgress.targetFootage.toLocaleString()} ft
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--elevated)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(bonusProgress.percentComplete, 100)}%`,
                background: bonusProgress.isEligible ? 'var(--success-core)' : 'var(--warning-core)'
              }}
            />
          </div>
        </div>
      )}

      {/* YTD Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--success-dim)' }}>
              <DollarSign className="w-5 h-5" style={{ color: 'var(--success-core)' }} />
            </div>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            ${ytdTotals.amount.toLocaleString()}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>YTD Earnings</p>
        </div>

        <div className="p-5 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--warning-dim)' }}>
              <Calendar className="w-5 h-5" style={{ color: 'var(--warning-core)' }} />
            </div>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {ytdTotals.days}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Days Worked</p>
        </div>

        <div className="p-5 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--info-dim)' }}>
              <Ruler className="w-5 h-5" style={{ color: 'var(--info-core)' }} />
            </div>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {ytdTotals.footage.toLocaleString()}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Total Feet</p>
        </div>

        <div className="p-5 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--neural-dim)' }}>
              <Award className="w-5 h-5" style={{ color: 'var(--neural-core)' }} />
            </div>
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {ytdTotals.bonuses}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Bonuses Earned</p>
        </div>
      </div>

      {/* Pay Stubs List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 rounded-full" style={{ borderColor: 'var(--neural-core)', borderTopColor: 'transparent' }} />
        </div>
      ) : records.length === 0 ? (
        <div className="py-12 text-center rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          <HardHat className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-ghost)' }} />
          <p style={{ color: 'var(--text-tertiary)' }}>No pay stubs yet</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-ghost)' }}>
            Submit daily entries to see your earnings
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map(record => {
            const status = getStatusStyle(record.status);
            const StatusIcon = status.icon;
            const isExpanded = expandedId === record.id;
            const foreman = record.breakdown?.foremanDetails;

            return (
              <div
                key={record.id}
                className="rounded-2xl overflow-hidden"
                style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
              >
                {/* Summary Row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : record.id)}
                  className="w-full flex items-center justify-between p-5 text-left"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ background: status.bg }}
                    >
                      <StatusIcon className="w-6 h-6" style={{ color: status.color }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                          Week of {new Date(record.createdAt).toLocaleDateString()}
                        </p>
                        {foreman?.weeklyBonus && (
                          <Award className="w-4 h-4" style={{ color: 'var(--warning-core)' }} />
                        )}
                      </div>
                      <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                        {foreman ? `${foreman.fullDays} full + ${foreman.halfDays} half days` : `${record.jobsCount} jobs`} · {record.totalFootage.toLocaleString()} ft
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xl font-bold" style={{ color: 'var(--success-core)' }}>
                        ${record.totalAmount.toLocaleString()}
                      </p>
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ background: status.bg, color: status.color }}
                      >
                        {status.label}
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                    ) : (
                      <ChevronDown className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                    )}
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && foreman && (
                  <div className="px-5 pb-5 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="pt-4">
                      <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
                        Pay Breakdown
                      </h4>

                      {/* Pay Components */}
                      <div className="space-y-2">
                        {/* Day Pay */}
                        <div
                          className="flex items-center justify-between py-3 px-4 rounded-xl"
                          style={{ background: 'var(--elevated)' }}
                        >
                          <div className="flex items-center gap-3">
                            <Calendar className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                            <div>
                              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Day Rate</p>
                              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                {foreman.fullDays} full ($300) + {foreman.halfDays} half ($150)
                              </p>
                            </div>
                          </div>
                          <p className="font-bold" style={{ color: 'var(--success-core)' }}>
                            ${foreman.dayPay.toLocaleString()}
                          </p>
                        </div>

                        {/* Conduit Pay */}
                        <div
                          className="flex items-center justify-between py-3 px-4 rounded-xl"
                          style={{ background: 'var(--elevated)' }}
                        >
                          <div className="flex items-center gap-3">
                            <Ruler className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                            <div>
                              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Conduit Pay</p>
                              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                {foreman.conduitFeet.toLocaleString()} ft @ ${foreman.conduitRate}/ft
                              </p>
                            </div>
                          </div>
                          <p className="font-bold" style={{ color: 'var(--success-core)' }}>
                            ${foreman.conduitPay.toLocaleString()}
                          </p>
                        </div>

                        {/* Weekly Bonus */}
                        <div
                          className="flex items-center justify-between py-3 px-4 rounded-xl"
                          style={{
                            background: foreman.weeklyBonus ? 'var(--success-dim)' : 'var(--elevated)'
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <Award className="w-5 h-5" style={{ color: foreman.weeklyBonus ? 'var(--success-core)' : 'var(--text-tertiary)' }} />
                            <div>
                              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Weekly Bonus</p>
                              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                {foreman.weeklyBonus
                                  ? `Earned! (${foreman.conduitFeet.toLocaleString()} / ${foreman.bonusThreshold.toLocaleString()} ft)`
                                  : `Need ${(foreman.bonusThreshold - foreman.conduitFeet).toLocaleString()} more ft`
                                }
                              </p>
                            </div>
                          </div>
                          <p className="font-bold" style={{ color: foreman.weeklyBonus ? 'var(--success-core)' : 'var(--text-ghost)' }}>
                            ${foreman.bonusPay.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Total */}
                      <div
                        className="flex items-center justify-between py-4 px-4 mt-4 rounded-xl"
                        style={{ background: 'var(--neural-dim)', border: '1px solid var(--neural-core)' }}
                      >
                        <p className="font-bold" style={{ color: 'var(--text-primary)' }}>Total Earnings</p>
                        <p className="text-2xl font-bold" style={{ color: 'var(--neural-core)' }}>
                          ${foreman.totalPay.toLocaleString()}
                        </p>
                      </div>

                      {/* Payment Reference */}
                      {record.paymentReference && (
                        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                            Payment Reference: <span className="font-mono">{record.paymentReference}</span>
                          </p>
                          {record.paidAt && (
                            <p className="text-xs mt-1" style={{ color: 'var(--text-ghost)' }}>
                              Paid on {new Date(record.paidAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ForemanPayStub;
