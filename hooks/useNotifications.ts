/**
 * Real-time Notifications System
 * Uses Supabase Realtime to push updates to users
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

export type NotificationType =
  | 'JOB_ASSIGNED'
  | 'STATUS_CHANGED'
  | 'MESSAGE_RECEIVED'
  | 'PAYROLL_READY'
  | 'REDLINE_APPROVED';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
  userId: string;
}

export interface JobUpdate {
  id: string;
  jobId: string;
  type: 'message' | 'status_change' | 'assignment' | 'production';
  content: string;
  sender?: string;
  previousStatus?: string;
  newStatus?: string;
  timestamp: Date;
}

export interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearAll: () => Promise<void>;
  loading: boolean;
  error: Error | null;
}

export interface UseJobUpdatesResult {
  lastUpdate: JobUpdate | null;
  messages: JobUpdate[];
  statusChange: JobUpdate | null;
  loading: boolean;
  error: Error | null;
}

export interface UsePushNotificationsResult {
  permission: NotificationPermission | 'unsupported';
  requestPermission: () => Promise<NotificationPermission>;
  isSupported: boolean;
  sendTestNotification: () => void;
}

export interface ToastNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
  onClick?: () => void;
}

// ============================================================================
// Notification Message Templates
// ============================================================================

const NOTIFICATION_TEMPLATES: Record<NotificationType, (data: Record<string, unknown>) => { title: string; message: string }> = {
  JOB_ASSIGNED: (data) => ({
    title: 'New Job Assigned',
    message: `New job assigned: ${data.jobCode || 'Unknown'}`,
  }),
  STATUS_CHANGED: (data) => ({
    title: 'Job Status Updated',
    message: `Job ${data.jobCode || 'Unknown'} status: ${data.newStatus || 'Updated'}`,
  }),
  MESSAGE_RECEIVED: (data) => ({
    title: 'New Message',
    message: `New message from ${data.sender || 'Unknown'}`,
  }),
  PAYROLL_READY: () => ({
    title: 'Payroll Ready',
    message: 'Your pay stub is ready',
  }),
  REDLINE_APPROVED: (data) => ({
    title: 'Redlines Approved',
    message: `Redlines approved for ${data.jobCode || 'Unknown'}`,
  }),
};

// ============================================================================
// Toast State Management
// ============================================================================

type ToastListener = (toasts: ToastNotification[]) => void;

let toasts: ToastNotification[] = [];
const toastListeners: Set<ToastListener> = new Set();

function notifyToastListeners() {
  toastListeners.forEach((listener) => listener([...toasts]));
}

/**
 * Subscribe to toast state changes
 */
export function subscribeToToasts(listener: ToastListener): () => void {
  toastListeners.add(listener);
  listener([...toasts]);
  return () => {
    toastListeners.delete(listener);
  };
}

/**
 * Get current toasts
 */
export function getToasts(): ToastNotification[] {
  return [...toasts];
}

/**
 * Remove a specific toast
 */
export function removeToast(toastId: string): void {
  toasts = toasts.filter((t) => t.id !== toastId);
  notifyToastListeners();
}

/**
 * Clear all toasts
 */
export function clearAllToasts(): void {
  toasts = [];
  notifyToastListeners();
}

/**
 * Display toast notification
 * Auto-dismiss after duration (default 5 seconds)
 * Click to navigate (if onClick provided)
 */
export function showToast(notification: Omit<ToastNotification, 'id'> | Notification): string {
  const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const duration = 'duration' in notification ? notification.duration : 5000;

  const toast: ToastNotification = {
    id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    duration: duration ?? 5000,
    onClick: 'onClick' in notification ? notification.onClick : undefined,
  };

  toasts = [...toasts, toast];
  notifyToastListeners();

  // Auto-dismiss after duration
  if (toast.duration && toast.duration > 0) {
    setTimeout(() => {
      removeToast(id);
    }, toast.duration);
  }

  return id;
}

// ============================================================================
// useNotifications Hook
// ============================================================================

/**
 * Hook for subscribing to user-specific notifications
 * Uses Supabase Realtime to receive push updates
 */
