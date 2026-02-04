/**
 * Offline Sync Service
 * Handles data persistence and sync when connection is restored
 */

const SYNC_QUEUE_KEY = 'fs_sync_queue';
const OFFLINE_DATA_KEY = 'fs_offline_data';

export type SyncOperation = {
  id: string;
  type: 'production_submit' | 'photo_upload' | 'job_update' | 'checklist_complete';
  jobId: string;
  data: any;
  createdAt: string;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
};

// Generate unique ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Check if online
export const isOnline = (): boolean => navigator.onLine;

// Get sync queue
export const getSyncQueue = (): SyncOperation[] => {
  try {
    const data = localStorage.getItem(SYNC_QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

// Get pending count
export const getPendingSyncCount = (): number => {
  return getSyncQueue().filter(op => op.status === 'pending').length;
};

// Add operation to sync queue
export const queueOperation = (
  type: SyncOperation['type'],
  jobId: string,
  data: any
): SyncOperation => {
  const operation: SyncOperation = {
    id: generateId(),
    type,
    jobId,
    data,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    status: 'pending'
  };

  const queue = getSyncQueue();
  queue.push(operation);
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));

  // Dispatch event for UI updates
  window.dispatchEvent(new CustomEvent('syncQueueUpdated', { detail: { count: queue.length } }));

  return operation;
};

// Update operation status
const updateOperationStatus = (id: string, status: SyncOperation['status'], retryCount?: number): void => {
  const queue = getSyncQueue();
  const index = queue.findIndex(op => op.id === id);
  if (index !== -1) {
    queue[index].status = status;
    if (retryCount !== undefined) {
      queue[index].retryCount = retryCount;
    }
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  }
};

// Remove operation from queue
const removeOperation = (id: string): void => {
  const queue = getSyncQueue().filter(op => op.id !== id);
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent('syncQueueUpdated', { detail: { count: queue.length } }));
};

// Process single operation (simulated - would be API calls in production)
const processOperation = async (operation: SyncOperation): Promise<boolean> => {
  console.log(`[OfflineSync] Processing: ${operation.type} for job ${operation.jobId}`);

  // In a real app, this would make API calls
  // For now, we just simulate success and store locally
  switch (operation.type) {
    case 'production_submit':
      // Data is already in localStorage via jobStorage
      console.log('[OfflineSync] Production data synced');
      return true;

    case 'photo_upload':
      // Photos are stored as base64 in localStorage
      console.log('[OfflineSync] Photo synced');
      return true;

    case 'job_update':
      console.log('[OfflineSync] Job update synced');
      return true;

    case 'checklist_complete':
      console.log('[OfflineSync] Checklist synced');
      return true;

    default:
      return true;
  }
};

// Sync all pending operations
export const syncAll = async (): Promise<{ success: number; failed: number }> => {
  if (!isOnline()) {
    console.log('[OfflineSync] Cannot sync - offline');
    return { success: 0, failed: 0 };
  }

  const queue = getSyncQueue().filter(op => op.status === 'pending' || op.status === 'failed');
  let success = 0;
  let failed = 0;

  for (const operation of queue) {
    updateOperationStatus(operation.id, 'syncing');

    try {
      const result = await processOperation(operation);
      if (result) {
        removeOperation(operation.id);
        success++;
      } else {
        throw new Error('Sync failed');
      }
    } catch (error) {
      console.error(`[OfflineSync] Failed to sync operation ${operation.id}:`, error);
      updateOperationStatus(operation.id, 'failed', operation.retryCount + 1);
      failed++;
    }
  }

  // Dispatch completion event
  window.dispatchEvent(new CustomEvent('syncComplete', { detail: { success, failed } }));

  return { success, failed };
};

// Auto-sync when coming online
export const initOfflineSync = (): (() => void) => {
  const handleOnline = () => {
    console.log('[OfflineSync] Back online - starting sync');
    window.dispatchEvent(new CustomEvent('connectionRestored'));
    syncAll();
  };

  const handleOffline = () => {
    console.log('[OfflineSync] Gone offline');
    window.dispatchEvent(new CustomEvent('connectionLost'));
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Initial sync if online
  if (isOnline()) {
    const pendingCount = getPendingSyncCount();
    if (pendingCount > 0) {
      console.log(`[OfflineSync] Found ${pendingCount} pending operations, syncing...`);
      syncAll();
    }
  }

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
};

// Save data for offline use
export const saveOfflineData = (key: string, data: any): void => {
  try {
    const allData = JSON.parse(localStorage.getItem(OFFLINE_DATA_KEY) || '{}');
    allData[key] = {
      data,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(OFFLINE_DATA_KEY, JSON.stringify(allData));
  } catch (error) {
    console.error('[OfflineSync] Failed to save offline data:', error);
  }
};

// Get offline data
export const getOfflineData = (key: string): any | null => {
  try {
    const allData = JSON.parse(localStorage.getItem(OFFLINE_DATA_KEY) || '{}');
    return allData[key]?.data || null;
  } catch {
    return null;
  }
};

export const offlineSync = {
  isOnline,
  getSyncQueue,
  getPendingSyncCount,
  queueOperation,
  syncAll,
  init: initOfflineSync,
  saveData: saveOfflineData,
  getData: getOfflineData
};

export default offlineSync;
