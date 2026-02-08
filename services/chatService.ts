/**
 * Chat Service
 * Real-time job messaging with Supabase Realtime
 */

import { supabase } from './supabase';
import type { JobChatMessage, MessageStatus } from '../types/project';

// ===== TYPES =====

export interface ChatMessage {
  id: string;
  jobId: string;
  userId: string;
  userName: string;
  userRole: string;
  message: string;
  messageType: 'text' | 'system' | 'file' | 'image';
  fileUrl?: string;
  fileName?: string;
  clientMessageId?: string;
  createdAt: string;
  editedAt?: string;
  deletedAt?: string;
}

export interface SendMessageInput {
  jobId: string;
  userId: string;
  userName: string;
  userRole: string;
  message: string;
  messageType?: 'text' | 'file' | 'image';
  fileUrl?: string;
  fileName?: string;
  clientMessageId?: string;
}

export interface UnreadInfo {
  jobId: string;
  unreadCount: number;
  lastReadAt?: string;
}

// ===== MESSAGE CRUD =====

/**
 * Get messages for a job
 */
export async function getJobMessages(
  jobId: string,
  limit: number = 50,
  before?: string
): Promise<ChatMessage[]> {
  let query = supabase
    .from('job_messages')
    .select('*')
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[ChatService] Error fetching messages:', error);
    return [];
  }

  return (data || []).map(m => ({
    id: m.id,
    jobId: m.job_id,
    userId: m.user_id,
    userName: m.user_name,
    userRole: m.user_role,
    message: m.message,
    messageType: m.message_type || 'text',
    fileUrl: m.file_url,
    fileName: m.file_name,
    clientMessageId: m.client_message_id,
    createdAt: m.created_at,
    editedAt: m.edited_at,
    deletedAt: m.deleted_at
  })).reverse(); // Reverse to get chronological order
}

/**
 * Send a message to a job chat
 */
export async function sendMessage(input: SendMessageInput): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('job_messages')
    .insert({
      job_id: input.jobId,
      user_id: input.userId,
      user_name: input.userName,
      user_role: input.userRole,
      message: input.message,
      message_type: input.messageType || 'text',
      file_url: input.fileUrl,
      file_name: input.fileName,
      client_message_id: input.clientMessageId || generateClientId()
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: data.id,
    jobId: data.job_id,
    userId: data.user_id,
    userName: data.user_name,
    userRole: data.user_role,
    message: data.message,
    messageType: data.message_type,
    fileUrl: data.file_url,
    fileName: data.file_name,
    clientMessageId: data.client_message_id,
    createdAt: data.created_at
  };
}

/**
 * Delete a message (soft delete)
 */
export async function deleteMessage(messageId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('job_messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Edit a message
 */
export async function editMessage(messageId: string, userId: string, newMessage: string): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('job_messages')
    .update({
      message: newMessage,
      edited_at: new Date().toISOString()
    })
    .eq('id', messageId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: data.id,
    jobId: data.job_id,
    userId: data.user_id,
    userName: data.user_name,
    userRole: data.user_role,
    message: data.message,
    messageType: data.message_type,
    createdAt: data.created_at,
    editedAt: data.edited_at
  };
}

// ===== REALTIME SUBSCRIPTION =====

/**
 * Subscribe to new messages for a job
 */
export function subscribeToJobMessages(
  jobId: string,
  callback: (message: ChatMessage) => void
): () => void {
  const channel = supabase
    .channel(`job-messages-${jobId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'job_messages',
        filter: `job_id=eq.${jobId}`
      },
      (payload) => {
        const m = payload.new as any;
        callback({
          id: m.id,
          jobId: m.job_id,
          userId: m.user_id,
          userName: m.user_name,
          userRole: m.user_role,
          message: m.message,
          messageType: m.message_type || 'text',
          fileUrl: m.file_url,
          fileName: m.file_name,
          clientMessageId: m.client_message_id,
          createdAt: m.created_at
        });
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to message updates (edits/deletes)
 */
export function subscribeToMessageUpdates(
  jobId: string,
  callback: (message: ChatMessage) => void
): () => void {
  const channel = supabase
    .channel(`job-message-updates-${jobId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'job_messages',
        filter: `job_id=eq.${jobId}`
      },
      (payload) => {
        const m = payload.new as any;
        callback({
          id: m.id,
          jobId: m.job_id,
          userId: m.user_id,
          userName: m.user_name,
          userRole: m.user_role,
          message: m.message,
          messageType: m.message_type || 'text',
          createdAt: m.created_at,
          editedAt: m.edited_at,
          deletedAt: m.deleted_at
        });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ===== READ RECEIPTS =====

/**
 * Mark messages as read for a user
 */
export async function markMessagesAsRead(jobId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_messages_read', {
    p_job_id: jobId,
    p_user_id: userId
  });

  if (error) {
    console.error('[ChatService] Error marking messages read:', error);
  }
}

/**
 * Get unread count for a job
 */
export async function getUnreadCount(jobId: string, userId: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_unread_message_count', {
    p_job_id: jobId,
    p_user_id: userId
  });

  if (error) {
    console.error('[ChatService] Error getting unread count:', error);
    return 0;
  }

  return data || 0;
}

