/**
 * Rate Card Service - MVP
 * Handles all rate card operations with explicit error handling
 */

import { supabase } from './supabase';

// ===== TYPES =====

export interface RateCardGroup {
  id: string;
  customer_id: string;
  customer_name: string;
  region: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Computed
  profile_count?: number;
  item_count?: number;
}

export interface RateCardProfile {
  id: string;
  group_id: string;
  name: string;
  type: 'NEXTGEN' | 'LINEMAN' | 'INVESTOR';
  description?: string;
  is_default: boolean;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Computed
  item_count?: number;
}

export interface RateCardItem {
  id: string;
  group_id: string;
  profile_id: string;
  code: string;
  description: string;
  unit: 'FT' | 'EA' | 'HR' | 'DAY';
  nextgen_rate: number;
  lineman_rate: number;
  truck_investor_rate: number;
  is_active: boolean;
  effective_date?: string;
  expiration_date?: string;
  created_at: string;
  updated_at: string;
}

export interface RateCardAuditLog {
  id: string;
  action: 'IMPORT' | 'CREATE' | 'UPDATE' | 'DELETE' | 'PROFILE_CREATE';
  entity_type: 'GROUP' | 'PROFILE' | 'ITEM';
  entity_id: string;
  user_id?: string;
  user_name?: string;
  previous_value?: any;
  new_value?: any;
  metadata?: any;
  created_at: string;
}

// ===== ERROR CLASS =====

export class RateCardError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'RateCardError';
  }
}

// ===== GROUPS =====

export async function getGroups(): Promise<RateCardGroup[]> {
  const { data, error } = await supabase
    .from('rate_card_groups')
    .select('*')
    .eq('is_active', true)
    .order('customer_name', { ascending: true });

  if (error) {
    console.error('[RateCardService] Error fetching groups:', error);
    // Return from localStorage as fallback
    const cached = localStorage.getItem('rateCardGroups');
    return cached ? JSON.parse(cached) : [];
  }

  // Cache for offline
  localStorage.setItem('rateCardGroups', JSON.stringify(data));
  return data || [];
}

export async function createGroup(customerName: string, region: string): Promise<RateCardGroup> {
  const { data, error } = await supabase
    .from('rate_card_groups')
    .insert({
      customer_id: customerName.toLowerCase().replace(/\s+/g, '-'),
      customer_name: customerName,
      region: region,
    })
    .select()
    .single();

  if (error) {
    throw new RateCardError('CREATE_GROUP_FAILED', error.message);
  }

  // Create default profile for the group
  await createProfile(data.id, 'Default', 'NEXTGEN', true);

  return data;
}

// ===== PROFILES =====

export async function getProfiles(groupId: string): Promise<RateCardProfile[]> {
  const { data, error } = await supabase
    .from('rate_card_profiles')
    .select('*')
    .eq('group_id', groupId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true });

  if (error) {
    console.error('[RateCardService] Error fetching profiles:', error);
    const cached = localStorage.getItem(`rateCardProfiles_${groupId}`);
    return cached ? JSON.parse(cached) : [];
  }

  localStorage.setItem(`rateCardProfiles_${groupId}`, JSON.stringify(data));
  return data || [];
}

export async function createProfile(
  groupId: string,
  name: string,
  type: 'NEXTGEN' | 'LINEMAN' | 'INVESTOR',
  isDefault: boolean = false,
  duplicateFromProfileId?: string
): Promise<RateCardProfile> {
  const { data, error } = await supabase
    .from('rate_card_profiles')
    .insert({
      group_id: groupId,
      name: name,
      type: type,
      is_default: isDefault,
    })
    .select()
    .single();

  if (error) {
    throw new RateCardError('CREATE_PROFILE_FAILED', error.message);
  }

  // If duplicating, copy items from source profile
  if (duplicateFromProfileId) {
    await duplicateProfileItems(duplicateFromProfileId, data.id);
  }

  // Log audit
  await logAudit('PROFILE_CREATE', 'PROFILE', data.id, null, data);

  return data;
}

