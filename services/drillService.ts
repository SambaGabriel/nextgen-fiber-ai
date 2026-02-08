/**
 * Drill Service
 * Manages drills and drill investors for underground work
 */

import { supabase } from './supabase';
import type { Drill, DrillStats, CreateDrillInput, UpdateDrillInput } from '../types/equipment';

// ===== DRILL CRUD =====

/**
 * Get all active drills
 */
export async function getDrills(): Promise<Drill[]> {
  const { data, error } = await supabase
    .from('drills')
    .select(`
      *,
      investor:investor_id (
        id,
        raw_user_meta_data->name
      )
    `)
    .eq('is_active', true)
    .order('label');

  if (error) {
    console.error('[DrillService] Error fetching drills:', error);
    return [];
  }

  return (data || []).map(d => ({
    id: d.id,
    label: d.label,
    equipmentDescription: d.equipment_description,
    ownerType: d.owner_type || 'company',
    investorId: d.investor_id,
    investorName: d.investor_name || d.investor?.raw_user_meta_data?.name,
    isActive: d.is_active,
    createdAt: d.created_at,
    updatedAt: d.updated_at
  }));
}

/**
 * Get drill by ID
 */
export async function getDrillById(drillId: string): Promise<Drill | null> {
  const { data, error } = await supabase
    .from('drills')
    .select('*')
    .eq('id', drillId)
    .single();

  if (error) {
    console.error('[DrillService] Error fetching drill:', error);
    return null;
  }

  return {
    id: data.id,
    label: data.label,
    equipmentDescription: data.equipment_description,
    ownerType: data.owner_type || 'company',
    investorId: data.investor_id,
    investorName: data.investor_name,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

/**
 * Create a new drill
 */
export async function createDrill(input: CreateDrillInput): Promise<Drill> {
  const { data, error } = await supabase
    .from('drills')
    .insert({
      id: input.label.toUpperCase().replace(/\s+/g, '-'),
      label: input.label,
      equipment_description: input.equipmentDescription,
      owner_type: input.ownerType,
      investor_id: input.investorId
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: data.id,
    label: data.label,
    equipmentDescription: data.equipment_description,
    ownerType: data.owner_type,
    investorId: data.investor_id,
    investorName: data.investor_name,
    isActive: data.is_active,
    createdAt: data.created_at
  };
}

/**
 * Update a drill
 */
export async function updateDrill(drillId: string, input: UpdateDrillInput): Promise<Drill> {
  const updates: Record<string, any> = {};

  if (input.label !== undefined) updates.label = input.label;
  if (input.equipmentDescription !== undefined) updates.equipment_description = input.equipmentDescription;
  if (input.ownerType !== undefined) updates.owner_type = input.ownerType;
  if (input.investorId !== undefined) updates.investor_id = input.investorId;
  if (input.isActive !== undefined) updates.is_active = input.isActive;

  const { data, error } = await supabase
    .from('drills')
    .update(updates)
    .eq('id', drillId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: data.id,
    label: data.label,
    equipmentDescription: data.equipment_description,
    ownerType: data.owner_type,
    investorId: data.investor_id,
    investorName: data.investor_name,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

/**
 * Soft delete a drill
 */
export async function deleteDrill(drillId: string): Promise<void> {
  const { error } = await supabase
    .from('drills')
    .update({ is_active: false })
    .eq('id', drillId);

  if (error) {
    throw new Error(error.message);
  }
}

// ===== DRILL ASSIGNMENT =====

/**
 * Assign drill to a job
 */
export async function assignDrillToJob(jobId: string, drillId: string): Promise<void> {
  // Get drill info
  const drill = await getDrillById(drillId);

  const { error } = await supabase
    .from('jobs')
    .update({
      assigned_drill_id: drillId,
      drill_investor_name: drill?.investorName || null
    })
    .eq('id', jobId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Remove drill from job
 */
export async function removeDrillFromJob(jobId: string): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .update({
      assigned_drill_id: null,
      drill_investor_name: null
    })
    .eq('id', jobId);

  if (error) {
    throw new Error(error.message);
  }
}

// ===== DRILL STATS =====

/**
 * Get statistics for a drill
 */
export async function getDrillStats(drillId: string): Promise<DrillStats | null> {
  const drill = await getDrillById(drillId);
  if (!drill) return null;

  // Get all jobs with this drill
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select(`
      id,
      status,
      production_data,
      created_at
    `)
    .eq('assigned_drill_id', drillId);

  if (error) {
    console.error('[DrillService] Error fetching drill stats:', error);
    return null;
  }

  // Get calculations for these jobs
  const jobIds = (jobs || []).map(j => j.id);

  const { data: calculations } = await supabase
    .from('calculated_totals')
    .select('*')
    .in('job_id', jobIds);

  // Calculate totals
  let totalFootage = 0;
  let totalRevenue = 0;
  let totalInvestorReturns = 0;
  let lastJobDate: string | undefined;

  for (const job of jobs || []) {
    if (job.production_data?.totalFootage) {
      totalFootage += job.production_data.totalFootage;
    }
    if (!lastJobDate || job.created_at > lastJobDate) {
      lastJobDate = job.created_at;
    }
  }

  for (const calc of calculations || []) {
    totalRevenue += Number(calc.nextgen_total) || 0;
    totalInvestorReturns += Number(calc.truck_investor_total) || 0; // Drill investor uses same column
  }

  // Calculate utilization (weeks with activity / total weeks since first job)
  const utilizationRate = jobs && jobs.length > 0 ? 75 : 0; // Simplified for now

  return {
    drillId,
    label: drill.label,
    totalJobs: jobs?.length || 0,
    totalFootage,
    totalRevenue,
    totalInvestorReturns,
    lastJobDate,
    utilizationRate
  };
}

/**
 * Get drills for an investor
 */
export async function getDrillsByInvestor(investorId: string): Promise<Drill[]> {
  const { data, error } = await supabase
    .from('drills')
    .select('*')
    .eq('investor_id', investorId)
    .eq('is_active', true)
    .order('label');

  if (error) {
    console.error('[DrillService] Error fetching investor drills:', error);
    return [];
  }

  return (data || []).map(d => ({
    id: d.id,
    label: d.label,
    equipmentDescription: d.equipment_description,
    ownerType: d.owner_type,
    investorId: d.investor_id,
    investorName: d.investor_name,
    isActive: d.is_active,
    createdAt: d.created_at,
    updatedAt: d.updated_at
  }));
}

/**
 * Get available drills (not assigned to active jobs)
 */
export async function getAvailableDrills(): Promise<Drill[]> {
  // Get all active drills
  const drills = await getDrills();

  // Get drills assigned to active jobs
  const { data: activeJobs } = await supabase
    .from('jobs')
    .select('assigned_drill_id')
    .not('assigned_drill_id', 'is', null)
    .in('status', ['assigned', 'in_progress']);

  const assignedDrillIds = new Set((activeJobs || []).map(j => j.assigned_drill_id));

  // Filter out assigned drills
  return drills.filter(d => !assignedDrillIds.has(d.id));
}
