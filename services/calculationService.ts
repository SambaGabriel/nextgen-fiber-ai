/**
 * Calculation Service
 * Calculates earnings for production submissions
 * Results are IMMUTABLE once saved (audit trail)
 */

import { supabase } from './supabase';

// ===== TYPES =====

export interface LineItemInput {
  rate_code: string;
  quantity: number;
  unit: 'FT' | 'EA' | 'HR' | 'DAY';
  notes?: string;
}

export interface LineItemCalculation {
  rate_code: string;
  description: string;
  quantity: number;
  unit: string;
  nextgen_rate: number;
  lineman_rate: number;
  investor_rate: number;
  nextgen_amount: number;
  lineman_amount: number;
  investor_amount: number;
}

export interface CalculationResult {
  nextgen_total: number;
  lineman_total: number;
  investor_total: number;
  gross_margin: number;
  gross_margin_percent: number;
  line_items: LineItemCalculation[];
}

export interface FrozenContext {
  job_id: string;
  job_title: string;
  client_id: string;
  client_name: string;
  customer_id: string;
  customer_name: string;
  lineman_id: string;
  lineman_name: string;
  truck_id?: string;
  truck_number?: string;
  investor_id?: string;
  investor_name?: string;
  rate_card_group_id: string;
  calculated_at: string;
  rates_snapshot: {
    code: string;
    nextgen_rate: number;
    lineman_rate: number;
    investor_rate: number;
  }[];
}

// ===== CALCULATION =====

/**
 * Calculate earnings for a list of production line items
 */
export async function calculateProduction(
  jobId: string,
  lineItems: LineItemInput[]
): Promise<CalculationResult> {
  // Get job details
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    throw new Error('Job not found');
  }

  // Find rate card group by client + customer + region
  const region = job.location?.state || 'AL';

  const { data: rateGroup, error: rateGroupError } = await supabase
    .from('rate_card_groups')
    .select('id')
    .eq('client_id', job.client_id)
    .eq('is_active', true)
    .single();

  // If no client-specific rate card, try by customer name + region
  let groupId = rateGroup?.id;

  if (!groupId) {
    const { data: fallbackGroup } = await supabase
      .from('rate_card_groups')
      .select('id')
      .eq('customer_name', job.customer_name || 'Brightspeed')
      .eq('region', region)
      .eq('is_active', true)
      .single();

    groupId = fallbackGroup?.id;
  }

  if (!groupId) {
    throw new Error(`No rate card found for job. Client: ${job.client_name}, Customer: ${job.customer_name}, Region: ${region}`);
  }

  // Get rate items for this group
  const codes = lineItems.map(i => i.rate_code);

  const { data: rateItems, error: rateItemsError } = await supabase
    .from('rate_card_items')
    .select('*')
    .eq('group_id', groupId)
    .eq('is_active', true)
    .in('code', codes);

  if (rateItemsError || !rateItems || rateItems.length === 0) {
    throw new Error(`No rate items found for codes: ${codes.join(', ')}`);
  }

  // Calculate each line item
  const calculations: LineItemCalculation[] = [];
  let nextgen_total = 0;
  let lineman_total = 0;
  let investor_total = 0;

  for (const item of lineItems) {
    const rate = rateItems.find(r => r.code === item.rate_code);

    if (!rate) {
      throw new Error(`Rate code not found: ${item.rate_code}`);
    }

    const nextgen_amount = Number(rate.nextgen_rate) * item.quantity;
    const lineman_amount = Number(rate.lineman_rate) * item.quantity;
    const investor_amount = Number(rate.truck_investor_rate) * item.quantity;

    calculations.push({
      rate_code: item.rate_code,
      description: rate.description || item.rate_code,
      quantity: item.quantity,
      unit: item.unit,
      nextgen_rate: Number(rate.nextgen_rate),
      lineman_rate: Number(rate.lineman_rate),
      investor_rate: Number(rate.truck_investor_rate),
      nextgen_amount: Math.round(nextgen_amount * 100) / 100,
      lineman_amount: Math.round(lineman_amount * 100) / 100,
      investor_amount: Math.round(investor_amount * 100) / 100
    });

    nextgen_total += nextgen_amount;
    lineman_total += lineman_amount;
    investor_total += investor_amount;
  }

  const gross_margin = nextgen_total - lineman_total - investor_total;
  const gross_margin_percent = nextgen_total > 0
    ? (gross_margin / nextgen_total) * 100
    : 0;

  return {
    nextgen_total: Math.round(nextgen_total * 100) / 100,
    lineman_total: Math.round(lineman_total * 100) / 100,
    investor_total: Math.round(investor_total * 100) / 100,
    gross_margin: Math.round(gross_margin * 100) / 100,
    gross_margin_percent: Math.round(gross_margin_percent * 100) / 100,
    line_items: calculations
  };
}

