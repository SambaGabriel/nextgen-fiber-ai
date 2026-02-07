/**
 * Job Notification Service
 * Tracks new job assignments for linemen
 * Shows badge on bell icon and My Jobs menu when new jobs are assigned
 */

const STORAGE_KEY = 'fs_seen_jobs';

// Get the list of job IDs the user has already seen
const getSeenJobIds = (userId: string): string[] => {
    try {
        const key = `${STORAGE_KEY}_${userId}`;
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

// Mark a job as seen
const markJobAsSeen = (userId: string, jobId: string): void => {
    const key = `${STORAGE_KEY}_${userId}`;
    const seen = getSeenJobIds(userId);
    if (!seen.includes(jobId)) {
        seen.push(jobId);
        localStorage.setItem(key, JSON.stringify(seen));
    }
};

// Mark multiple jobs as seen
const markAllJobsAsSeen = (userId: string, jobIds: string[]): void => {
    const key = `${STORAGE_KEY}_${userId}`;
    const seen = getSeenJobIds(userId);
    const updated = [...new Set([...seen, ...jobIds])];
    localStorage.setItem(key, JSON.stringify(updated));
};

// Get count of unseen jobs
const getUnseenCount = (userId: string, assignedJobIds: string[]): number => {
    const seen = getSeenJobIds(userId);
    return assignedJobIds.filter(id => !seen.includes(id)).length;
};

// Get list of unseen job IDs
const getUnseenJobIds = (userId: string, assignedJobIds: string[]): string[] => {
    const seen = getSeenJobIds(userId);
    return assignedJobIds.filter(id => !seen.includes(id));
};

// Check if a specific job is unseen
const isJobUnseen = (userId: string, jobId: string): boolean => {
    const seen = getSeenJobIds(userId);
    return !seen.includes(jobId);
};

// Clear all seen jobs (for testing/reset)
const clearSeenJobs = (userId: string): void => {
    const key = `${STORAGE_KEY}_${userId}`;
    localStorage.removeItem(key);
};

export const jobNotificationService = {
    getSeenJobIds,
    markJobAsSeen,
    markAllJobsAsSeen,
    getUnseenCount,
    getUnseenJobIds,
    isJobUnseen,
    clearSeenJobs
};
