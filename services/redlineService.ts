/**
 * Redline Service - Rate Card versioning and approval workflow
 */

import { supabase } from './supabase';
import {
  Redline,
  RedlineReview,
  RedlineChange,
  RedlineStatus,
  CreateRedlineRequest,
  ReviewRedlineRequest,
  RedlineStats
} from '../types/redline';

// Convert database row to Redline type
const rowToRedline = (row: any): Redline => ({
  id: row.id,
  sourceProfileId: row.source_profile_id,
  sourceGroupId: row.source_group_id,
  sourceProfileName: row.profile_name,
  sourceGroupName: row.group_name,
  versionNumber: row.version_number,
  versionLabel: row.version_label,
  proposedChanges: row.proposed_changes || [],
  changeSummary: row.change_summary,
  status: row.status as RedlineStatus,
  createdBy: row.created_by,
  createdByName: row.created_by_name,
  createdAt: row.created_at,
  submittedAt: row.submitted_at,
  submittedBy: row.submitted_by,
  reviewedAt: row.reviewed_at,
  reviewedBy: row.reviewed_by,
  reviewedByName: row.reviewed_by_name,
  reviewNotes: row.review_notes,
  appliedAt: row.applied_at,
  appliedBy: row.applied_by,
  srNumber: row.sr_number,
  srReference: row.sr_reference,
  isActive: row.is_active,
  metadata: row.metadata
});

// Convert database row to RedlineReview type
const rowToReview = (row: any): RedlineReview => ({
  id: row.id,
  redlineId: row.redline_id,
  reviewerId: row.reviewer_id,
  reviewerName: row.reviewer_name,
  reviewerRole: row.reviewer_role,
  action: row.action,
  notes: row.notes,
  createdAt: row.created_at
});

/**
 * Get all redlines with optional filters
 */
export const getRedlines = async (filters?: {
  status?: RedlineStatus;
  profileId?: string;
  groupId?: string;
}): Promise<Redline[]> => {
  let query = supabase
    .from('rate_card_redlines')
    .select(`
      *,
      profile:rate_card_profiles!source_profile_id(name),
      group:rate_card_groups!source_group_id(customer_name, region)
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.profileId) {
    query = query.eq('source_profile_id', filters.profileId);
  }
  if (filters?.groupId) {
    query = query.eq('source_group_id', filters.groupId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[RedlineService] Error fetching redlines:', error);
    throw error;
  }

  return (data || []).map(row => ({
    ...rowToRedline(row),
    sourceProfileName: row.profile?.name,
    sourceGroupName: row.group ? `${row.group.customer_name} - ${row.group.region}` : undefined
  }));
};

/**
 * Get a single redline by ID
 */
export const getRedlineById = async (id: string): Promise<Redline | null> => {
  const { data, error } = await supabase
    .from('rate_card_redlines')
    .select(`
      *,
      profile:rate_card_profiles!source_profile_id(name),
      group:rate_card_groups!source_group_id(customer_name, region)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('[RedlineService] Error fetching redline:', error);
    throw error;
  }

  return {
    ...rowToRedline(data),
    sourceProfileName: data.profile?.name,
    sourceGroupName: data.group ? `${data.group.customer_name} - ${data.group.region}` : undefined
  };
};

/**
 * Create a new redline (draft)
 */
export const createRedline = async (
  request: CreateRedlineRequest,
  userId: string,
  userName: string
): Promise<Redline> => {
  // Get next version number
  const { data: versionData } = await supabase.rpc('get_next_redline_version', {
    profile_id: request.sourceProfileId
  });
  const versionNumber = versionData || 1;

  const { data, error } = await supabase
    .from('rate_card_redlines')
    .insert({
      source_profile_id: request.sourceProfileId,
      source_group_id: request.sourceGroupId,
      version_number: versionNumber,
      version_label: request.versionLabel || `v${versionNumber}`,
      proposed_changes: request.proposedChanges,
      change_summary: request.changeSummary,
      sr_number: request.srNumber,
      sr_reference: request.srReference,
      status: 'draft',
      created_by: userId,
      created_by_name: userName,
      is_active: true
    })
    .select()
    .single();

  if (error) {
    console.error('[RedlineService] Error creating redline:', error);
    throw error;
  }

  return rowToRedline(data);
};

/**
 * Update a draft redline
 */
export const updateRedline = async (
  id: string,
  updates: Partial<{
    proposedChanges: RedlineChange[];
    changeSummary: string;
    versionLabel: string;
    srNumber: string;
    srReference: string;
  }>
): Promise<Redline> => {
  const updateData: any = {};
  if (updates.proposedChanges !== undefined) updateData.proposed_changes = updates.proposedChanges;
  if (updates.changeSummary !== undefined) updateData.change_summary = updates.changeSummary;
  if (updates.versionLabel !== undefined) updateData.version_label = updates.versionLabel;
  if (updates.srNumber !== undefined) updateData.sr_number = updates.srNumber;
  if (updates.srReference !== undefined) updateData.sr_reference = updates.srReference;

  const { data, error } = await supabase
    .from('rate_card_redlines')
    .update(updateData)
    .eq('id', id)
    .eq('status', 'draft') // Can only update drafts
    .select()
    .single();

  if (error) {
    console.error('[RedlineService] Error updating redline:', error);
    throw error;
  }

  return rowToRedline(data);
};

