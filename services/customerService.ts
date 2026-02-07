/**
 * Customer Service - End Operators
 * Handles CRUD operations for Customers (final project operators)
 * Examples: Brightspeed, All Points Broadband, AT&T, Spectrum
 */

import { supabase } from './supabase';

// ===== TYPES =====

export interface EndCustomer {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ===== ERROR CLASS =====

export class CustomerError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'CustomerError';
  }
}

// ===== OPERATIONS =====

/**
 * Get all active customers
 */
export async function getCustomers(): Promise<EndCustomer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('[CustomerService] Error fetching customers:', error);
    // Fallback to localStorage
    const cached = localStorage.getItem('endCustomers');
    return cached ? JSON.parse(cached) : [];
  }

  // Cache for offline
  localStorage.setItem('endCustomers', JSON.stringify(data));
  return data || [];
}

/**
 * Get customer by ID
 */
export async function getCustomerById(customerId: string): Promise<EndCustomer | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single();

  if (error) {
    console.error('[CustomerService] Error fetching customer:', error);
    return null;
  }

  return data;
}

/**
 * Create a new customer
 */
export async function createCustomer(name: string, code?: string): Promise<EndCustomer> {
  const customerCode = code || name.toUpperCase().replace(/\s+/g, '').slice(0, 10);

  const { data, error } = await supabase
    .from('customers')
    .insert({
      name,
      code: customerCode,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') { // Unique violation
      throw new CustomerError('DUPLICATE_NAME', `Customer "${name}" already exists`);
    }
    throw new CustomerError('CREATE_FAILED', error.message);
  }

  return data;
}

/**
 * Update customer
 */
export async function updateCustomer(customerId: string, updates: Partial<Pick<EndCustomer, 'name' | 'code' | 'is_active'>>): Promise<EndCustomer> {
  const { data, error } = await supabase
    .from('customers')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', customerId)
    .select()
    .single();

  if (error) {
    throw new CustomerError('UPDATE_FAILED', error.message);
  }

  return data;
}

/**
 * Deactivate customer (soft delete)
 */
export async function deactivateCustomer(customerId: string): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', customerId);

  if (error) {
    throw new CustomerError('DEACTIVATE_FAILED', error.message);
  }
}

// ===== LOCAL STORAGE FALLBACK =====

export function getCustomersFromLocal(): EndCustomer[] {
  const cached = localStorage.getItem('endCustomers');
  return cached ? JSON.parse(cached) : [];
}

export function saveCustomersToLocal(customers: EndCustomer[]): void {
  localStorage.setItem('endCustomers', JSON.stringify(customers));
}
