/**
 * Truck & Investor Service
 * Manages trucks and their investor owners
 */

import { supabase } from './supabase';

// ===== TYPES =====

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
  investor_id?: string;
  investor_name?: string;
  is_active: boolean;
  created_at: string;
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
  updates: Partial<Pick<Truck, 'truck_number' | 'description' | 'investor_id' | 'is_active'>>
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
