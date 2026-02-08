/**
 * Truck & Investor Service
 * Manages trucks and their investor owners
 */

import { supabase } from './supabase';
import type { Truck as EquipmentTruck, TruckStats, CreateTruckInput, UpdateTruckInput } from '../types/equipment';

// ===== TYPES (Legacy - maintained for backward compatibility) =====

export interface Investor {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
}

export interface Truck {
  id: string;
  truck_number: string;
  description?: string;
  vehicle_description?: string;
  owner_type?: 'company' | 'investor';
  investor_id?: string;
  investor_name?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

// ===== INVESTORS =====

export async function getInvestors(): Promise<Investor[]> {
  const { data, error } = await supabase
    .from('investors')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('[TruckService] Error fetching investors:', error);
    return [];
  }

  return data || [];
}

export async function createInvestor(
  name: string,
  email?: string,
  phone?: string
): Promise<Investor> {
  const { data, error } = await supabase
    .from('investors')
    .insert({ name, email, phone })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

// ===== TRUCKS =====

export async function getTrucks(): Promise<Truck[]> {
  const { data, error } = await supabase
    .from('trucks')
    .select(`
      *,
      investors:investor_id (name)
    `)
    .eq('is_active', true)
    .order('truck_number');

  if (error) {
    console.error('[TruckService] Error fetching trucks:', error);
    return [];
  }

  return (data || []).map(t => ({
    ...t,
    investor_name: t.investors?.name || null
  }));
}

export async function getTruckById(truckId: string): Promise<Truck | null> {
  const { data, error } = await supabase
    .from('trucks')
    .select(`
      *,
      investors:investor_id (name)
    `)
    .eq('id', truckId)
    .single();

  if (error) {
    console.error('[TruckService] Error fetching truck:', error);
    return null;
  }

  return {
    ...data,
    investor_name: data.investors?.name || null
  };
}

export async function createTruck(
  truck_number: string,
  description?: string,
  investor_id?: string
): Promise<Truck> {
  const { data, error } = await supabase
    .from('trucks')
    .insert({ truck_number, description, investor_id })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateTruck(
  truckId: string,
  updates: Partial<Pick<Truck, 'truck_number' | 'description' | 'investor_id' | 'is_active' | 'owner_type' | 'vehicle_description'>>
): Promise<Truck> {
  const { data, error } = await supabase
    .from('trucks')
    .update(updates)
    .eq('id', truckId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

// ===== TRUCK ASSIGNMENT =====

/**
 * Assign truck to a job
 */
export async function assignTruckToJob(jobId: string, truckId: string): Promise<void> {
  const truck = await getTruckById(truckId);

  const { error } = await supabase
    .from('jobs')
    .update({
      assigned_truck_id: truckId,
      truck_investor_name: truck?.investor_name || null
    })
    .eq('id', jobId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Remove truck from job
 */
export async function removeTruckFromJob(jobId: string): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .update({
      assigned_truck_id: null,
      truck_investor_name: null
    })
    .eq('id', jobId);

  if (error) {
    throw new Error(error.message);
  }
}

// ===== TRUCK STATS =====

/**
 * Get statistics for a truck
 */
export async function getTruckStats(truckId: string): Promise<TruckStats | null> {
  const truck = await getTruckById(truckId);
  if (!truck) return null;

  // Get all jobs with this truck
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select(`
      id,
      status,
      production_data,
      created_at
    `)
    .eq('assigned_truck_id', truckId);

  if (error) {
    console.error('[TruckService] Error fetching truck stats:', error);
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
    totalInvestorReturns += Number(calc.truck_investor_total) || 0;
  }

  // Calculate utilization (simplified)
  const utilizationRate = jobs && jobs.length > 0 ? 75 : 0;

  return {
    truckId,
    truckNumber: truck.truck_number,
    totalJobs: jobs?.length || 0,
    totalFootage,
    totalRevenue,
    totalInvestorReturns,
    lastJobDate,
    utilizationRate
  };
}

/**
 * Get trucks for an investor
 */
export async function getTrucksByInvestor(investorId: string): Promise<Truck[]> {
  const { data, error } = await supabase
    .from('trucks')
    .select('*')
    .eq('investor_id', investorId)
    .eq('is_active', true)
    .order('truck_number');

  if (error) {
    console.error('[TruckService] Error fetching investor trucks:', error);
    return [];
  }

  return data || [];
}

/**
 * Get available trucks (not assigned to active jobs)
 */
export async function getAvailableTrucks(): Promise<Truck[]> {
  // Get all active trucks
  const trucks = await getTrucks();

  // Get trucks assigned to active jobs
  const { data: activeJobs } = await supabase
    .from('jobs')
    .select('assigned_truck_id')
    .not('assigned_truck_id', 'is', null)
    .in('status', ['assigned', 'in_progress']);

  const assignedTruckIds = new Set((activeJobs || []).map(j => j.assigned_truck_id));

  // Filter out assigned trucks
  return trucks.filter(t => !assignedTruckIds.has(t.id));
}

/**
 * Delete truck (soft delete)
 */
export async function deleteTruck(truckId: string): Promise<void> {
  const { error } = await supabase
    .from('trucks')
    .update({ is_active: false })
    .eq('id', truckId);

  if (error) {
    throw new Error(error.message);
  }
}
