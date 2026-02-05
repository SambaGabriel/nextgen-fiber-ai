/**
 * Migration Service
 * Migrates data from localStorage to PostgreSQL via V2 API
 */

import { apiClientV2 } from './apiClientV2';
import { jobStorage } from './jobStorage';
import type { Job, JobStatus } from '../types/project';

// Migration status tracking
const MIGRATION_KEY = 'fs_migration_status';

interface MigrationStatus {
  version: number;
  jobsMigrated: boolean;
  jobsMigratedAt?: string;
  jobsMigratedCount?: number;
  mapsMigrated: boolean;
  mapsMigratedAt?: string;
  lastError?: string;
}

const CURRENT_MIGRATION_VERSION = 1;

/**
 * Get current migration status
 */
export const getMigrationStatus = (): MigrationStatus => {
  try {
    const stored = localStorage.getItem(MIGRATION_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('[Migration] Failed to read status:', e);
  }

  return {
    version: 0,
    jobsMigrated: false,
    mapsMigrated: false,
  };
};

/**
 * Save migration status
 */
const saveMigrationStatus = (status: MigrationStatus): void => {
  try {
    localStorage.setItem(MIGRATION_KEY, JSON.stringify(status));
  } catch (e) {
    console.warn('[Migration] Failed to save status:', e);
  }
};

/**
 * Check if migration is needed
 */
export const needsMigration = (): boolean => {
  const status = getMigrationStatus();
  return status.version < CURRENT_MIGRATION_VERSION || !status.jobsMigrated;
};

/**
 * Map localStorage JobStatus to V2 API status
 */
const mapJobStatus = (status: JobStatus | string): string => {
  const statusMap: Record<string, string> = {
    'assigned': 'assigned',
    'in_progress': 'in_progress',
    'submitted': 'submitted',
    'approved': 'approved',
    'needs_revision': 'needs_revision',
    'completed': 'completed',
  };
  return statusMap[status] || 'assigned';
};

/**
 * Map localStorage WorkType to V2 API work type
 */
const mapWorkType = (workType: string): string => {
  const typeMap: Record<string, string> = {
    'aerial': 'aerial',
    'underground': 'underground',
    'overlash': 'overlash',
    'mixed': 'mixed',
  };
  return typeMap[workType] || 'aerial';
};

/**
 * Migrate a single job to V2 API
 */
const migrateJob = async (job: Job): Promise<boolean> => {
  try {
    // Check if job already exists by code
    // Note: V2 API doesn't have a get-by-code endpoint,
    // so we'll create with a unique title that includes the old code

    const v2Job = await apiClientV2.createJob({
      title: job.title || `Migrated: ${job.jobCode}`,
      assignedToId: job.assignedToId || undefined,
      clientId: job.clientId || undefined,
      clientName: job.clientName || undefined,
      workType: mapWorkType(job.workType),
      location: job.location ? {
        address: job.location.address,
        city: job.location.city,
        state: job.location.state,
      } : undefined,
      scheduledDate: job.scheduledDate,
      estimatedFootage: job.estimatedFootage,
      supervisorNotes: `[Migrated from ${job.jobCode}] ${job.supervisorNotes || ''}`,
    });

    // If job has production data, submit it
    if (job.productionData && job.status === 'submitted') {
      await apiClientV2.submitProduction(v2Job.id, {
        totalFootage: job.productionData.totalFootage,
        anchorCount: job.productionData.anchorCount,
        coilCount: job.productionData.coilCount,
        snowshoeCount: job.productionData.snowshoeCount,
        entries: job.productionData.entries?.map(e => ({
          spanFeet: e.spanFeet,
          anchor: e.anchor,
          coil: e.coil,
          snowshoe: e.snowshoe,
        })),
      }, job.productionData.linemanNotes);
    } else if (job.status === 'in_progress') {
      // Update status to in_progress
      await apiClientV2.updateJobStatus(v2Job.id, 'in_progress');
    }

    console.log(`[Migration] Job ${job.jobCode} migrated as ${v2Job.job_code}`);
    return true;

  } catch (e) {
    console.error(`[Migration] Failed to migrate job ${job.jobCode}:`, e);
    return false;
  }
};

/**
 * Migrate all jobs from localStorage to V2 API
 */
export const migrateJobs = async (
  onProgress?: (migrated: number, total: number) => void
): Promise<{ success: number; failed: number }> => {
  const status = getMigrationStatus();

  if (status.jobsMigrated) {
    console.log('[Migration] Jobs already migrated');
    return { success: 0, failed: 0 };
  }

  // Check if user is authenticated
  if (!apiClientV2.isAuthenticated) {
    console.log('[Migration] User not authenticated, skipping migration');
    return { success: 0, failed: 0 };
  }

  const jobs = jobStorage.getAll();

  if (jobs.length === 0) {
    console.log('[Migration] No jobs to migrate');
    status.jobsMigrated = true;
    status.jobsMigratedAt = new Date().toISOString();
    status.jobsMigratedCount = 0;
    status.version = CURRENT_MIGRATION_VERSION;
    saveMigrationStatus(status);
    return { success: 0, failed: 0 };
  }

  console.log(`[Migration] Starting migration of ${jobs.length} jobs`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const migrated = await migrateJob(job);

    if (migrated) {
      success++;
    } else {
      failed++;
    }

    if (onProgress) {
      onProgress(i + 1, jobs.length);
    }
  }

  // Update migration status
  status.jobsMigrated = failed === 0;
  status.jobsMigratedAt = new Date().toISOString();
  status.jobsMigratedCount = success;
  status.version = failed === 0 ? CURRENT_MIGRATION_VERSION : status.version;
  if (failed > 0) {
    status.lastError = `${failed} jobs failed to migrate`;
  }
  saveMigrationStatus(status);

  console.log(`[Migration] Completed: ${success} success, ${failed} failed`);

  return { success, failed };
};

/**
 * Run migration on login
 */
export const runMigrationOnLogin = async (): Promise<void> => {
  if (!needsMigration()) {
    return;
  }

  console.log('[Migration] Running post-login migration...');

  try {
    const result = await migrateJobs();

    if (result.failed > 0) {
      console.warn(`[Migration] ${result.failed} items failed to migrate`);
    }
  } catch (e) {
    console.error('[Migration] Migration failed:', e);
    const status = getMigrationStatus();
    status.lastError = String(e);
    saveMigrationStatus(status);
  }
};

/**
 * Reset migration status (for testing)
 */
export const resetMigration = (): void => {
  localStorage.removeItem(MIGRATION_KEY);
  console.log('[Migration] Migration status reset');
};

export const migrationService = {
  getStatus: getMigrationStatus,
  needsMigration,
  migrateJobs,
  runOnLogin: runMigrationOnLogin,
  reset: resetMigration,
};

export default migrationService;
