/**
 * Chat Storage Service - Local storage for job chat messages
 * Handles messages, unread counts, and offline queue
 */

import { JobChatMessage, JobUnreadCount, MessageStatus } from '../types/project';

const MESSAGES_KEY = 'fs_job_messages';
const UNREAD_KEY = 'fs_job_unread';
const QUEUE_KEY = 'fs_message_queue';

// Generate unique ID
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 9);

// ============================================
// MESSAGES
// ============================================

// Get all messages for a job
const getMessages = (jobId: string): JobChatMessage[] => {
  try {
    const data = localStorage.getItem(MESSAGES_KEY);
    const allMessages: JobChatMessage[] = data ? JSON.parse(data) : [];
    return allMessages
      .filter(m => m.jobId === jobId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } catch {
    return [];
  }
};

// Get messages after a certain timestamp
const getMessagesAfter = (jobId: string, afterTimestamp: string): JobChatMessage[] => {
  const messages = getMessages(jobId);
  return messages.filter(m => new Date(m.createdAt).getTime() > new Date(afterTimestamp).getTime());
};

// Save a message
const saveMessage = (message: Omit<JobChatMessage, 'id' | 'createdAt' | 'status'>): JobChatMessage => {
  try {
    const data = localStorage.getItem(MESSAGES_KEY);
    const allMessages: JobChatMessage[] = data ? JSON.parse(data) : [];

    // Check for duplicate by clientMessageId (idempotency)
    if (message.clientMessageId) {
      const existing = allMessages.find(m => m.clientMessageId === message.clientMessageId);
      if (existing) return existing;
    }

    const newMessage: JobChatMessage = {
      ...message,
      id: generateId(),
      createdAt: new Date().toISOString(),
      status: 'SENT'
    };

    allMessages.push(newMessage);
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(allMessages));

    // Increment unread count for the other party
    incrementUnreadForOthers(message.jobId, message.senderUserId);

    return newMessage;
  } catch (error) {
    console.error('Failed to save message:', error);
    throw error;
  }
};

// Update message status
const updateMessageStatus = (messageId: string, status: MessageStatus): void => {
  try {
    const data = localStorage.getItem(MESSAGES_KEY);
    const allMessages: JobChatMessage[] = data ? JSON.parse(data) : [];
    const index = allMessages.findIndex(m => m.id === messageId);
    if (index !== -1) {
      allMessages[index].status = status;
      localStorage.setItem(MESSAGES_KEY, JSON.stringify(allMessages));
    }
  } catch (error) {
    console.error('Failed to update message status:', error);
  }
};

// ============================================
// UNREAD COUNTS
// ============================================

// Get unread counts for all jobs for a user
const getUnreadCounts = (userId: string): JobUnreadCount[] => {
  try {
    const data = localStorage.getItem(UNREAD_KEY);
    const allUnreads: Record<string, JobUnreadCount> = data ? JSON.parse(data) : {};

    // Filter by user
    const userKey = (jobId: string) => `${jobId}_${userId}`;
    const result: JobUnreadCount[] = [];

    for (const key of Object.keys(allUnreads)) {
      if (key.endsWith(`_${userId}`)) {
        result.push(allUnreads[key]);
      }
    }

    return result;
  } catch {
    return [];
  }
};

// Get unread count for a specific job and user
const getUnreadCount = (jobId: string, userId: string): number => {
  try {
    const data = localStorage.getItem(UNREAD_KEY);
    const allUnreads: Record<string, JobUnreadCount> = data ? JSON.parse(data) : {};
    const key = `${jobId}_${userId}`;
    return allUnreads[key]?.unreadCount || 0;
  } catch {
    return 0;
  }
};

// Increment unread count for users other than the sender
const incrementUnreadForOthers = (jobId: string, senderUserId: string): void => {
  try {
    const data = localStorage.getItem(UNREAD_KEY);
    const allUnreads: Record<string, JobUnreadCount> = data ? JSON.parse(data) : {};

    // Get all users who have interacted with this job
    const messagesData = localStorage.getItem(MESSAGES_KEY);
    const allMessages: JobChatMessage[] = messagesData ? JSON.parse(messagesData) : [];
    const jobMessages = allMessages.filter(m => m.jobId === jobId);

    // Get unique user IDs from job messages
    const userIds = new Set(jobMessages.map(m => m.senderUserId));

    // Also get from job storage (assigned lineman and supervisor)
    const jobsData = localStorage.getItem('fs_jobs');
    const jobs = jobsData ? JSON.parse(jobsData) : [];
    const job = jobs.find((j: any) => j.id === jobId);
    if (job) {
      userIds.add(job.assignedToId);
      userIds.add(job.assignedById);
    }

    // Increment unread for all users except sender
    for (const userId of userIds) {
      if (userId !== senderUserId) {
        const key = `${jobId}_${userId}`;
        if (!allUnreads[key]) {
          allUnreads[key] = { jobId, unreadCount: 0, lastReadAt: new Date().toISOString() };
        }
        allUnreads[key].unreadCount += 1;
      }
    }

    localStorage.setItem(UNREAD_KEY, JSON.stringify(allUnreads));
  } catch (error) {
    console.error('Failed to increment unread count:', error);
  }
};

