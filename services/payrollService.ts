/**
 * Payroll Service
 * Manages pay periods, payroll calculations, and investor returns
 */

import { supabase } from './supabase';
import type {
  PayPeriod,
  PayPeriodSummary,
  PayrollRecord,
  PayrollBreakdown,
  InvestorReturn,
  WeeklyPayrollSummary,
  ForemanPayDetails,
  UndergroundDailyEntry,
  FOREMAN_PAY_RATES
} from '../types/payroll';

// ===== PAY PERIOD HELPERS =====

/**
 * Get the Monday (week key) for a given date
 */
export function getPayWeekKey(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

/**
 * Get human-readable label for a week key
 */
export function getPayWeekLabel(weekKey: string): string {
  const monday = new Date(weekKey);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);

  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  return `${formatter.format(monday)} - ${formatter.format(sunday)}`;
}

/**
 * Get expected pay date for a week (1 month after week end)
 */
export function getPayDate(weekKey: string): Date {
  const monday = new Date(weekKey);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const payDate = new Date(sunday);
  payDate.setMonth(payDate.getMonth() + 1);
  return payDate;
}

// ===== PAY PERIOD CRUD =====

/**
 * Get or create a pay period for a date
 */
export async function getOrCreatePayPeriod(date: Date): Promise<PayPeriod> {
  const weekKey = getPayWeekKey(date);

  // Try to find existing
  const { data: existing } = await supabase
    .from('pay_periods')
    .select('*')
    .eq('week_key', weekKey)
    .single();

  if (existing) {
    return {
      id: existing.id,
      weekKey: existing.week_key,
      weekNumber: existing.week_number,
      weekStart: existing.week_start,
      weekEnd: existing.week_end,
      payDate: existing.pay_date,
      status: existing.status,
      notes: existing.notes,
      createdAt: existing.created_at,
      updatedAt: existing.updated_at
    };
  }

  // Create new
  const monday = new Date(weekKey);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const payDate = getPayDate(weekKey);
  const weekNumber = getWeekNumber(monday);

  const { data, error } = await supabase
    .from('pay_periods')
    .insert({
      week_key: weekKey,
      week_number: weekNumber,
      week_start: weekKey,
      week_end: sunday.toISOString().split('T')[0],
      pay_date: payDate.toISOString().split('T')[0]
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: data.id,
    weekKey: data.week_key,
    weekNumber: data.week_number,
    weekStart: data.week_start,
    weekEnd: data.week_end,
    payDate: data.pay_date,
    status: data.status,
    createdAt: data.created_at
  };
}

function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

/**
 * Get recent payable weeks
 */
export async function getPayableWeeks(count: number = 8): Promise<PayPeriodSummary[]> {
  const { data, error } = await supabase.rpc('get_payable_weeks', { num_weeks: count });

  if (error) {
    console.error('[PayrollService] Error fetching payable weeks:', error);
    return [];
  }

  // Get summary data for each period
  const periods: PayPeriodSummary[] = [];

  for (const row of data || []) {
    // Get payroll records for this period
    const { data: records } = await supabase
      .from('payroll_records')
      .select('status, total_amount')
      .eq('pay_period_id', row.period_id);

    // Get investor returns for this period
    const { data: returns } = await supabase
      .from('investor_returns')
      .select('status, total_returns')
      .eq('pay_period_id', row.period_id);

    const totalPayroll = (records || []).reduce((sum, r) => sum + Number(r.total_amount), 0);
    const totalInvestorReturns = (returns || []).reduce((sum, r) => sum + Number(r.total_returns), 0);
    const pendingCount = (records || []).filter(r => r.status === 'pending').length;
    const approvedCount = (records || []).filter(r => r.status === 'approved').length;
    const paidCount = (records || []).filter(r => r.status === 'paid').length;

    periods.push({
      id: row.period_id,
      weekKey: row.week_key,
      weekNumber: row.week_number,
      weekStart: row.week_start,
      weekEnd: row.week_end,
      payDate: row.pay_date,
      status: row.status,
      createdAt: row.week_start,
      totalPayroll,
      totalInvestorReturns,
      recordsCount: (records || []).length,
      pendingCount,
      approvedCount,
      paidCount
    });
  }

  return periods;
}

// ===== PAYROLL CALCULATIONS =====

/**
 * Calculate lineman payroll for a week
 */
export async function calculateLinemanPayroll(
  userId: string,
  weekKey: string
): Promise<PayrollRecord | null> {
  const period = await getOrCreatePayPeriod(new Date(weekKey));

  // Get completed jobs for this user in this week
  const { data: jobs } = await supabase
    .from('jobs')
    .select(`
      id,
      job_code,
      client_name,
      customer_name,
      department,
      production_data
    `)
    .eq('assigned_to_id', userId)
    .gte('production_data->completedDate', period.weekStart)
    .lte('production_data->completedDate', period.weekEnd)
    .in('status', ['production_submitted', 'approved', 'completed']);

  if (!jobs || jobs.length === 0) {
    return null;
  }

  // Get calculations for these jobs
  const jobIds = jobs.map(j => j.id);
  const { data: calculations } = await supabase
    .from('calculated_totals')
    .select('*')
    .in('job_id', jobIds);

  // Build breakdown
  const breakdown: PayrollBreakdown = {
    byJob: [],
    byWorkType: []
  };

  let totalAmount = 0;
  let totalFootage = 0;
  let aerialAmount = 0;
  let undergroundAmount = 0;

  for (const job of jobs) {
    const calc = calculations?.find(c => c.job_id === job.id);
    const amount = calc ? Number(calc.lineman_total) : 0;
    const footage = job.production_data?.totalFootage || 0;

    breakdown.byJob.push({
      jobId: job.id,
      jobCode: job.job_code,
      clientName: job.client_name,
      customerName: job.customer_name || '',
      footage,
      amount,
      completedDate: job.production_data?.completedDate || ''
    });

    totalAmount += amount;
    totalFootage += footage;

    if (job.department === 'underground') {
      undergroundAmount += amount;
    } else {
      aerialAmount += amount;
    }
  }

  if (totalAmount > 0) {
    breakdown.byWorkType = [
      { type: 'aerial' as const, amount: aerialAmount, percentage: (aerialAmount / totalAmount) * 100, footage: 0 },
      { type: 'underground' as const, amount: undergroundAmount, percentage: (undergroundAmount / totalAmount) * 100, footage: 0 }
    ].filter(w => w.amount > 0);
  }

  // Get user name
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', userId)
    .single();

  // Upsert payroll record
  const { data: record, error } = await supabase
    .from('payroll_records')
    .upsert({
      pay_period_id: period.id,
      user_id: userId,
      user_name: profile?.name || 'Unknown',
      user_role: profile?.role || 'LINEMAN',
      total_amount: Math.round(totalAmount * 100) / 100,
      jobs_count: jobs.length,
      total_footage: totalFootage,
      breakdown,
      status: 'pending'
    }, {
      onConflict: 'pay_period_id,user_id'
    })
    .select()
    .single();

  if (error) {
    console.error('[PayrollService] Error saving payroll:', error);
    return null;
  }

  return {
    id: record.id,
    payPeriodId: record.pay_period_id,
    userId: record.user_id,
    userName: record.user_name,
    userRole: record.user_role,
    totalAmount: record.total_amount,
    jobsCount: record.jobs_count,
    totalFootage: record.total_footage,
    breakdown: record.breakdown,
    status: record.status,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}

/**
 * Calculate foreman payroll for a week
 * Foreman uses day rate + conduit + bonus, NOT rate cards
 */
export async function calculateForemanPayroll(
  userId: string,
  weekKey: string
): Promise<PayrollRecord | null> {
  const period = await getOrCreatePayPeriod(new Date(weekKey));

  // Get daily entries for this foreman in this week
  const { data: entries } = await supabase
    .from('underground_daily_entries')
    .select('*')
    .eq('created_by', userId)
    .gte('entry_date', period.weekStart)
    .lte('entry_date', period.weekEnd);

  if (!entries || entries.length === 0) {
    return null;
  }

  // Calculate foreman pay details
  const foremanDetails = calculateForemanPay(entries);

  // Get related jobs
  const jobIds = [...new Set(entries.map(e => e.job_id))];
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, job_code, client_name, customer_name')
    .in('id', jobIds);

  // Build breakdown
  const breakdown: PayrollBreakdown = {
    byJob: (jobs || []).map(job => {
      const jobEntries = entries.filter(e => e.job_id === job.id);
      const footage = jobEntries.reduce((sum, e) => sum + (e.conduit_feet || 0), 0);
      return {
        jobId: job.id,
        jobCode: job.job_code,
        clientName: job.client_name,
        customerName: job.customer_name || '',
        footage,
        amount: 0, // Foreman pay is not per-job
        completedDate: ''
      };
    }),
    byWorkType: [{ type: 'underground', amount: foremanDetails.totalPay, percentage: 100, footage: foremanDetails.conduitFeet }],
    foremanDetails
  };

  // Get user name
  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', userId)
    .single();

  // Upsert payroll record
  const { data: record, error } = await supabase
    .from('payroll_records')
    .upsert({
      pay_period_id: period.id,
      user_id: userId,
      user_name: profile?.name || 'Unknown',
      user_role: 'FOREMAN',
      total_amount: foremanDetails.totalPay,
      jobs_count: jobIds.length,
      total_footage: foremanDetails.conduitFeet,
      breakdown,
      status: 'pending'
    }, {
      onConflict: 'pay_period_id,user_id'
    })
    .select()
    .single();

  if (error) {
    console.error('[PayrollService] Error saving foreman payroll:', error);
    return null;
  }

  return {
    id: record.id,
    payPeriodId: record.pay_period_id,
    userId: record.user_id,
    userName: record.user_name,
    userRole: record.user_role,
    totalAmount: record.total_amount,
    jobsCount: record.jobs_count,
    totalFootage: record.total_footage,
    breakdown: record.breakdown,
    status: record.status,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}

/**
 * Calculate foreman pay from daily entries
 */
export function calculateForemanPay(entries: any[]): ForemanPayDetails {
  const RATES = {
    fullDay: 300,
    halfDay: 150,
    conduitLte500: 0.25,
    conduitGt500: 0.30,
    weeklyBonusThreshold: 4000,
    weeklyBonus: 300
  };

  let fullDays = 0;
  let halfDays = 0;
  let conduitFeet = 0;

  for (const entry of entries) {
    if (entry.is_full_day) fullDays++;
    if (entry.is_half_day) halfDays++;
    conduitFeet += entry.conduit_feet || 0;
  }

  // Calculate conduit pay
  let conduitPay = 0;
  let conduitRate = RATES.conduitLte500;

  if (conduitFeet <= 500) {
    conduitPay = conduitFeet * RATES.conduitLte500;
    conduitRate = RATES.conduitLte500;
  } else {
    conduitPay = (500 * RATES.conduitLte500) + ((conduitFeet - 500) * RATES.conduitGt500);
    conduitRate = RATES.conduitGt500;
  }

  const dayPay = (fullDays * RATES.fullDay) + (halfDays * RATES.halfDay);
  const weeklyBonus = conduitFeet >= RATES.weeklyBonusThreshold;
  const bonusPay = weeklyBonus ? RATES.weeklyBonus : 0;
  const totalPay = Math.round((dayPay + conduitPay + bonusPay) * 100) / 100;

  return {
    fullDays,
    halfDays,
    conduitFeet,
    conduitRate,
    weeklyBonus,
    bonusThreshold: RATES.weeklyBonusThreshold,
    dayPay,
    conduitPay: Math.round(conduitPay * 100) / 100,
    bonusPay,
    totalPay
  };
}

// ===== INVESTOR RETURNS =====

/**
 * Calculate investor returns for a week
 */
export async function calculateInvestorReturns(
  investorId: string,
  weekKey: string
): Promise<InvestorReturn[]> {
  const period = await getOrCreatePayPeriod(new Date(weekKey));

  // Get trucks owned by this investor
  const { data: trucks } = await supabase
    .from('trucks')
    .select('id, truck_number')
    .eq('investor_id', investorId)
    .eq('is_active', true);

  // Get drills owned by this investor
  const { data: drills } = await supabase
    .from('drills')
    .select('id, label')
    .eq('investor_id', investorId)
    .eq('is_active', true);

  const returns: InvestorReturn[] = [];

  // Calculate truck returns
  for (const truck of trucks || []) {
    const truckReturn = await calculateEquipmentReturns(
      period,
      investorId,
      'truck',
      truck.id,
      truck.truck_number
    );
    if (truckReturn) returns.push(truckReturn);
  }

  // Calculate drill returns
  for (const drill of drills || []) {
    const drillReturn = await calculateEquipmentReturns(
      period,
      investorId,
      'drill',
      drill.id,
      drill.label
    );
    if (drillReturn) returns.push(drillReturn);
  }

  return returns;
}

async function calculateEquipmentReturns(
  period: PayPeriod,
  investorId: string,
  investorType: 'truck' | 'drill',
  equipmentId: string,
  equipmentLabel: string
): Promise<InvestorReturn | null> {
  const equipmentField = investorType === 'truck' ? 'assigned_truck_id' : 'assigned_drill_id';

  // Get jobs with this equipment in this week
  const { data: jobs } = await supabase
    .from('jobs')
    .select(`
      id,
      job_code,
      client_name,
      customer_name,
      production_data
    `)
    .eq(equipmentField, equipmentId)
    .gte('production_data->completedDate', period.weekStart)
    .lte('production_data->completedDate', period.weekEnd)
    .in('status', ['production_submitted', 'approved', 'completed']);

  if (!jobs || jobs.length === 0) {
    return null;
  }

  // Get calculations
  const jobIds = jobs.map(j => j.id);
  const { data: calculations } = await supabase
    .from('calculated_totals')
    .select('*')
    .in('job_id', jobIds);

  // Build breakdown
  let totalReturns = 0;
  let totalFootage = 0;
  const byJob = [];

  for (const job of jobs) {
    const calc = calculations?.find(c => c.job_id === job.id);
    const amount = calc ? Number(calc.truck_investor_total) : 0;
    const footage = job.production_data?.totalFootage || 0;

    byJob.push({
      jobId: job.id,
      jobCode: job.job_code,
      clientName: job.client_name,
      customerName: job.customer_name || '',
      footage,
      rate: footage > 0 ? amount / footage : 0,
      amount,
      completedDate: job.production_data?.completedDate || ''
    });

    totalReturns += amount;
    totalFootage += footage;
  }

  // Get investor name
  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', investorId)
    .single();

  // Upsert investor return
  const { data: record, error } = await supabase
    .from('investor_returns')
    .upsert({
      pay_period_id: period.id,
      investor_id: investorId,
      investor_name: profile?.name || 'Unknown',
      investor_type: investorType,
      equipment_id: equipmentId,
      equipment_label: equipmentLabel,
      total_returns: Math.round(totalReturns * 100) / 100,
      jobs_count: jobs.length,
      total_footage: totalFootage,
      breakdown: { byJob },
      status: 'pending'
    }, {
      onConflict: 'pay_period_id,investor_id,equipment_id'
    })
    .select()
    .single();

  if (error) {
    console.error('[PayrollService] Error saving investor return:', error);
    return null;
  }

  return {
    id: record.id,
    payPeriodId: record.pay_period_id,
    investorId: record.investor_id,
    investorName: record.investor_name,
    investorType: record.investor_type,
    equipmentId: record.equipment_id,
    equipmentLabel: record.equipment_label,
    totalReturns: record.total_returns,
    jobsCount: record.jobs_count,
    totalFootage: record.total_footage,
    breakdown: record.breakdown,
    status: record.status,
    createdAt: record.created_at,
    updatedAt: record.updated_at
  };
}

// ===== ADMIN FUNCTIONS =====

/**
 * Get weekly payroll summary
 */
export async function getWeeklyPayroll(weekKey: string): Promise<WeeklyPayrollSummary | null> {
  const period = await getOrCreatePayPeriod(new Date(weekKey));

  // Get all payroll records
  const { data: records } = await supabase
    .from('payroll_records')
    .select('*')
    .eq('pay_period_id', period.id)
    .order('user_name');

  // Get all investor returns
  const { data: returns } = await supabase
    .from('investor_returns')
    .select('*')
    .eq('pay_period_id', period.id)
    .order('investor_name');

  const workers = (records || []).map(r => ({
    id: r.id,
    payPeriodId: r.pay_period_id,
    userId: r.user_id,
    userName: r.user_name,
    userRole: r.user_role,
    totalAmount: r.total_amount,
    jobsCount: r.jobs_count,
    totalFootage: r.total_footage,
    breakdown: r.breakdown,
    status: r.status,
    approvedAt: r.approved_at,
    approvedBy: r.approved_by,
    paidAt: r.paid_at,
    paidBy: r.paid_by,
    paymentReference: r.payment_reference,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));

  const investors = (returns || []).map(r => ({
    id: r.id,
    payPeriodId: r.pay_period_id,
    investorId: r.investor_id,
    investorName: r.investor_name,
    investorType: r.investor_type,
    equipmentId: r.equipment_id,
    equipmentLabel: r.equipment_label,
    totalReturns: r.total_returns,
    jobsCount: r.jobs_count,
    totalFootage: r.total_footage,
    breakdown: r.breakdown,
    status: r.status,
    paidAt: r.paid_at,
    paidBy: r.paid_by,
    paymentReference: r.payment_reference,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));

  const workerPayTotal = workers.reduce((sum, w) => sum + w.totalAmount, 0);
  const investorReturnTotal = investors.reduce((sum, i) => sum + i.totalReturns, 0);

  return {
    payPeriod: period,
    workers,
    investors,
    totals: {
      workerPayTotal,
      investorReturnTotal,
      grandTotal: workerPayTotal + investorReturnTotal,
      pendingCount: workers.filter(w => w.status === 'pending').length,
      approvedCount: workers.filter(w => w.status === 'approved').length,
      paidCount: workers.filter(w => w.status === 'paid').length
    }
  };
}

/**
 * Mark payroll record as paid
 */
export async function markPayrollAsPaid(
  recordId: string,
  paidBy: string,
  paymentReference?: string
): Promise<void> {
  const { error } = await supabase
    .from('payroll_records')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      paid_by: paidBy,
      payment_reference: paymentReference
    })
    .eq('id', recordId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Mark investor return as paid
 */
export async function markInvestorReturnAsPaid(
  returnId: string,
  paidBy: string,
  paymentReference?: string
): Promise<void> {
  const { error } = await supabase
    .from('investor_returns')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      paid_by: paidBy,
      payment_reference: paymentReference
    })
    .eq('id', returnId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Approve payroll record
 */
export async function approvePayroll(recordId: string, approvedBy: string): Promise<void> {
  const { error } = await supabase
    .from('payroll_records')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: approvedBy
    })
    .eq('id', recordId);

  if (error) {
    throw new Error(error.message);
  }
}

// ===== USER PAYROLL VIEWS =====

/**
 * Get payroll history for a user
 */
export async function getUserPayrollHistory(userId: string, limit: number = 12): Promise<PayrollRecord[]> {
  const { data, error } = await supabase
    .from('payroll_records')
    .select(`
      *,
      pay_period:pay_period_id (*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[PayrollService] Error fetching user payroll:', error);
    return [];
  }

  return (data || []).map(r => ({
    id: r.id,
    payPeriodId: r.pay_period_id,
    userId: r.user_id,
    userName: r.user_name,
    userRole: r.user_role,
    totalAmount: r.total_amount,
    jobsCount: r.jobs_count,
    totalFootage: r.total_footage,
    breakdown: r.breakdown,
    status: r.status,
    approvedAt: r.approved_at,
    paidAt: r.paid_at,
    paymentReference: r.payment_reference,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
}

/**
 * Get investor return history
 */
export async function getInvestorReturnHistory(investorId: string, limit: number = 12): Promise<InvestorReturn[]> {
  const { data, error } = await supabase
    .from('investor_returns')
    .select(`
      *,
      pay_period:pay_period_id (*)
    `)
    .eq('investor_id', investorId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[PayrollService] Error fetching investor returns:', error);
    return [];
  }

  return (data || []).map(r => ({
    id: r.id,
    payPeriodId: r.pay_period_id,
    investorId: r.investor_id,
    investorName: r.investor_name,
    investorType: r.investor_type,
    equipmentId: r.equipment_id,
    equipmentLabel: r.equipment_label,
    totalReturns: r.total_returns,
    jobsCount: r.jobs_count,
    totalFootage: r.total_footage,
    breakdown: r.breakdown,
    status: r.status,
    paidAt: r.paid_at,
    paymentReference: r.payment_reference,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
}
