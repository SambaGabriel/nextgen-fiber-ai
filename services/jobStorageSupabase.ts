/**
 * Job Storage Service - Supabase version
 * Real database storage for jobs
 */

import { supabase } from './supabase';
import { Job, JobStatus, WorkType } from '../types/project';

// Generate job code
const generateJobCode = () => {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `JOB-${year}-${random}`;
};

// Convert database row to Job type
const rowToJob = (row: any): Job => ({
  id: row.id,
  jobCode: row.job_code,
  title: row.title,
  assignedToId: row.assigned_to_id || '',
  assignedToName: row.assigned_to_name || 'Unassigned',
  assignedById: row.assigned_by_id || '',
  assignedByName: row.assigned_by_name || '',
  assignedAt: row.assigned_at,
  clientId: row.client_id || '',
  clientName: row.client_name || '',
  workType: row.work_type as WorkType,
  location: row.location || {},
  scheduledDate: row.scheduled_date,
  dueDate: row.due_date,
  estimatedFootage: row.estimated_footage,
  mapFile: row.map_file,
  supervisorNotes: row.supervisor_notes,
  status: row.status as JobStatus,
  statusChangedAt: row.status_changed_at,
  productionData: row.production_data,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

// Convert Job to database row
const jobToRow = (job: Partial<Job>) => ({
  job_code: job.jobCode,
  title: job.title,
  assigned_to_id: job.assignedToId === 'lineman-default' ? null : job.assignedToId || null,
  assigned_to_name: job.assignedToName,
  assigned_by_id: job.assignedById || null,
  assigned_by_name: job.assignedByName,
  assigned_at: job.assignedAt,
  client_id: job.clientId,
  client_name: job.clientName,
  work_type: job.workType,
  location: job.location,
  scheduled_date: job.scheduledDate,
  due_date: job.dueDate,
  estimated_footage: job.estimatedFootage,
  map_file: job.mapFile,
  supervisor_notes: job.supervisorNotes,
  status: job.status,
  status_changed_at: job.statusChangedAt,
  production_data: job.productionData
});

// Get all jobs
const getAll = async (): Promise<Job[]> => {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching jobs:', error);
    return [];
  }

  return (data || []).map(rowToJob);
};

// Get jobs by user (assigned to them or unassigned)
const getByLineman = async (userId: string): Promise<Job[]> => {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .or(`assigned_to_id.eq.${userId},assigned_to_id.is.null`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching lineman jobs:', error);
    return [];
  }

  return (data || []).map(rowToJob);
};

// Get jobs by status
const getByStatus = async (status: JobStatus): Promise<Job[]> => {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching jobs by status:', error);
    return [];
  }

  return (data || []).map(rowToJob);
};

// Get a single job by ID
const getById = async (id: string): Promise<Job | undefined> => {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching job:', error);
    return undefined;
  }

  return data ? rowToJob(data) : undefined;
};

// Create a new job
const create = async (jobData: Omit<Job, 'id' | 'jobCode' | 'createdAt' | 'updatedAt' | 'statusChangedAt'>): Promise<Job | null> => {
  const now = new Date().toISOString();

  const row = {
    ...jobToRow({
      ...jobData,
      jobCode: generateJobCode(),
      statusChangedAt: now
    }),
    job_code: generateJobCode()
  };

  const { data, error } = await supabase
    .from('jobs')
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error('Error creating job:', error);
    return null;
  }

  return data ? rowToJob(data) : null;
};

// Update a job
const update = async (id: string, updates: Partial<Job>): Promise<Job | undefined> => {
  const updateData: any = {};

  if (updates.title) updateData.title = updates.title;
  if (updates.assignedToId) updateData.assigned_to_id = updates.assignedToId;
  if (updates.assignedToName) updateData.assigned_to_name = updates.assignedToName;
  if (updates.status) {
    updateData.status = updates.status;
    updateData.status_changed_at = new Date().toISOString();
  }
  if (updates.productionData) updateData.production_data = updates.productionData;
  if (updates.supervisorNotes) updateData.supervisor_notes = updates.supervisorNotes;
  if (updates.location) updateData.location = updates.location;
  if (updates.scheduledDate) updateData.scheduled_date = updates.scheduledDate;
  if (updates.estimatedFootage) updateData.estimated_footage = updates.estimatedFootage;

  const { data, error } = await supabase
    .from('jobs')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating job:', error);
    return undefined;
  }

  return data ? rowToJob(data) : undefined;
};

// Submit production data
const submitProduction = async (
  jobId: string,
  productionData: Job['productionData']
): Promise<Job | undefined> => {
  return update(jobId, {
    status: JobStatus.SUBMITTED,
    productionData
  });
};

// Delete a job
const remove = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('jobs')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting job:', error);
    return false;
  }

  return true;
};

// Get job statistics for a lineman
const getLinemanStats = async (linemanId: string) => {
  const jobs = await getByLineman(linemanId);

  return {
    total: jobs.length,
    assigned: jobs.filter(j => j.status === JobStatus.ASSIGNED).length,
    inProgress: jobs.filter(j => j.status === JobStatus.IN_PROGRESS).length,
    submitted: jobs.filter(j => j.status === JobStatus.SUBMITTED).length,
    completed: jobs.filter(j => j.status === JobStatus.COMPLETED).length,
    needsRevision: jobs.filter(j => j.status === JobStatus.NEEDS_REVISION).length
  };
};

// No-op for compatibility (sample jobs not needed with real DB)
const initializeSampleJobs = (_linemanId: string, _linemanName: string) => {
  // Not needed with Supabase - real data only
};

export const jobStorageSupabase = {
  getAll,
  getByLineman,
  getByStatus,
  getById,
  create,
  update,
  submitProduction,
  remove,
  getLinemanStats,
  initializeSampleJobs
};
