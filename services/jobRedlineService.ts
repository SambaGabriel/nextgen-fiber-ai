/**
 * Job Redline Service
 * Handles document redlines attached to jobs (NOT rate card redlines)
 *
 * Workflow:
 * 1. Lineman submits production → Job status = "pending_redlines"
 * 2. Specialist uploads redline documents → Creates version v1, status = "uploaded"
 * 3. Specialist submits for review → status = "under_review"
 * 4. Client approves (with SR#) → status = "approved", SR saved to job
 * 5. OR Client rejects (with notes) → status = "rejected", specialist uploads v2
 */

import { supabase } from './supabase';
import { RedlineVersion, RedlineFile, RedlineStatus, JobStatus } from '../types/project';

// ============================================
// Types for service responses
// ============================================

interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// GET: Fetch redlines for a job
// ============================================

/**
 * Get all redline versions for a job, ordered by version number (newest first)
 */
export async function getJobRedlines(jobId: string): Promise<RedlineVersion[]> {
  const { data, error } = await supabase
    .from('job_redline_versions')
    .select(`
      *,
      files:job_redline_files(*)
    `)
    .eq('job_id', jobId)
    .order('version_number', { ascending: false });

  if (error) {
    console.error('[jobRedlineService] Error fetching redlines:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    jobId: row.job_id,
    versionNumber: row.version_number,
    files: (row.files || []).map((f: any) => ({
      id: f.id,
      redlineVersionId: f.redline_version_id,
      fileUrl: f.file_url,
      fileName: f.file_name,
      mimeType: f.mime_type,
      fileSize: f.file_size,
      uploadedAt: f.uploaded_at
    })),
    uploadedByUserId: row.uploaded_by_user_id,
    uploadedByName: row.uploaded_by_name,
    uploadedAt: row.uploaded_at,
    internalNotes: row.internal_notes,
    clientNotes: row.client_notes,
    reviewStatus: row.review_status as RedlineStatus,
    reviewedAt: row.reviewed_at,
    reviewedByUserId: row.reviewed_by_user_id,
    reviewedByName: row.reviewed_by_name,
    reviewerNotes: row.reviewer_notes
  }));
}

/**
 * Get a specific redline version by ID
 */
export async function getRedlineVersion(versionId: string): Promise<RedlineVersion | null> {
  const { data, error } = await supabase
    .from('job_redline_versions')
    .select(`
      *,
      files:job_redline_files(*)
    `)
    .eq('id', versionId)
    .single();

  if (error || !data) {
    console.error('[jobRedlineService] Error fetching version:', error);
    return null;
  }

  return {
    id: data.id,
    jobId: data.job_id,
    versionNumber: data.version_number,
    files: (data.files || []).map((f: any) => ({
      id: f.id,
      redlineVersionId: f.redline_version_id,
      fileUrl: f.file_url,
      fileName: f.file_name,
      mimeType: f.mime_type,
      fileSize: f.file_size,
      uploadedAt: f.uploaded_at
    })),
    uploadedByUserId: data.uploaded_by_user_id,
    uploadedByName: data.uploaded_by_name,
    uploadedAt: data.uploaded_at,
    internalNotes: data.internal_notes,
    clientNotes: data.client_notes,
    reviewStatus: data.review_status as RedlineStatus,
    reviewedAt: data.reviewed_at,
    reviewedByUserId: data.reviewed_by_user_id,
    reviewedByName: data.reviewed_by_name,
    reviewerNotes: data.reviewer_notes
  };
}

// ============================================
// CREATE: Upload new redline version
// ============================================

/**
 * Upload a new redline version with files
 * Files are stored as base64 data URLs in the database for simplicity
 */
