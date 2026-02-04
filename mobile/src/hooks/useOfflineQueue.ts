/**
 * NextGen Fiber - useOfflineQueue Hook
 * React hook for accessing offline queue state
 */

import { useState, useEffect, useCallback } from 'react';
import {
  QueuedAction,
  CreateSubmissionPayload,
  CreateCommentPayload,
} from '../types/jobs';
import {
  subscribeToQueue,
  getQueueStatus,
  enqueueSubmission,
  enqueueComment,
  enqueueStartJob,
  retryFailed,
  retryAllFailed,
  removeFromQueue,
  getItemsForJob,
  hasPendingSubmissionForJob,
} from '../services/offlineQueue';

// ============================================
// TYPES
// ============================================

interface QueueStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
}

interface UseOfflineQueueReturn {
  queue: QueuedAction[];
  status: QueueStatus;

  // Actions
  submitProduction: (payload: CreateSubmissionPayload) => Promise<string>;
  submitComment: (payload: CreateCommentPayload) => Promise<string>;
  startJob: (jobId: string) => Promise<string>;

  // Retry/Remove
  retryItem: (actionId: string) => Promise<void>;
  retryAll: () => Promise<void>;
  removeItem: (actionId: string) => Promise<void>;

  // Helpers
  getJobItems: (jobId: string) => QueuedAction[];
  hasPendingSubmission: (jobId: string) => boolean;
}

// ============================================
// HOOK
// ============================================

export function useOfflineQueue(): UseOfflineQueueReturn {
  const [queue, setQueue] = useState<QueuedAction[]>([]);
  const [status, setStatus] = useState<QueueStatus>(getQueueStatus());

  // Subscribe to queue changes
  useEffect(() => {
    const unsubscribe = subscribeToQueue((updatedQueue) => {
      setQueue(updatedQueue);
      setStatus(getQueueStatus());
    });

    return unsubscribe;
  }, []);

  // Actions
  const submitProduction = useCallback(async (payload: CreateSubmissionPayload) => {
    return enqueueSubmission(payload);
  }, []);

  const submitComment = useCallback(async (payload: CreateCommentPayload) => {
    return enqueueComment(payload);
  }, []);

  const startJobAction = useCallback(async (jobId: string) => {
    return enqueueStartJob(jobId);
  }, []);

  const retryItem = useCallback(async (actionId: string) => {
    await retryFailed(actionId);
  }, []);

  const retryAll = useCallback(async () => {
    await retryAllFailed();
  }, []);

  const removeItem = useCallback(async (actionId: string) => {
    await removeFromQueue(actionId);
  }, []);

  // Helpers
  const getJobItems = useCallback((jobId: string) => {
    return getItemsForJob(jobId);
  }, []);

  const hasPendingSubmission = useCallback((jobId: string) => {
    return hasPendingSubmissionForJob(jobId);
  }, []);

  return {
    queue,
    status,
    submitProduction,
    submitComment,
    startJob: startJobAction,
    retryItem,
    retryAll,
    removeItem,
    getJobItems,
    hasPendingSubmission,
  };
}

// ============================================
// SELECTORS (for optimized re-renders)
// ============================================

export function useQueueStatus(): QueueStatus {
  const [status, setStatus] = useState<QueueStatus>(getQueueStatus());

  useEffect(() => {
    const unsubscribe = subscribeToQueue(() => {
      setStatus(getQueueStatus());
    });

    return unsubscribe;
  }, []);

  return status;
}

export function useJobQueue(jobId: string): QueuedAction[] {
  const [items, setItems] = useState<QueuedAction[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToQueue(() => {
      setItems(getItemsForJob(jobId));
    });

    return unsubscribe;
  }, [jobId]);

  return items;
}
