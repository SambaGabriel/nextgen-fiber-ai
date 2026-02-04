/**
 * Job Storage Service - Local storage for jobs assigned to linemen
 */

import { Job, JobStatus, WorkType } from '../types/project';

const STORAGE_KEY = 'fs_jobs';

// Generate unique ID
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 9);

// Generate job code
const generateJobCode = () => {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `JOB-${year}-${random}`;
};

// Get all jobs from storage
const getAll = (): Job[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

// Save all jobs to storage
const saveAll = (jobs: Job[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
};

// Get jobs assigned to a specific lineman
const getByLineman = (linemanId: string): Job[] => {
  return getAll().filter(job => job.assignedToId === linemanId);
};

// Get jobs by status
const getByStatus = (status: JobStatus): Job[] => {
  return getAll().filter(job => job.status === status);
};

// Get a single job by ID
const getById = (id: string): Job | undefined => {
  return getAll().find(job => job.id === id);
};

// Create a new job
const create = (data: Omit<Job, 'id' | 'jobCode' | 'createdAt' | 'updatedAt' | 'statusChangedAt'>): Job => {
  const jobs = getAll();
  const now = new Date().toISOString();

  const newJob: Job = {
    ...data,
    id: generateId(),
    jobCode: generateJobCode(),
    createdAt: now,
    updatedAt: now,
    statusChangedAt: now
  };

  jobs.push(newJob);
  saveAll(jobs);
  return newJob;
};

// Update a job
const update = (id: string, updates: Partial<Job>): Job | undefined => {
  const jobs = getAll();
  const index = jobs.findIndex(job => job.id === id);

  if (index === -1) return undefined;

  const updatedJob: Job = {
    ...jobs[index],
    ...updates,
    updatedAt: new Date().toISOString(),
    statusChangedAt: updates.status ? new Date().toISOString() : jobs[index].statusChangedAt
  };

  jobs[index] = updatedJob;
  saveAll(jobs);
  return updatedJob;
};

// Submit production data for a job
const submitProduction = (
  jobId: string,
  productionData: Job['productionData']
): Job | undefined => {
  return update(jobId, {
    status: JobStatus.SUBMITTED,
    productionData
  });
};

// Delete a job
const remove = (id: string): boolean => {
  const jobs = getAll();
  const filtered = jobs.filter(job => job.id !== id);

  if (filtered.length === jobs.length) return false;

  saveAll(filtered);
  return true;
};

// Get job statistics for a lineman
const getLinemanStats = (linemanId: string) => {
  const jobs = getByLineman(linemanId);

  return {
    total: jobs.length,
    assigned: jobs.filter(j => j.status === JobStatus.ASSIGNED).length,
    inProgress: jobs.filter(j => j.status === JobStatus.IN_PROGRESS).length,
    submitted: jobs.filter(j => j.status === JobStatus.SUBMITTED).length,
    completed: jobs.filter(j => j.status === JobStatus.COMPLETED).length,
    needsRevision: jobs.filter(j => j.status === JobStatus.NEEDS_REVISION).length
  };
};

// Initialize with sample jobs for demo
const initializeSampleJobs = (linemanId: string, linemanName: string) => {
  const existing = getAll();
  if (existing.length > 0) return; // Don't overwrite existing data

  const sampleJobs: Omit<Job, 'id' | 'jobCode' | 'createdAt' | 'updatedAt' | 'statusChangedAt'>[] = [
    {
      title: 'Fiber Installation - Oak Street',
      assignedToId: linemanId,
      assignedToName: linemanName,
      assignedById: 'supervisor-1',
      assignedByName: 'John Supervisor',
      assignedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      clientId: 'client-1',
      clientName: 'Brightspeed',
      workType: WorkType.AERIAL,
      location: {
        address: '1234 Oak Street',
        city: 'Charlotte',
        state: 'NC'
      },
      scheduledDate: new Date().toISOString().split('T')[0],
      estimatedFootage: 2500,
      supervisorNotes: 'Standard aerial installation. Watch for low-hanging power lines near poles 5-8. Customer expects completion by end of week.',
      status: JobStatus.ASSIGNED
    },
    {
      title: 'Overlash Project - Pine Avenue',
      assignedToId: linemanId,
      assignedToName: linemanName,
      assignedById: 'supervisor-1',
      assignedByName: 'John Supervisor',
      assignedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      clientId: 'client-2',
      clientName: 'AT&T',
      workType: WorkType.OVERLASH,
      location: {
        address: '567 Pine Avenue',
        city: 'Raleigh',
        state: 'NC'
      },
      scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      estimatedFootage: 1800,
      supervisorNotes: 'Overlash on existing strand. 144-count fiber. Coordinate with existing crews on site.',
      status: JobStatus.ASSIGNED
    },
    {
      title: 'Underground Extension - Maple Drive',
      assignedToId: linemanId,
      assignedToName: linemanName,
      assignedById: 'supervisor-1',
      assignedByName: 'John Supervisor',
      assignedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      clientId: 'client-1',
      clientName: 'Brightspeed',
      workType: WorkType.UNDERGROUND,
      location: {
        address: '890 Maple Drive',
        city: 'Durham',
        state: 'NC'
      },
      scheduledDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      estimatedFootage: 3200,
      supervisorNotes: 'Underground conduit already in place. Pull fiber through existing infrastructure. Check handholes for water damage before starting.',
      status: JobStatus.IN_PROGRESS
    }
  ];

  sampleJobs.forEach(job => create(job));
};

export const jobStorage = {
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