/**
 * Submit a redline for review
 */
export const submitRedline = async (id: string, userId: string): Promise<Redline> => {
  const { data, error } = await supabase
    .from('rate_card_redlines')
    .update({
      status: 'pending_review',
      submitted_at: new Date().toISOString(),
      submitted_by: userId
    })
    .eq('id', id)
    .eq('status', 'draft')
    .select()
    .single();

  if (error) {
    console.error('[RedlineService] Error submitting redline:', error);
    throw error;
  }

  return rowToRedline(data);
};

/**
 * Review a redline (approve, reject, or request changes)
 */
export const reviewRedline = async (
  request: ReviewRedlineRequest,
  reviewerId: string,
  reviewerName: string,
  reviewerRole: string
): Promise<Redline> => {
  // First, add the review record
  const { error: reviewError } = await supabase
    .from('redline_reviews')
    .insert({
      redline_id: request.redlineId,
      reviewer_id: reviewerId,
      reviewer_name: reviewerName,
      reviewer_role: reviewerRole,
      action: request.action,
      notes: request.notes
    });

  if (reviewError) {
    console.error('[RedlineService] Error adding review:', reviewError);
    throw reviewError;
  }

  // Determine new status based on action
  let newStatus: RedlineStatus;
  switch (request.action) {
    case 'approve':
      newStatus = 'approved';
      break;
    case 'reject':
      newStatus = 'rejected';
      break;
    case 'request_changes':
      newStatus = 'draft'; // Back to draft for changes
      break;
    default:
      // Comment doesn't change status
      const { data } = await supabase
        .from('rate_card_redlines')
        .select()
        .eq('id', request.redlineId)
        .single();
      return rowToRedline(data);
  }

  // Update redline status
  const { data, error } = await supabase
    .from('rate_card_redlines')
    .update({
      status: newStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewerId,
      reviewed_by_name: reviewerName,
      review_notes: request.notes
    })
    .eq('id', request.redlineId)
    .select()
    .single();

  if (error) {
    console.error('[RedlineService] Error updating redline status:', error);
    throw error;
  }

  return rowToRedline(data);
};

/**
 * Apply an approved redline to the rate card
 */
export const applyRedline = async (id: string, userId: string): Promise<Redline> => {
  // Use the database function to apply changes
  const { data: success, error: applyError } = await supabase.rpc('apply_redline_changes', {
    redline_id: id,
    applied_by_user: userId
  });

  if (applyError) {
    console.error('[RedlineService] Error applying redline:', applyError);
    throw applyError;
  }

  // Fetch the updated redline
  const redline = await getRedlineById(id);
  if (!redline) {
    throw new Error('Redline not found after application');
  }

  return redline;
};

/**
 * Get reviews for a redline
 */
export const getRedlineReviews = async (redlineId: string): Promise<RedlineReview[]> => {
  const { data, error } = await supabase
    .from('redline_reviews')
    .select('*')
    .eq('redline_id', redlineId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[RedlineService] Error fetching reviews:', error);
    throw error;
  }

  return (data || []).map(rowToReview);
};

/**
 * Delete a draft redline
 */
export const deleteRedline = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('rate_card_redlines')
    .update({ is_active: false })
    .eq('id', id)
    .eq('status', 'draft'); // Can only delete drafts

  if (error) {
    console.error('[RedlineService] Error deleting redline:', error);
    throw error;
  }
};

/**
 * Get redline stats for dashboard
 */
export const getRedlineStats = async (): Promise<RedlineStats> => {
  const { data, error } = await supabase
    .from('rate_card_redlines')
    .select('status')
    .eq('is_active', true);

  if (error) {
    console.error('[RedlineService] Error fetching stats:', error);
    throw error;
  }

  const stats: RedlineStats = {
    totalRedlines: data?.length || 0,
    draftCount: data?.filter(r => r.status === 'draft').length || 0,
    pendingReviewCount: data?.filter(r => r.status === 'pending_review').length || 0,
    approvedCount: data?.filter(r => r.status === 'approved').length || 0,
    rejectedCount: data?.filter(r => r.status === 'rejected').length || 0,
    appliedCount: data?.filter(r => r.status === 'applied').length || 0,
    recentActivity: []
  };

  // Get recent reviews
  const { data: reviews } = await supabase
    .from('redline_reviews')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  stats.recentActivity = (reviews || []).map(rowToReview);

  return stats;
};

export const redlineService = {
  getRedlines,
  getRedlineById,
  createRedline,
  updateRedline,
  submitRedline,
  reviewRedline,
  applyRedline,
  getRedlineReviews,
  deleteRedline,
  getRedlineStats
};
