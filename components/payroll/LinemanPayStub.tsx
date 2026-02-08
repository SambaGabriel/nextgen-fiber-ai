/**
 * Lineman Pay Stub Component
 * Shows lineman earnings for a pay period
 */

import React, { useState, useEffect, useCallback } from 'react';
import { DollarSign, Calendar, Briefcase, ChevronDown, ChevronUp, Download, Check, Clock, AlertCircle } from 'lucide-react';
import { getUserPayrollHistory, getPayWeekLabel } from '../../services/payrollService';
import type { PayrollRecord, PayrollBreakdown } from '../../types/payroll';
import type { User } from '../../types';

interface Props {
  user: User | null;
}

const LinemanPayStub: React.FC<Props> = ({ user }) => {
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadPayroll = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const data = await getUserPayrollHistory(user.id, 12);
      setRecords(data);
    } catch (error) {
      console.error('[LinemanPayStub] Error loading payroll:', error);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    loadPayroll();
  }, [loadPayroll]);

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
  const ytdTotals = records.reduce((acc, r) => ({
    amount: acc.amount + r.totalAmount,
    jobs: acc.jobs + r.jobsCount,
    footage: acc.footage + r.totalFootage
  }), { amount: 0, jobs: 0, footage: 0 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          My Pay Stubs
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
          View your earnings history and pay details
        </p>
      </div>

      {/* YTD Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--success-dim)' }}>
              <DollarSign className="w-5 h-5" style={{ color: 'var(--success-core)' }} />
            </div>
            <span className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>YTD Earnings</span>
          </div>
          <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            ${ytdTotals.amount.toLocaleString()}
          </p>
        </div>

        <div className="p-5 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--neural-dim)' }}>
              <Briefcase className="w-5 h-5" style={{ color: 'var(--neural-core)' }} />
            </div>
            <span className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>Jobs Completed</span>
          </div>
          <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {ytdTotals.jobs}
          </p>
        </div>

        <div className="p-5 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--info-dim)' }}>
              <Calendar className="w-5 h-5" style={{ color: 'var(--info-core)' }} />
            </div>
            <span className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>Total Footage</span>
          </div>
          <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {ytdTotals.footage.toLocaleString()} ft
          </p>
        </div>
      </div>

      {/* Pay Stubs List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 rounded-full" style={{ borderColor: 'var(--neural-core)', borderTopColor: 'transparent' }} />
        </div>
      ) : records.length === 0 ? (
        <div className="py-12 text-center rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          <DollarSign className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-ghost)' }} />
          <p style={{ color: 'var(--text-tertiary)' }}>No pay stubs yet</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-ghost)' }}>
            Complete jobs to see your earnings here
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map(record => {
            const status = getStatusStyle(record.status);
            const StatusIcon = status.icon;
            const isExpanded = expandedId === record.id;

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
                      <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {getPayWeekLabel(record.payPeriodId?.split('_')[0] || '')}
                      </p>
                      <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                        {record.jobsCount} jobs · {record.totalFootage.toLocaleString()} ft
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
                {isExpanded && record.breakdown && (
                  <div className="px-5 pb-5 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="pt-4">
                      <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
                        Earnings by Job
                      </h4>
                      <div className="space-y-2">
                        {record.breakdown.byJob.map((job, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between py-2 px-3 rounded-lg"
                            style={{ background: 'var(--elevated)' }}
                          >
                            <div>
                              <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                                {job.jobCode}
                              </p>
                              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                {job.clientName} · {job.footage.toLocaleString()} ft
                              </p>
                            </div>
                            <p className="font-semibold" style={{ color: 'var(--success-core)' }}>
                              ${job.amount.toLocaleString()}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Work Type Breakdown */}
                      {record.breakdown.byWorkType && record.breakdown.byWorkType.length > 0 && (
                        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                          <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
                            By Work Type
                          </h4>
                          <div className="flex gap-3">
                            {record.breakdown.byWorkType.map((wt, i) => (
                              <div
                                key={i}
                                className="flex-1 p-3 rounded-lg text-center"
                                style={{ background: 'var(--elevated)' }}
                              >
                                <p className="text-xs font-medium uppercase" style={{ color: 'var(--text-tertiary)' }}>
                                  {wt.type}
                                </p>
                                <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
                                  ${wt.amount.toLocaleString()}
                                </p>
                                <p className="text-xs" style={{ color: 'var(--text-ghost)' }}>
                                  {wt.percentage.toFixed(0)}%
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

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

export default LinemanPayStub;
