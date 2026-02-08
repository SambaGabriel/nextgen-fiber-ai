/**
 * Underground Calculation Service
 * Handles calculations specific to underground/boring work
 *
 * Key Differences from Aerial:
 * 1. Foreman pay is DAY RATE + CONDUIT, not per-footage rate card
 * 2. Ground type affects company revenue rate (Normal/Cobble/Rock)
 * 3. Drill investors get per-footage commission
 */

import { supabase } from './supabase';
import type { GroundType } from '../types/equipment';
import type { ForemanPayDetails, UndergroundDailyEntry } from '../types/payroll';

// ===== CONSTANTS =====

// Foreman pay rates (NOT from rate cards - fixed structure)
export const FOREMAN_PAY = {
  fullDay: 300,           // Full day rate
  halfDay: 150,           // Half day rate
  conduitLte500: 0.25,    // Per foot for first 500 feet
  conduitGt500: 0.30,     // Per foot for feet above 500
  weeklyBonusThreshold: 4000,  // Weekly feet threshold for bonus
  weeklyBonus: 300        // Bonus amount if threshold met
} as const;

// Ground type rate codes for rate card lookup
export const GROUND_TYPE_CODES: Record<GroundType, string> = {
  'Normal': 'DBI',
  'Cobble': 'DBIC',
  'Rock': 'DBIR'
};

// Typical rates (for display/estimation only - actual from rate cards)
export const TYPICAL_GROUND_RATES = {
  Normal: { nextgen: 7.80, investor: 0.10 },
  Cobble: { nextgen: 13.00, investor: 0.15 },
  Rock: { nextgen: 58.00, investor: 0.50 }
} as const;

// ===== DAILY ENTRY MANAGEMENT =====

/**
 * Create a new underground daily entry
 */
