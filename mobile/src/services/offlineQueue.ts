/**
 * NextGen Fiber - Offline Queue Service
 * Handles offline-first data submission with automatic retry
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { v4 as uuidv4 } from 'uuid';
import {
  QueuedAction,
  SubmissionStatus,
  CreateSubmissionPayload,
  CreateCommentPayload,
} from '../types/jobs';
import {
  createSubmission,
  createComment,
  startJob,
  ApiError,
} from '../api/jobsApi';
import { trackEvent } from './telemetry';

// ============================================
// CONSTANTS
// ============================================

const QUEUE_STORAGE_KEY = 'offline_queue';
const MAX_RETRIES = 5;
const RETRY_DELAYS = [1000, 5000, 15000, 60000, 300000]; // 1s, 5s, 15s, 1m, 5m

// ============================================
// QUEUE STATE
// ============================================

type QueueListener = (queue: QueuedAction[]) => void;

let queue: QueuedAction[] = [];
let listeners: Set<QueueListener> = new Set();
let isSyncing = false;
let isOnline = true;
let syncInterval: NodeJS.Timeout | null = null;

// ============================================
// INITIALIZATION
// ============================================

export async function initOfflineQueue(): Promise<void> {
  // Load persisted queue
  try {
    const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    if (stored) {
      queue = JSON.parse(stored);
      // Reset any "SENDING" items back to "QUEUED" (app crashed during send)
      queue = queue.map((item) =>
        item.status === SubmissionStatus.SENDING
          ? { ...item, status: SubmissionStatus.QUEUED }
          : item
      );
      await persistQueue();
    }
  } catch (error) {
    console.error('[OfflineQueue] Failed to load queue:', error);
    queue = [];
  }

  // Listen to network state
  NetInfo.addEventListener(handleNetworkChange);

  // Check initial network state
  const state = await NetInfo.fetch();
  isOnline = state.isConnected ?? false;

  // Start sync loop
  startSyncLoop();

  notifyListeners();
}

function handleNetworkChange(state: NetInfoState): void {
  const wasOffline = !isOnline;
  isOnline = state.isConnected ?? false;

  console.log('[OfflineQueue] Network changed:', isOnline ? 'ONLINE' : 'OFFLINE');

  // If we just came online, trigger immediate sync
  if (wasOffline && isOnline) {
    processQueue();
  }

  notifyListeners();
}

// ============================================
// QUEUE MANAGEMENT
// ============================================

export function subscribeToQueue(listener: QueueListener): () => void {
  listeners.add(listener);
  listener(queue); // Immediate callback with current state
  return () => listeners.delete(listener);
}

function notifyListeners(): void {
  listeners.forEach((listener) => listener([...queue]));
}

async function persistQueue(): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('[OfflineQueue] Failed to persist queue:', error);
  }
}

export function getQueueStatus(): {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  failedCount: number;
} {
  return {
    isOnline,
    isSyncing,
    pendingCount: queue.filter(
      (i) => i.status === SubmissionStatus.QUEUED || i.status === SubmissionStatus.SENDING
    ).length,
    failedCount: queue.filter((i) => i.status === SubmissionStatus.FAILED).length,
  };
}

export function getQueuedItems(): QueuedAction[] {
  return [...queue];
}

// ============================================
// ENQUEUE ACTIONS
// ============================================

export async function enqueueSubmission(
  payload: CreateSubmissionPayload
): Promise<string> {
  const action: QueuedAction = {
    id: uuidv4(),
    type: 'SUBMISSION',
    payload,
    status: SubmissionStatus.QUEUED,
    error: null,
    retryCount: 0,
    maxRetries: MAX_RETRIES,
    createdAt: new Date().toISOString(),
    lastAttemptAt: null,
  };

  queue.push(action);
  await persistQueue();
  notifyListeners();

  // Try to sync immediately if online
  if (isOnline && !isSyncing) {
    processQueue();
  }

  trackEvent({
    type: 'SUBMISSION_SENT',
    jobId: payload.jobId,
    offline: !isOnline,
  });

  return action.id;
}

export async function enqueueComment(
  payload: CreateCommentPayload
): Promise<string> {
  const action: QueuedAction = {
    id: uuidv4(),
    type: 'COMMENT',
    payload,
    status: SubmissionStatus.QUEUED,
    error: null,
    retryCount: 0,
    maxRetries: MAX_RETRIES,
    createdAt: new Date().toISOString(),
    lastAttemptAt: null,
  };

  queue.push(action);
  await persistQueue();
  notifyListeners();

  if (isOnline && !isSyncing) {
    processQueue();
  }

  trackEvent({
    type: 'COMMENT_SENT',
    jobId: payload.jobId,
    offline: !isOnline,
  });

  return action.id;
}

export async function enqueueStartJob(jobId: string): Promise<string> {
  const action: QueuedAction = {
    id: uuidv4(),
    type: 'START_JOB',
    payload: { jobId },
    status: SubmissionStatus.QUEUED,
    error: null,
    retryCount: 0,
    maxRetries: MAX_RETRIES,
    createdAt: new Date().toISOString(),
    lastAttemptAt: null,
  };

  queue.push(action);
  await persistQueue();
  notifyListeners();

  if (isOnline && !isSyncing) {
    processQueue();
  }

  return action.id;
}

// ============================================
// RETRY FAILED ITEMS
// ============================================

export async function retryFailed(actionId: string): Promise<void> {
  const index = queue.findIndex((i) => i.id === actionId);
  if (index === -1) return;

  queue[index] = {
    ...queue[index],
    status: SubmissionStatus.QUEUED,
    error: null,
    retryCount: 0,
  };

  await persistQueue();
  notifyListeners();

  if (isOnline && !isSyncing) {
    processQueue();
  }
}

export async function retryAllFailed(): Promise<void> {
  queue = queue.map((item) =>
    item.status === SubmissionStatus.FAILED
      ? { ...item, status: SubmissionStatus.QUEUED, error: null, retryCount: 0 }
      : item
  );

  await persistQueue();
  notifyListeners();

  if (isOnline && !isSyncing) {
    processQueue();
  }
}

export async function removeFromQueue(actionId: string): Promise<void> {
  queue = queue.filter((i) => i.id !== actionId);
  await persistQueue();
  notifyListeners();
}

// ============================================
// SYNC LOOP
// ============================================

function startSyncLoop(): void {
  if (syncInterval) return;

  // Check queue every 30 seconds
  syncInterval = setInterval(() => {
    if (isOnline && !isSyncing && queue.some((i) => i.status === SubmissionStatus.QUEUED)) {
      processQueue();
    }
  }, 30000);
}

export function stopSyncLoop(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

async function processQueue(): Promise<void> {
  if (isSyncing || !isOnline) return;

  const pendingItems = queue.filter((i) => i.status === SubmissionStatus.QUEUED);
  if (pendingItems.length === 0) return;

  isSyncing = true;
  notifyListeners();

  console.log(`[OfflineQueue] Processing ${pendingItems.length} items...`);

  let successCount = 0;

  for (const item of pendingItems) {
    // Update status to SENDING
    updateItemStatus(item.id, SubmissionStatus.SENDING);

    try {
      await processItem(item);
      // Remove from queue on success
      queue = queue.filter((i) => i.id !== item.id);
      successCount++;
      console.log(`[OfflineQueue] Item ${item.id} sent successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const newRetryCount = item.retryCount + 1;

      if (newRetryCount >= item.maxRetries) {
        // Mark as failed after max retries
        updateItemStatus(item.id, SubmissionStatus.FAILED, errorMessage, newRetryCount);
        console.error(`[OfflineQueue] Item ${item.id} failed permanently:`, errorMessage);

        if (item.type === 'SUBMISSION') {
          trackEvent({
            type: 'SUBMISSION_FAILED',
            jobId: (item.payload as CreateSubmissionPayload).jobId,
            error: errorMessage,
          });
        }
      } else {
        // Schedule retry with backoff
        updateItemStatus(item.id, SubmissionStatus.QUEUED, errorMessage, newRetryCount);
        console.log(
          `[OfflineQueue] Item ${item.id} will retry (${newRetryCount}/${item.maxRetries})`
        );
      }
    }
  }

  await persistQueue();
  isSyncing = false;
  notifyListeners();

  if (successCount > 0) {
    trackEvent({ type: 'OFFLINE_QUEUE_SYNCED', count: successCount });
  }
}

function updateItemStatus(
  id: string,
  status: SubmissionStatus,
  error: string | null = null,
  retryCount?: number
): void {
  queue = queue.map((item) =>
    item.id === id
      ? {
          ...item,
          status,
          error,
          retryCount: retryCount ?? item.retryCount,
          lastAttemptAt: new Date().toISOString(),
        }
      : item
  );
  notifyListeners();
}

async function processItem(item: QueuedAction): Promise<void> {
  switch (item.type) {
    case 'SUBMISSION': {
      const payload = item.payload as CreateSubmissionPayload;
      await createSubmission(
        payload.jobId,
        {
          completionDate: payload.completionDate,
          formData: payload.formData,
        },
        item.id // Use local ID as idempotency key
      );
      break;
    }

    case 'COMMENT': {
      const payload = item.payload as CreateCommentPayload;
      await createComment(
        payload.jobId,
        { text: payload.text },
        item.id
      );
      break;
    }

    case 'START_JOB': {
      const payload = item.payload as { jobId: string };
      await startJob(payload.jobId);
      break;
    }

    default:
      throw new Error(`Unknown action type: ${(item as any).type}`);
  }
}

// ============================================
// HELPERS
// ============================================

export function getItemsForJob(jobId: string): QueuedAction[] {
  return queue.filter((item) => {
    const payload = item.payload as { jobId?: string };
    return payload.jobId === jobId;
  });
}

export function hasPendingSubmissionForJob(jobId: string): boolean {
  return queue.some(
    (item) =>
      item.type === 'SUBMISSION' &&
      (item.payload as CreateSubmissionPayload).jobId === jobId &&
      (item.status === SubmissionStatus.QUEUED || item.status === SubmissionStatus.SENDING)
  );
}