export async function uploadRedlineVersion(
  jobId: string,
  files: Array<{ fileName: string; dataUrl: string; mimeType: string; fileSize: number }>,
  uploadedByUserId: string,
  uploadedByName: string,
  internalNotes?: string,
  clientNotes?: string
): Promise<ServiceResult<RedlineVersion>> {
  try {
    // 1. Get next version number
    const { data: versionData, error: versionError } = await supabase
      .rpc('get_next_job_redline_version', { p_job_id: jobId });

    if (versionError) {
      console.error('[jobRedlineService] Error getting version number:', versionError);
      return { success: false, error: 'Failed to get version number' };
    }

    const versionNumber = versionData || 1;

    // 2. Create version record
    const { data: version, error: insertError } = await supabase
      .from('job_redline_versions')
      .insert({
        job_id: jobId,
        version_number: versionNumber,
        uploaded_by_user_id: uploadedByUserId,
        uploaded_by_name: uploadedByName,
        internal_notes: internalNotes || null,
        client_notes: clientNotes || null,
        review_status: 'uploaded'
      })
      .select()
      .single();

    if (insertError || !version) {
      console.error('[jobRedlineService] Error creating version:', insertError);
      return { success: false, error: 'Failed to create redline version' };
    }

    // 3. Create file records
    const uploadedFiles: RedlineFile[] = [];

    for (const file of files) {
      const { data: fileRecord, error: fileError } = await supabase
        .from('job_redline_files')
        .insert({
          redline_version_id: version.id,
          file_url: file.dataUrl,
          file_name: file.fileName,
          mime_type: file.mimeType,
          file_size: file.fileSize
        })
        .select()
        .single();

      if (fileError) {
        console.error('[jobRedlineService] Error creating file record:', fileError);
        continue;
      }

      if (fileRecord) {
        uploadedFiles.push({
          id: fileRecord.id,
          redlineVersionId: fileRecord.redline_version_id,
          fileUrl: fileRecord.file_url,
          fileName: fileRecord.file_name,
          mimeType: fileRecord.mime_type,
          fileSize: fileRecord.file_size,
          uploadedAt: fileRecord.uploaded_at
        });
      }
    }

    console.log(`[jobRedlineService] Created redline v${versionNumber} for job ${jobId} with ${uploadedFiles.length} files`);

    // Update job status to redline_uploaded
    const { error: jobUpdateError } = await supabase
      .from('jobs')
      .update({
        status: 'redline_uploaded',
        redline_status: 'uploaded',
        last_redline_version_number: versionNumber
      })
      .eq('id', jobId);

    if (jobUpdateError) {
      console.error('[jobRedlineService] Error updating job status:', jobUpdateError);
    } else {
      console.log(`[jobRedlineService] Updated job ${jobId} status to redline_uploaded`);
    }

    return {
      success: true,
      data: {
        id: version.id,
        jobId: version.job_id,
        versionNumber: version.version_number,
        files: uploadedFiles,
        uploadedByUserId: version.uploaded_by_user_id,
        uploadedByName: version.uploaded_by_name,
        uploadedAt: version.uploaded_at,
        internalNotes: version.internal_notes,
        clientNotes: version.client_notes,
        reviewStatus: version.review_status as RedlineStatus
      }
    };
  } catch (error) {
    console.error('[jobRedlineService] Unexpected error:', error);
    return { success: false, error: 'Unexpected error uploading redline' };
  }
}

// ============================================
// SUBMIT: Send redline for client review
// ============================================

/**
 * Submit a redline version for client review
 * Changes status from "uploaded" to "under_review"
 */
export async function submitForReview(
  versionId: string,
  submittedByUserId: string,
  submittedByName: string,
  submittedByRole: string
): Promise<ServiceResult<void>> {
  try {
    // 1. Update version status
    const { error: versionError } = await supabase
      .from('job_redline_versions')
      .update({ review_status: 'under_review' })
      .eq('id', versionId);

    if (versionError) {
      console.error('[jobRedlineService] Error updating version:', versionError);
      return { success: false, error: 'Failed to update version status' };
    }

    // 2. Get job_id from version
    const { data: version } = await supabase
      .from('job_redline_versions')
      .select('job_id')
      .eq('id', versionId)
      .single();

    if (!version) {
      return { success: false, error: 'Version not found' };
    }

    // 3. Update job status
    const { error: jobError } = await supabase
      .from('jobs')
      .update({
        status: 'under_client_review',
        redline_status: 'under_review'
      })
      .eq('id', version.job_id);

    if (jobError) {
      console.error('[jobRedlineService] Error updating job:', jobError);
    }

    // 4. Create audit record
    await supabase
      .from('job_redline_reviews')
      .insert({
        redline_version_id: versionId,
        reviewer_user_id: submittedByUserId,
        reviewer_name: submittedByName,
        reviewer_role: submittedByRole,
        action: 'submit_for_review'
      });

    console.log(`[jobRedlineService] Submitted version ${versionId} for review`);
    return { success: true };
  } catch (error) {
    console.error('[jobRedlineService] Unexpected error:', error);
    return { success: false, error: 'Unexpected error submitting for review' };
  }
}

// ============================================
// APPROVE: Client approves redline (requires SR#)
// ============================================

/**
 * Approve a redline version - REQUIRES SR number
 */