export async function createDailyEntry(
  entry: Omit<UndergroundDailyEntry, 'id' | 'createdAt' | 'updatedAt'>
): Promise<UndergroundDailyEntry> {
  const { data, error } = await supabase
    .from('underground_daily_entries')
    .insert({
      job_id: entry.jobId,
      entry_date: entry.entryDate,
      is_full_day: entry.isFullDay,
      is_half_day: entry.isHalfDay,
      conduit_feet: entry.conduitFeet,
      ground_type: entry.groundType,
      notes: entry.notes,
      created_by: entry.createdBy
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: data.id,
    jobId: data.job_id,
    entryDate: data.entry_date,
    isFullDay: data.is_full_day,
    isHalfDay: data.is_half_day,
    conduitFeet: data.conduit_feet,
    groundType: data.ground_type,
    notes: data.notes,
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

/**
 * Get daily entries for a job
 */
export async function getJobDailyEntries(jobId: string): Promise<UndergroundDailyEntry[]> {
  const { data, error } = await supabase
    .from('underground_daily_entries')
    .select('*')
    .eq('job_id', jobId)
    .order('entry_date', { ascending: false });

  if (error) {
    console.error('[UndergroundCalc] Error fetching entries:', error);
    return [];
  }

  return (data || []).map(d => ({
    id: d.id,
    jobId: d.job_id,
    entryDate: d.entry_date,
    isFullDay: d.is_full_day,
    isHalfDay: d.is_half_day,
    conduitFeet: d.conduit_feet,
    groundType: d.ground_type,
    notes: d.notes,
    createdBy: d.created_by,
    createdAt: d.created_at,
    updatedAt: d.updated_at
  }));
}

/**
 * Get daily entries for a foreman in a date range
 */
export async function getForemanEntries(
  foremanId: string,
  dateFrom: string,
  dateTo: string
): Promise<UndergroundDailyEntry[]> {
  const { data, error } = await supabase
    .from('underground_daily_entries')
    .select('*')
    .eq('created_by', foremanId)
    .gte('entry_date', dateFrom)
    .lte('entry_date', dateTo)
    .order('entry_date', { ascending: false });

  if (error) {
    console.error('[UndergroundCalc] Error fetching foreman entries:', error);
    return [];
  }

  return (data || []).map(d => ({
    id: d.id,
    jobId: d.job_id,
    entryDate: d.entry_date,
    isFullDay: d.is_full_day,
    isHalfDay: d.is_half_day,
    conduitFeet: d.conduit_feet,
    groundType: d.ground_type,
    notes: d.notes,
    createdBy: d.created_by,
    createdAt: d.created_at,
    updatedAt: d.updated_at
  }));
}

/**
 * Update a daily entry
 */
export async function updateDailyEntry(
  entryId: string,
  updates: Partial<UndergroundDailyEntry>
): Promise<UndergroundDailyEntry> {
  const dbUpdates: Record<string, any> = {};

  if (updates.isFullDay !== undefined) dbUpdates.is_full_day = updates.isFullDay;
  if (updates.isHalfDay !== undefined) dbUpdates.is_half_day = updates.isHalfDay;
  if (updates.conduitFeet !== undefined) dbUpdates.conduit_feet = updates.conduitFeet;
  if (updates.groundType !== undefined) dbUpdates.ground_type = updates.groundType;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

  const { data, error } = await supabase
    .from('underground_daily_entries')
    .update(dbUpdates)
    .eq('id', entryId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: data.id,
    jobId: data.job_id,
    entryDate: data.entry_date,
    isFullDay: data.is_full_day,
    isHalfDay: data.is_half_day,
    conduitFeet: data.conduit_feet,
    groundType: data.ground_type,
    notes: data.notes,
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

/**
 * Delete a daily entry
 */
export async function deleteDailyEntry(entryId: string): Promise<void> {
  const { error } = await supabase
    .from('underground_daily_entries')
    .delete()
    .eq('id', entryId);

  if (error) {
    throw new Error(error.message);
  }
}

// ===== FOREMAN PAY CALCULATION =====

/**
 * Calculate foreman pay from daily entries
 */
export function calculateForemanPay(entries: UndergroundDailyEntry[]): ForemanPayDetails {
  let fullDays = 0;
  let halfDays = 0;
  let conduitFeet = 0;

  for (const entry of entries) {
    if (entry.isFullDay) fullDays++;
    if (entry.isHalfDay) halfDays++;
    conduitFeet += entry.conduitFeet || 0;
  }

  // Calculate day pay
  const dayPay = (fullDays * FOREMAN_PAY.fullDay) + (halfDays * FOREMAN_PAY.halfDay);

  // Calculate conduit pay (tiered)
  let conduitPay = 0;
  let conduitRate: number = FOREMAN_PAY.conduitLte500;

  if (conduitFeet <= 500) {
    conduitPay = conduitFeet * FOREMAN_PAY.conduitLte500;
  } else {
    conduitPay = (500 * FOREMAN_PAY.conduitLte500) + ((conduitFeet - 500) * FOREMAN_PAY.conduitGt500);
    conduitRate = FOREMAN_PAY.conduitGt500;
  }

  // Check for weekly bonus
  const weeklyBonus = conduitFeet >= FOREMAN_PAY.weeklyBonusThreshold;
  const bonusPay = weeklyBonus ? FOREMAN_PAY.weeklyBonus : 0;

  // Total
  const totalPay = dayPay + conduitPay + bonusPay;

  return {
    fullDays,
    halfDays,
    conduitFeet,
    conduitRate,
    weeklyBonus,
    bonusThreshold: FOREMAN_PAY.weeklyBonusThreshold,
    dayPay,
    conduitPay: Math.round(conduitPay * 100) / 100,
    bonusPay,
    totalPay: Math.round(totalPay * 100) / 100
  };
}

/**
 * Get foreman's weekly summary
 */
export async function getForemanWeeklySummary(
  foremanId: string,
  weekStart: string
): Promise<{
  entries: UndergroundDailyEntry[];
  payDetails: ForemanPayDetails;
  daysWorked: number;
  jobsWorked: number;
}> {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const entries = await getForemanEntries(
    foremanId,
    weekStart,
    weekEnd.toISOString().split('T')[0]
  );

  const payDetails = calculateForemanPay(entries);
  const daysWorked = entries.filter(e => e.isFullDay || e.isHalfDay).length;
  const jobsWorked = new Set(entries.map(e => e.jobId)).size;

  return {
    entries,
    payDetails,
    daysWorked,
    jobsWorked
  };
}

// ===== UNDERGROUND JOB CALCULATION =====

export interface UndergroundCalculationResult {
  // Company revenue (from rate card based on ground type)
  nextgenTotal: number;

  // Foreman pay (NOT from rate card)
  foremanPay: ForemanPayDetails;

  // Drill investor returns (if applicable)
  drillInvestorTotal: number;

  // Profit
  grossMargin: number;
  grossMarginPercent: number;

  // Metadata
  totalFootage: number;
  groundType: GroundType;
  daysWorked: number;
}

/**
 * Calculate underground job totals
 */
export async function calculateUndergroundJob(
  jobId: string,
  rateCardGroupId: string
): Promise<UndergroundCalculationResult | null> {
  // Get job
  const { data: job } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (!job || job.department !== 'underground') {
    console.error('[UndergroundCalc] Job not found or not underground');
    return null;
  }

  // Get daily entries
  const entries = await getJobDailyEntries(jobId);

  if (entries.length === 0) {
    console.error('[UndergroundCalc] No daily entries found');
    return null;
  }

  // Calculate foreman pay
  const foremanPay = calculateForemanPay(entries);

  // Get ground type (use job's or most common from entries)
  const groundType: GroundType = job.ground_type || 'Normal';

  // Get rate from rate card
  const rateCode = GROUND_TYPE_CODES[groundType];

  const { data: rateItem } = await supabase
    .from('rate_card_items')
    .select('*')
    .eq('group_id', rateCardGroupId)
    .eq('code', rateCode)
    .eq('is_active', true)
    .single();

  if (!rateItem) {
    console.error(`[UndergroundCalc] Rate code ${rateCode} not found in group ${rateCardGroupId}`);
    return null;
  }

  // Calculate totals
  const totalFootage = foremanPay.conduitFeet;
  const nextgenTotal = totalFootage * Number(rateItem.nextgen_rate);
  const drillInvestorTotal = totalFootage * Number(rateItem.truck_investor_rate || 0);

  const grossMargin = nextgenTotal - foremanPay.totalPay - drillInvestorTotal;
  const grossMarginPercent = nextgenTotal > 0 ? (grossMargin / nextgenTotal) * 100 : 0;

  return {
    nextgenTotal: Math.round(nextgenTotal * 100) / 100,
    foremanPay,
    drillInvestorTotal: Math.round(drillInvestorTotal * 100) / 100,
    grossMargin: Math.round(grossMargin * 100) / 100,
    grossMarginPercent: Math.round(grossMarginPercent * 100) / 100,
    totalFootage,
    groundType,
    daysWorked: entries.filter(e => e.isFullDay || e.isHalfDay).length
  };
}

// ===== BONUS TRACKER =====

/**
 * Get foreman's bonus progress for current week
 */
export async function getForemanBonusProgress(
  foremanId: string
): Promise<{
  currentFootage: number;
  targetFootage: number;
  percentComplete: number;
  isEligible: boolean;
  bonusAmount: number;
}> {
  // Get current week start (Monday)
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(today.setDate(diff));

  const summary = await getForemanWeeklySummary(
    foremanId,
    weekStart.toISOString().split('T')[0]
  );

  const currentFootage = summary.payDetails.conduitFeet;
  const targetFootage = FOREMAN_PAY.weeklyBonusThreshold;
  const percentComplete = Math.min((currentFootage / targetFootage) * 100, 100);

  return {
    currentFootage,
    targetFootage,
    percentComplete,
    isEligible: currentFootage >= targetFootage,
    bonusAmount: FOREMAN_PAY.weeklyBonus
  };
}
