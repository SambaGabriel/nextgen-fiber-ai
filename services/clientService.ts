/**
 * Client Service - Prime Contractors
 * Handles CRUD operations for Clients (who pay us)
 * Examples: MasTec, Henkels, Direct
 */

import { supabase } from './supabase';

// ===== TYPES =====

export interface PrimeClient {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ===== ERROR CLASS =====

export class ClientError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'ClientError';
  }
}

// ===== OPERATIONS =====

/**
 * Get all active clients
 */
export async function getClients(): Promise<PrimeClient[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('[ClientService] Error fetching clients:', error);
    // Fallback to localStorage
    const cached = localStorage.getItem('primeClients');
    return cached ? JSON.parse(cached) : [];
  }

  // Cache for offline
  localStorage.setItem('primeClients', JSON.stringify(data));
  return data || [];
}

/**
 * Get client by ID
 */
export async function getClientById(clientId: string): Promise<PrimeClient | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();

  if (error) {
    console.error('[ClientService] Error fetching client:', error);
    return null;
  }

  return data;
}

/**
 * Create a new client
 */
export async function createClient(name: string, code?: string): Promise<PrimeClient> {
  const clientCode = code || name.toUpperCase().replace(/\s+/g, '').slice(0, 10);

  const { data, error } = await supabase
    .from('clients')
    .insert({
      name,
      code: clientCode,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') { // Unique violation
      throw new ClientError('DUPLICATE_NAME', `Client "${name}" already exists`);
    }
    throw new ClientError('CREATE_FAILED', error.message);
  }

  return data;
}

/**
 * Update client
 */
export async function updateClient(clientId: string, updates: Partial<Pick<PrimeClient, 'name' | 'code' | 'is_active'>>): Promise<PrimeClient> {
  const { data, error } = await supabase
    .from('clients')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', clientId)
    .select()
    .single();

  if (error) {
    throw new ClientError('UPDATE_FAILED', error.message);
  }

  return data;
}

/**
 * Deactivate client (soft delete)
 */
export async function deactivateClient(clientId: string): Promise<void> {
  const { error } = await supabase
    .from('clients')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', clientId);

  if (error) {
    throw new ClientError('DEACTIVATE_FAILED', error.message);
  }
}

// ===== LOCAL STORAGE FALLBACK =====

export function getClientsFromLocal(): PrimeClient[] {
  const cached = localStorage.getItem('primeClients');
  return cached ? JSON.parse(cached) : [];
}

export function saveClientsToLocal(clients: PrimeClient[]): void {
  localStorage.setItem('primeClients', JSON.stringify(clients));
}