/**
 * Get unread counts for multiple jobs
 */
export async function getUnreadCounts(jobIds: string[], userId: string): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  // Batch RPC calls
  const promises = jobIds.map(async (jobId) => {
    const count = await getUnreadCount(jobId, userId);
    counts.set(jobId, count);
  });

  await Promise.all(promises);
  return counts;
}

// ===== SYSTEM MESSAGES =====

/**
 * Create a system message
 */
export async function createSystemMessage(
  jobId: string,
  message: string,
  userId?: string
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from('job_messages')
    .insert({
      job_id: jobId,
      user_id: userId || null,
      user_name: 'System',
      user_role: 'SYSTEM',
      message,
      message_type: 'system'
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: data.id,
    jobId: data.job_id,
    userId: data.user_id,
    userName: data.user_name,
    userRole: data.user_role,
    message: data.message,
    messageType: 'system',
    createdAt: data.created_at
  };
}

// ===== HELPERS =====

function generateClientId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Convert legacy JobChatMessage to ChatMessage
 */
export function convertLegacyMessage(legacy: JobChatMessage): ChatMessage {
  return {
    id: legacy.id,
    jobId: legacy.jobId,
    userId: legacy.senderUserId,
    userName: legacy.senderName,
    userRole: legacy.senderRole,
    message: legacy.body,
    messageType: 'text',
    clientMessageId: legacy.clientMessageId,
    createdAt: legacy.createdAt
  };
}

// ===== OFFLINE SUPPORT =====

interface QueuedMessage extends SendMessageInput {
  queuedAt: string;
  retryCount: number;
}

const MESSAGE_QUEUE_KEY = 'nextgen_message_queue';

/**
 * Queue a message for later sending (offline support)
 */
export function queueMessage(input: SendMessageInput): void {
  const queue = getMessageQueue();
  queue.push({
    ...input,
    clientMessageId: input.clientMessageId || generateClientId(),
    queuedAt: new Date().toISOString(),
    retryCount: 0
  });
  saveMessageQueue(queue);
}

/**
 * Get queued messages
 */
export function getMessageQueue(): QueuedMessage[] {
  const stored = localStorage.getItem(MESSAGE_QUEUE_KEY);
  return stored ? JSON.parse(stored) : [];
}

/**
 * Save message queue
 */
function saveMessageQueue(queue: QueuedMessage[]): void {
  localStorage.setItem(MESSAGE_QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Process queued messages (call when online)
 */
export async function processMessageQueue(): Promise<void> {
  const queue = getMessageQueue();
  const failed: QueuedMessage[] = [];

  for (const msg of queue) {
    try {
      await sendMessage(msg);
    } catch (error) {
      if (msg.retryCount < 3) {
        msg.retryCount++;
        failed.push(msg);
      }
      console.error('[ChatService] Failed to send queued message:', error);
    }
  }

  saveMessageQueue(failed);
}

/**
 * Check if a message is queued
 */
export function isMessageQueued(clientMessageId: string): boolean {
  const queue = getMessageQueue();
  return queue.some(m => m.clientMessageId === clientMessageId);
}

/**
 * Remove message from queue
 */
export function removeFromQueue(clientMessageId: string): void {
  const queue = getMessageQueue();
  const filtered = queue.filter(m => m.clientMessageId !== clientMessageId);
  saveMessageQueue(filtered);
}