/**
 * Save calculation result (IMMUTABLE - only INSERT, never UPDATE)
 */
export async function saveCalculation(
  submissionId: string,
  jobId: string,
  result: CalculationResult,
  frozenContext: FrozenContext
): Promise<void> {
  const { error } = await supabase
    .from('calculated_totals')
    .insert({
      submission_id: submissionId,
      job_id: jobId,
      frozen_context: frozenContext,
      nextgen_total: result.nextgen_total,
      lineman_total: result.lineman_total,
      truck_investor_total: result.investor_total,
      gross_margin: result.gross_margin,
      gross_margin_percent: result.gross_margin_percent,
      line_item_calculations: result.line_items
    });

  if (error) {
    console.error('[CalculationService] Error saving calculation:', error);
    throw new Error('Failed to save calculation');
  }
}

/**
 * Get calculations for a job
 */
export async function getJobCalculations(jobId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('calculated_totals')
    .select('*')
    .eq('job_id', jobId)
    .order('calculated_at', { ascending: false });

  if (error) {
    console.error('[CalculationService] Error fetching calculations:', error);
    return [];
  }

  return data || [];
}

/**
 * Get dashboard summary for date range
 */
export async function getDashboardSummary(
  dateFrom: string,
  dateTo: string
): Promise<{
  totals: {
    revenue: number;
    lineman_pay: number;
    investor_pay: number;
    margin: number;
    margin_percent: number;
    submission_count: number;
  };
  by_lineman: { id: string; name: string; total: number }[];
  by_customer: { name: string; total: number }[];
}> {
  const { data, error } = await supabase
    .from('calculated_totals')
    .select(`
      *,
      jobs:job_id (
        assigned_to_id,
        assigned_to_name,
        customer_name
      )
    `)
    .gte('calculated_at', dateFrom)
    .lte('calculated_at', dateTo);

  if (error || !data) {
    return {
      totals: { revenue: 0, lineman_pay: 0, investor_pay: 0, margin: 0, margin_percent: 0, submission_count: 0 },
      by_lineman: [],
      by_customer: []
    };
  }

  // Aggregate totals
  let revenue = 0;
  let lineman_pay = 0;
  let investor_pay = 0;

  const linemanMap = new Map<string, { name: string; total: number }>();
  const customerMap = new Map<string, number>();

  for (const calc of data) {
    revenue += Number(calc.nextgen_total);
    lineman_pay += Number(calc.lineman_total);
    investor_pay += Number(calc.truck_investor_total);

    // By lineman
    const linemanId = calc.jobs?.assigned_to_id;
    const linemanName = calc.jobs?.assigned_to_name || 'Unknown';
    if (linemanId) {
      const existing = linemanMap.get(linemanId) || { name: linemanName, total: 0 };
      existing.total += Number(calc.lineman_total);
      linemanMap.set(linemanId, existing);
    }

    // By customer
    const customerName = calc.jobs?.customer_name || 'Unknown';
    customerMap.set(customerName, (customerMap.get(customerName) || 0) + Number(calc.nextgen_total));
  }

  const margin = revenue - lineman_pay - investor_pay;
  const margin_percent = revenue > 0 ? (margin / revenue) * 100 : 0;

  return {
    totals: {
      revenue: Math.round(revenue * 100) / 100,
      lineman_pay: Math.round(lineman_pay * 100) / 100,
      investor_pay: Math.round(investor_pay * 100) / 100,
      margin: Math.round(margin * 100) / 100,
      margin_percent: Math.round(margin_percent * 100) / 100,
      submission_count: data.length
    },
    by_lineman: Array.from(linemanMap.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      total: Math.round(data.total * 100) / 100
    })),
    by_customer: Array.from(customerMap.entries()).map(([name, total]) => ({
      name,
      total: Math.round(total * 100) / 100
    }))
  };
}