async function duplicateProfileItems(sourceProfileId: string, targetProfileId: string): Promise<void> {
  const { data: sourceItems, error: fetchError } = await supabase
    .from('rate_card_items')
    .select('*')
    .eq('profile_id', sourceProfileId);

  if (fetchError || !sourceItems) return;

  const newItems = sourceItems.map(item => ({
    group_id: item.group_id,
    profile_id: targetProfileId,
    code: item.code,
    description: item.description,
    unit: item.unit,
    nextgen_rate: item.nextgen_rate,
    lineman_rate: item.lineman_rate,
    truck_investor_rate: item.truck_investor_rate,
    is_active: true,
  }));

  await supabase.from('rate_card_items').insert(newItems);
}

// ===== ITEMS =====

export async function getItems(groupId: string, profileId: string): Promise<RateCardItem[]> {
  const { data, error } = await supabase
    .from('rate_card_items')
    .select('*')
    .eq('group_id', groupId)
    .eq('profile_id', profileId)
    .eq('is_active', true)
    .order('code', { ascending: true });

  if (error) {
    console.error('[RateCardService] Error fetching items:', error);
    const cached = localStorage.getItem(`rateCardItems_${profileId}`);
    return cached ? JSON.parse(cached) : [];
  }

  localStorage.setItem(`rateCardItems_${profileId}`, JSON.stringify(data));
  return data || [];
}

export async function updateItem(
  itemId: string,
  updates: Partial<Pick<RateCardItem, 'nextgen_rate' | 'lineman_rate' | 'truck_investor_rate' | 'description'>>
): Promise<RateCardItem> {
  // Get current value for audit
  const { data: current } = await supabase
    .from('rate_card_items')
    .select('*')
    .eq('id', itemId)
    .single();

  const { data, error } = await supabase
    .from('rate_card_items')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .select()
    .single();

  if (error) {
    throw new RateCardError('UPDATE_ITEM_FAILED', error.message);
  }

  // Log audit
  await logAudit('UPDATE', 'ITEM', itemId, current, data);

  return data;
}

export async function createItem(item: Omit<RateCardItem, 'id' | 'created_at' | 'updated_at'>): Promise<RateCardItem> {
  const { data, error } = await supabase
    .from('rate_card_items')
    .insert(item)
    .select()
    .single();

  if (error) {
    throw new RateCardError('CREATE_ITEM_FAILED', error.message);
  }

  await logAudit('CREATE', 'ITEM', data.id, null, data);
  return data;
}

// ===== IMPORT =====

export interface ImportPreview {
  fileName: string;
  groupId: string;
  profileId: string;
  profileName: string;
  rows: ImportPreviewRow[];
  summary: {
    totalRows: number;
    validRows: number;
    errorRows: number;
    toCreate: number;
    toUpdate: number;
  };
  errors: ImportError[];
  warnings: ImportWarning[];
}

export interface ImportPreviewRow {
  rowNumber: number;
  code: string;
  description: string;
  unit: string;
  nextgenRate: number;
  linemanRate: number;
  truckInvestorRate: number;
  action: 'CREATE' | 'UPDATE' | 'SKIP';
  errors: string[];
}

export interface ImportError {
  row: number;
  column: string;
  message: string;
}

export interface ImportWarning {
  row: number;
  column: string;
  message: string;
}

export async function importItems(
  groupId: string,
  profileId: string,
  items: Omit<RateCardItem, 'id' | 'created_at' | 'updated_at' | 'group_id' | 'profile_id'>[]
): Promise<{ created: number; updated: number }> {
  // Get existing items for this profile
  const { data: existingItems } = await supabase
    .from('rate_card_items')
    .select('id, code')
    .eq('profile_id', profileId);

  const existingCodes = new Map((existingItems || []).map(i => [i.code, i.id]));

  const toCreate: any[] = [];
  const toUpdate: { id: string; data: any }[] = [];

  for (const item of items) {
    const existingId = existingCodes.get(item.code);

    if (existingId) {
      toUpdate.push({
        id: existingId,
        data: {
          description: item.description,
          unit: item.unit,
          nextgen_rate: item.nextgen_rate,
          lineman_rate: item.lineman_rate,
          truck_investor_rate: item.truck_investor_rate,
          updated_at: new Date().toISOString(),
        },
      });
    } else {
      toCreate.push({
        group_id: groupId,
        profile_id: profileId,
        code: item.code,
        description: item.description,
        unit: item.unit,
        nextgen_rate: item.nextgen_rate,
        lineman_rate: item.lineman_rate,
        truck_investor_rate: item.truck_investor_rate,
        is_active: true,
      });
    }
  }

  // Insert new items
  if (toCreate.length > 0) {
    const { error: createError } = await supabase
      .from('rate_card_items')
      .insert(toCreate);

    if (createError) {
      throw new RateCardError('IMPORT_CREATE_FAILED', createError.message);
    }
  }

  // Update existing items
  for (const update of toUpdate) {
    const { error: updateError } = await supabase
      .from('rate_card_items')
      .update(update.data)
      .eq('id', update.id);

    if (updateError) {
      console.error('[RateCardService] Update error:', updateError);
    }
  }

  // Log audit
  await logAudit('IMPORT', 'ITEM', profileId, null, null, {
    created: toCreate.length,
    updated: toUpdate.length,
    total: items.length,
  });

  return {
    created: toCreate.length,
    updated: toUpdate.length,
  };
}