export function useNotifications(userId: string | null): UseNotificationsResult {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Calculate unread count
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Fetch initial notifications
  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchError) {
        throw fetchError;
      }

      const formattedNotifications: Notification[] = (data || []).map((n: Record<string, unknown>) => ({
        id: n.id as string,
        type: n.type as NotificationType,
        title: n.title as string,
        message: n.message as string,
        data: n.data as Record<string, unknown> | undefined,
        read: n.read as boolean,
        createdAt: new Date(n.created_at as string),
        userId: n.user_id as string,
      }));

      setNotifications(formattedNotifications);
    } catch (err) {
      console.error('[useNotifications] Error fetching notifications:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch notifications'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    fetchNotifications();

    // Create channel for user-specific notifications
    const channelName = `notifications:user:${userId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const newRecord = payload.new as Record<string, unknown>;
          const newNotification: Notification = {
            id: newRecord.id as string,
            type: newRecord.type as NotificationType,
            title: newRecord.title as string,
            message: newRecord.message as string,
            data: newRecord.data as Record<string, unknown> | undefined,
            read: newRecord.read as boolean,
            createdAt: new Date(newRecord.created_at as string),
            userId: newRecord.user_id as string,
          };

          setNotifications((prev) => [newNotification, ...prev]);

          // Show toast for new notification
          showToast(newNotification);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const updatedRecord = payload.new as Record<string, unknown>;
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === updatedRecord.id
                ? {
                    ...n,
                    read: updatedRecord.read as boolean,
                    title: updatedRecord.title as string,
                    message: updatedRecord.message as string,
                  }
                : n
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const oldRecord = payload.old as Record<string, unknown>;
          setNotifications((prev) => prev.filter((n) => n.id !== oldRecord.id));
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, fetchNotifications]);

  // Mark single notification as read
  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!userId) return;

      try {
        const { error: updateError } = await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', notificationId)
          .eq('user_id', userId);

        if (updateError) {
          throw updateError;
        }

        // Optimistic update
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
        );
      } catch (err) {
        console.error('[useNotifications] Error marking as read:', err);
        setError(err instanceof Error ? err : new Error('Failed to mark notification as read'));
      }
    },
    [userId]
  );

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!userId) return;

    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (updateError) {
        throw updateError;
      }

      // Optimistic update
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error('[useNotifications] Error marking all as read:', err);
      setError(err instanceof Error ? err : new Error('Failed to mark all notifications as read'));
    }
  }, [userId]);

  // Clear all notifications
  const clearAll = useCallback(async () => {
    if (!userId) return;

    try {
      const { error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        throw deleteError;
      }

      setNotifications([]);
    } catch (err) {
      console.error('[useNotifications] Error clearing notifications:', err);
      setError(err instanceof Error ? err : new Error('Failed to clear notifications'));
    }
  }, [userId]);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
    loading,
    error,
  };
}

// ============================================================================
// useJobUpdates Hook
// ============================================================================

/**
 * Hook for subscribing to job-specific updates
 * Real-time chat messages and status change alerts
 */
export function useJobUpdates(jobId: string | null): UseJobUpdatesResult {
  const [messages, setMessages] = useState<JobUpdate[]>([]);
  const [statusChange, setStatusChange] = useState<JobUpdate | null>(null);
  const [lastUpdate, setLastUpdate] = useState<JobUpdate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Fetch initial job updates
  const fetchJobUpdates = useCallback(async () => {
    if (!jobId) {
      setMessages([]);
      setStatusChange(null);
      setLastUpdate(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch messages/updates for this job
      const { data, error: fetchError } = await supabase
        .from('job_updates')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (fetchError) {
        throw fetchError;
      }

      const formattedUpdates: JobUpdate[] = (data || []).map((u: Record<string, unknown>) => ({
        id: u.id as string,
        jobId: u.job_id as string,
        type: u.type as JobUpdate['type'],
        content: u.content as string,
        sender: u.sender as string | undefined,
        previousStatus: u.previous_status as string | undefined,
        newStatus: u.new_status as string | undefined,
        timestamp: new Date(u.created_at as string),
      }));

      const messageUpdates = formattedUpdates.filter((u) => u.type === 'message');
      const latestStatusChange = formattedUpdates
        .filter((u) => u.type === 'status_change')
        .pop() || null;

      setMessages(messageUpdates);
      setStatusChange(latestStatusChange);
      setLastUpdate(formattedUpdates[formattedUpdates.length - 1] || null);
    } catch (err) {
      console.error('[useJobUpdates] Error fetching job updates:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch job updates'));
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!jobId) {
      setMessages([]);
      setStatusChange(null);
      setLastUpdate(null);
      setLoading(false);
      return;
    }

    fetchJobUpdates();

    // Create channel for job-specific updates
    const channelName = `job_updates:${jobId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_updates',
          filter: `job_id=eq.${jobId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const newRecord = payload.new as Record<string, unknown>;
          const newUpdate: JobUpdate = {
            id: newRecord.id as string,
            jobId: newRecord.job_id as string,
            type: newRecord.type as JobUpdate['type'],
            content: newRecord.content as string,
            sender: newRecord.sender as string | undefined,
            previousStatus: newRecord.previous_status as string | undefined,
            newStatus: newRecord.new_status as string | undefined,
            timestamp: new Date(newRecord.created_at as string),
          };

          setLastUpdate(newUpdate);

          if (newUpdate.type === 'message') {
            setMessages((prev) => [...prev, newUpdate]);
          } else if (newUpdate.type === 'status_change') {
            setStatusChange(newUpdate);
          }
        }
      )
      // Also listen to job table changes for status updates
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          const oldRecord = payload.old as Record<string, unknown>;
          const newRecord = payload.new as Record<string, unknown>;

          // Check if status changed
          if (oldRecord.status !== newRecord.status) {
            const statusUpdate: JobUpdate = {
              id: `status-${Date.now()}`,
              jobId: jobId,
              type: 'status_change',
              content: `Status changed from ${oldRecord.status} to ${newRecord.status}`,
              previousStatus: oldRecord.status as string,
              newStatus: newRecord.status as string,
              timestamp: new Date(),
            };

            setStatusChange(statusUpdate);
            setLastUpdate(statusUpdate);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [jobId, fetchJobUpdates]);

  return {
    lastUpdate,
    messages,
    statusChange,
    loading,
    error,
  };
}

// ============================================================================
// usePushNotifications Hook
// ============================================================================

/**
 * Hook for browser push notifications
 * Request permission, register with Supabase, handle incoming pushes
 */
export function usePushNotifications(): UsePushNotificationsResult {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission;
  });

  const isSupported = typeof window !== 'undefined' && 'Notification' in window;

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!isSupported) {
      console.warn('[usePushNotifications] Notifications not supported');
      return 'denied';
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        // Register service worker for push notifications if available
        if ('serviceWorker' in navigator) {
          try {
            const registration = await navigator.serviceWorker.ready;
            console.log('[usePushNotifications] Service worker ready:', registration);

            // Could subscribe to push notifications here
            // const subscription = await registration.pushManager.subscribe({...});
            // await registerSubscriptionWithSupabase(subscription);
          } catch (err) {
            console.error('[usePushNotifications] Service worker registration failed:', err);
          }
        }
      }

      return result;
    } catch (err) {
      console.error('[usePushNotifications] Error requesting permission:', err);
      return 'denied';
    }
  }, [isSupported]);

  // Send a test notification
  const sendTestNotification = useCallback(() => {
    if (!isSupported || permission !== 'granted') {
      console.warn('[usePushNotifications] Cannot send notification - not permitted');
      return;
    }

    try {
      const notification = new Notification('NextGen Fiber AI', {
        body: 'Push notifications are working!',
        icon: '/favicon.ico',
        tag: 'test-notification',
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);
    } catch (err) {
      console.error('[usePushNotifications] Error sending test notification:', err);
    }
  }, [isSupported, permission]);

  // Listen for permission changes
  useEffect(() => {
    if (!isSupported) return;

    // Check permission periodically (some browsers don't have an event for this)
    const checkPermission = () => {
      const currentPermission = Notification.permission;
      if (currentPermission !== permission) {
        setPermission(currentPermission);
      }
    };

    const interval = setInterval(checkPermission, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [isSupported, permission]);

  return {
    permission,
    requestPermission,
    isSupported,
    sendTestNotification,
  };
}

// ============================================================================
// useToasts Hook
// ============================================================================

/**
 * Hook for managing toast notifications in components
 */
export function useToasts(): {
  toasts: ToastNotification[];
  showToast: typeof showToast;
  removeToast: typeof removeToast;
  clearAllToasts: typeof clearAllToasts;
} {
  const [currentToasts, setCurrentToasts] = useState<ToastNotification[]>([]);

  useEffect(() => {
    return subscribeToToasts(setCurrentToasts);
  }, []);

  return {
    toasts: currentToasts,
    showToast,
    removeToast,
    clearAllToasts,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a notification from type and data
 */
export function createNotification(
  type: NotificationType,
  data: Record<string, unknown> = {},
  userId: string
): Omit<Notification, 'id' | 'createdAt'> {
  const template = NOTIFICATION_TEMPLATES[type](data);

  return {
    type,
    title: template.title,
    message: template.message,
    data,
    read: false,
    userId,
  };
}

/**
 * Send a notification to a user (server-side helper)
 * This should typically be called from a Supabase Edge Function
 */
export async function sendNotification(
  userId: string,
  type: NotificationType,
  data: Record<string, unknown> = {}
): Promise<{ success: boolean; error?: Error }> {
  try {
    const template = NOTIFICATION_TEMPLATES[type](data);

    const { error: insertError } = await supabase.from('notifications').insert({
      user_id: userId,
      type,
      title: template.title,
      message: template.message,
      data,
      read: false,
    });

    if (insertError) {
      throw insertError;
    }

    return { success: true };
  } catch (err) {
    console.error('[sendNotification] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err : new Error('Failed to send notification'),
    };
  }
}

/**
 * Send a job update/message
 */
export async function sendJobUpdate(
  jobId: string,
  type: JobUpdate['type'],
  content: string,
  metadata: {
    sender?: string;
    previousStatus?: string;
    newStatus?: string;
  } = {}
): Promise<{ success: boolean; error?: Error }> {
  try {
    const { error: insertError } = await supabase.from('job_updates').insert({
      job_id: jobId,
      type,
      content,
      sender: metadata.sender,
      previous_status: metadata.previousStatus,
      new_status: metadata.newStatus,
    });

    if (insertError) {
      throw insertError;
    }

    return { success: true };
  } catch (err) {
    console.error('[sendJobUpdate] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err : new Error('Failed to send job update'),
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  useNotifications,
  useJobUpdates,
  usePushNotifications,
  useToasts,
  showToast,
  removeToast,
  clearAllToasts,
  createNotification,
  sendNotification,
  sendJobUpdate,
};