// Mark messages as read for a job/user
const markAsRead = (jobId: string, userId: string): void => {
  try {
    const data = localStorage.getItem(UNREAD_KEY);
    const allUnreads: Record<string, JobUnreadCount> = data ? JSON.parse(data) : {};
    const key = `${jobId}_${userId}`;

    allUnreads[key] = {
      jobId,
      unreadCount: 0,
      lastReadAt: new Date().toISOString()
    };

    localStorage.setItem(UNREAD_KEY, JSON.stringify(allUnreads));
  } catch (error) {
    console.error('Failed to mark as read:', error);
  }
};

// ============================================
// OFFLINE QUEUE
// ============================================

interface QueuedMessage {
  id: string;
  jobId: string;
  senderUserId: string;
  senderName: string;
  senderRole: string;  // UserRole
  body: string;
  clientMessageId: string;
  queuedAt: string;
  retryCount: number;
  status: 'QUEUED' | 'SENDING' | 'FAILED';
}

// Get queued messages
const getQueuedMessages = (): QueuedMessage[] => {
  try {
    const data = localStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

// Add message to queue (for offline support)
const enqueueMessage = (message: Omit<QueuedMessage, 'id' | 'queuedAt' | 'retryCount' | 'status'>): QueuedMessage => {
  try {
    const queue = getQueuedMessages();
    const queuedMessage: QueuedMessage = {
      ...message,
      id: generateId(),
      queuedAt: new Date().toISOString(),
      retryCount: 0,
      status: 'QUEUED'
    };
    queue.push(queuedMessage);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    return queuedMessage;
  } catch (error) {
    console.error('Failed to enqueue message:', error);
    throw error;
  }
};

// Update queued message status
const updateQueuedMessage = (id: string, updates: Partial<QueuedMessage>): void => {
  try {
    const queue = getQueuedMessages();
    const index = queue.findIndex(m => m.id === id);
    if (index !== -1) {
      queue[index] = { ...queue[index], ...updates };
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    }
  } catch (error) {
    console.error('Failed to update queued message:', error);
  }
};

// Remove message from queue (after successful send)
const removeFromQueue = (id: string): void => {
  try {
    const queue = getQueuedMessages();
    const filtered = queue.filter(m => m.id !== id);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to remove from queue:', error);
  }
};

// Process queue - try to send all queued messages
const processQueue = async (): Promise<void> => {
  const queue = getQueuedMessages();

  for (const queuedMsg of queue) {
    if (queuedMsg.status === 'SENDING') continue;

    try {
      updateQueuedMessage(queuedMsg.id, { status: 'SENDING' });

      // In a real app, this would be an API call
      // For now, we just save locally
      saveMessage({
        jobId: queuedMsg.jobId,
        senderUserId: queuedMsg.senderUserId,
        senderName: queuedMsg.senderName,
        senderRole: queuedMsg.senderRole,
        body: queuedMsg.body,
        clientMessageId: queuedMsg.clientMessageId
      });

      removeFromQueue(queuedMsg.id);
    } catch (error) {
      updateQueuedMessage(queuedMsg.id, {
        status: 'FAILED',
        retryCount: queuedMsg.retryCount + 1
      });
    }
  }
};

// ============================================
// INITIALIZE WITH SAMPLE DATA
// ============================================

const initializeSampleMessages = (jobId: string, linemanId: string, linemanName: string): void => {
  const existingMessages = getMessages(jobId);
  if (existingMessages.length > 0) return;

  // Add some sample messages for demo
  const sampleMessages: Omit<JobChatMessage, 'id'>[] = [
    {
      jobId,
      senderUserId: 'supervisor-1',
      senderName: 'John Supervisor',
      senderRole: 'ADMIN',
      body: 'Hey, just a heads up - there are some low-hanging power lines near poles 5-8. Be careful and follow safety protocols.',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      status: 'SENT'
    },
    {
      jobId,
      senderUserId: 'supervisor-1',
      senderName: 'John Supervisor',
      senderRole: 'ADMIN',
      body: 'Also, the customer is expecting completion by Friday. Let me know if you run into any issues.',
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      status: 'SENT'
    }
  ];

  try {
    const data = localStorage.getItem(MESSAGES_KEY);
    const allMessages: JobChatMessage[] = data ? JSON.parse(data) : [];

    for (const msg of sampleMessages) {
      allMessages.push({
        ...msg,
        id: generateId()
      });
    }

    localStorage.setItem(MESSAGES_KEY, JSON.stringify(allMessages));

    // Set unread count for lineman
    const unreadData = localStorage.getItem(UNREAD_KEY);
    const allUnreads: Record<string, JobUnreadCount> = unreadData ? JSON.parse(unreadData) : {};
    const key = `${jobId}_${linemanId}`;
    allUnreads[key] = { jobId, unreadCount: 2, lastReadAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() };
    localStorage.setItem(UNREAD_KEY, JSON.stringify(allUnreads));
  } catch (error) {
    console.error('Failed to initialize sample messages:', error);
  }
};

export const chatStorage = {
  // Messages
  getMessages,
  getMessagesAfter,
  saveMessage,
  updateMessageStatus,

  // Unread counts
  getUnreadCounts,
  getUnreadCount,
  markAsRead,

  // Offline queue
  getQueuedMessages,
  enqueueMessage,
  updateQueuedMessage,
  removeFromQueue,
  processQueue,

  // Demo
  initializeSampleMessages
};