export async function approveRedline(
  versionId: string,
  reviewerUserId: string,
  reviewerName: string,
  reviewerRole: string,
  srNumber: string
): Promise<ServiceResult<void>> {
  // Validate SR number requirement
  if (!srNumber || srNumber.trim() === '') {
    return { success: false, error: 'SR number is required for approval' };
  }

  try {
    // 1. Update version
    const { error: versionError } = await supabase
      .from('job_redline_versions')
      .update({
        review_status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by_user_id: reviewerUserId,
        reviewed_by_name: reviewerName
      })
      .eq('id', versionId);

    if (versionError) {
      console.error('[jobRedlineService] Error updating version:', versionError);
      return { success: false, error: 'Failed to approve version' };
    }

    // 2. Get job_id
    const { data: version } = await supabase
      .from('job_redline_versions')
      .select('job_id')
      .eq('id', versionId)
      .single();

    if (!version) {
      return { success: false, error: 'Version not found' };
    }

    // 3. Update job with approval status and SR number
    const { error: jobError } = await supabase
      .from('jobs')
      .update({
        status: 'approved',
        redline_status: 'approved',
        sr_number: srNumber.trim()
      })
      .eq('id', version.job_id);

    if (jobError) {
      console.error('[jobRedlineService] Error updating job:', jobError);
    }

    // 4. Create audit record
    await supabase
      .from('job_redline_reviews')
      .insert({
        redline_version_id: versionId,
        reviewer_user_id: reviewerUserId,
        reviewer_name: reviewerName,
        reviewer_role: reviewerRole,
        action: 'approve',
        sr_number: srNumber.trim()
      });

    console.log(`[jobRedlineService] Approved version ${versionId} with SR# ${srNumber}`);
    return { success: true };
  } catch (error) {
    console.error('[jobRedlineService] Unexpected error:', error);
    return { success: false, error: 'Unexpected error approving redline' };
  }
}

// ============================================
// REJECT: Client rejects redline (requires notes)
// ============================================

/**
 * Reject a redline version - REQUIRES rejection notes
 */
export async function rejectRedline(
  versionId: string,
  reviewerUserId: string,
  reviewerName: string,
  reviewerRole: string,
  notes: string
): Promise<ServiceResult<void>> {
  // Validate notes requirement
  if (!notes || notes.trim() === '') {
    return { success: false, error: 'Rejection notes are required' };
  }

  try {
    // 1. Update version
    const { error: versionError } = await supabase
      .from('job_redline_versions')
      .update({
        review_status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by_user_id: reviewerUserId,
        reviewed_by_name: reviewerName,
        reviewer_notes: notes.trim()
      })
      .eq('id', versionId);

    if (versionError) {
      console.error('[jobRedlineService] Error updating version:', versionError);
      return { success: false, error: 'Failed to reject version' };
    }

    // 2. Get job_id
    const { data: version } = await supabase
      .from('job_redline_versions')
      .select('job_id')
      .eq('id', versionId)
      .single();

    if (!version) {
      return { success: false, error: 'Version not found' };
    }

    // 3. Update job status
    const { error: jobError } = await supabase
      .from('jobs')
      .update({
        status: 'rejected',
        redline_status: 'rejected'
      })
      .eq('id', version.job_id);

    if (jobError) {
      console.error('[jobRedlineService] Error updating job:', jobError);
    }

    // 4. Create audit record
    await supabase
      .from('job_redline_reviews')
      .insert({
        redline_version_id: versionId,
        reviewer_user_id: reviewerUserId,
        reviewer_name: reviewerName,
        reviewer_role: reviewerRole,
        action: 'reject',
        notes: notes.trim()
      });

    console.log(`[jobRedlineService] Rejected version ${versionId}`);
    return { success: true };
  } catch (error) {
    console.error('[jobRedlineService] Unexpected error:', error);
    return { success: false, error: 'Unexpected error rejecting redline' };
  }
}

// ============================================
// AUDIT: Get review history
// ============================================

/**
 * Get all review records for a redline version
 */
export async function getRedlineReviews(versionId: string) {
  const { data, error } = await supabase
    .from('job_redline_reviews')
    .select('*')
    .eq('redline_version_id', versionId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[jobRedlineService] Error fetching reviews:', error);
    return [];
  }

  return data || [];
}

// ============================================
// EXPORT SERVICE
// ============================================

export const jobRedlineService = {
  getJobRedlines,
  getRedlineVersion,
  uploadRedlineVersion,
  submitForReview,
  approveRedline,
  rejectRedline,
  getRedlineReviews
};

export default jobRedlineService;