// ===== AUDIT LOG =====

async function logAudit(
  action: string,
  entityType: string,
  entityId: string,
  previousValue: any,
  newValue: any,
  metadata?: any
): Promise<void> {
  try {
    await supabase.from('rate_card_audit_log').insert({
      action,
      entity_type: entityType,
      entity_id: entityId,
      previous_value: previousValue,
      new_value: newValue,
      metadata,
    });
  } catch (error) {
    console.error('[RateCardService] Audit log error:', error);
  }
}

export async function getAuditLog(entityId?: string, limit: number = 50): Promise<RateCardAuditLog[]> {
  let query = supabase
    .from('rate_card_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (entityId) {
    query = query.eq('entity_id', entityId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[RateCardService] Error fetching audit log:', error);
    return [];
  }

  return data || [];
}

// ===== LOOKUP (for calculations) =====

export async function getRatesForJob(
  groupId: string,
  nextgenProfileId: string,
  linemanProfileId: string,
  investorProfileId: string
): Promise<Map<string, { nextgen: number; lineman: number; investor: number }>> {
  // Fetch all rates in parallel
  const [nextgenItems, linemanItems, investorItems] = await Promise.all([
    getItems(groupId, nextgenProfileId),
    getItems(groupId, linemanProfileId),
    getItems(groupId, investorProfileId),
  ]);

  // Build lookup map
  const ratesMap = new Map<string, { nextgen: number; lineman: number; investor: number }>();

  // Collect all codes
  const allCodes = new Set<string>();
  nextgenItems.forEach(i => allCodes.add(i.code));
  linemanItems.forEach(i => allCodes.add(i.code));
  investorItems.forEach(i => allCodes.add(i.code));

  // Build rate entries
  for (const code of allCodes) {
    const nextgen = nextgenItems.find(i => i.code === code);
    const lineman = linemanItems.find(i => i.code === code);
    const investor = investorItems.find(i => i.code === code);

    ratesMap.set(code, {
      nextgen: nextgen?.nextgen_rate || 0,
      lineman: lineman?.lineman_rate || 0,
      investor: investor?.truck_investor_rate || 0,
    });
  }

  return ratesMap;
}

// ===== LOCAL STORAGE FALLBACK =====

export function saveGroupsToLocal(groups: RateCardGroup[]): void {
  localStorage.setItem('rateCardGroups', JSON.stringify(groups));
}

export function saveProfilesToLocal(groupId: string, profiles: RateCardProfile[]): void {
  localStorage.setItem(`rateCardProfiles_${groupId}`, JSON.stringify(profiles));
}

export function saveItemsToLocal(profileId: string, items: RateCardItem[]): void {
  localStorage.setItem(`rateCardItems_${profileId}`, JSON.stringify(items));
}

export function getGroupsFromLocal(): RateCardGroup[] {
  const cached = localStorage.getItem('rateCardGroups');
  return cached ? JSON.parse(cached) : [];
}

export function getProfilesFromLocal(groupId: string): RateCardProfile[] {
  const cached = localStorage.getItem(`rateCardProfiles_${groupId}`);
  return cached ? JSON.parse(cached) : [];
}

export function getItemsFromLocal(profileId: string): RateCardItem[] {
  const cached = localStorage.getItem(`rateCardItems_${profileId}`);
  return cached ? JSON.parse(cached) : [];
}
