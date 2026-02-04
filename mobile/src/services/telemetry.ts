/**
 * NextGen Fiber - Telemetry Service
 * Tracks user events for analytics and debugging
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { TelemetryEvent } from '../types/jobs';

// ============================================
// CONSTANTS
// ============================================

const TELEMETRY_QUEUE_KEY = 'telemetry_queue';
const TELEMETRY_ENDPOINT = '/api/v1/telemetry/events';
const BATCH_SIZE = 50;
const FLUSH_INTERVAL = 60000; // 1 minute

// ============================================
// STATE
// ============================================

interface QueuedEvent {
  event: TelemetryEvent;
  timestamp: string;
  sessionId: string;
  userId: string | null;
}

let eventQueue: QueuedEvent[] = [];
let sessionId: string = generateSessionId();
let userId: string | null = null;
let flushTimer: NodeJS.Timeout | null = null;

// ============================================
// HELPERS
// ============================================

function generateSessionId(): string {
  return `ses_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================
// PUBLIC API
// ============================================

export function initTelemetry(currentUserId: string | null): void {
  userId = currentUserId;
  sessionId = generateSessionId();

  // Load persisted events
  loadPersistedEvents();

  // Start flush timer
  startFlushTimer();

  console.log('[Telemetry] Initialized', { sessionId, userId });
}

export function setTelemetryUser(newUserId: string | null): void {
  userId = newUserId;
}

export function trackEvent(event: TelemetryEvent): void {
  const queuedEvent: QueuedEvent = {
    event,
    timestamp: new Date().toISOString(),
    sessionId,
    userId,
  };

  eventQueue.push(queuedEvent);

  // Persist immediately
  persistEvents();

  // Log in dev
  if (__DEV__) {
    console.log('[Telemetry] Event tracked:', event.type, event);
  }

  // Flush if batch is full
  if (eventQueue.length >= BATCH_SIZE) {
    flushEvents();
  }
}

export async function flushEvents(): Promise<void> {
  if (eventQueue.length === 0) return;

  const eventsToSend = [...eventQueue];
  eventQueue = [];

  try {
    // In production, send to backend
    // For now, just log and clear
    if (__DEV__) {
      console.log('[Telemetry] Would flush', eventsToSend.length, 'events');
    } else {
      // TODO: Implement actual API call
      // await fetch(TELEMETRY_ENDPOINT, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ events: eventsToSend }),
      // });
    }

    // Clear persisted events on success
    await AsyncStorage.removeItem(TELEMETRY_QUEUE_KEY);
  } catch (error) {
    // Put events back in queue on failure
    eventQueue = [...eventsToSend, ...eventQueue];
    console.error('[Telemetry] Flush failed:', error);
  }
}

export function stopTelemetry(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }

  // Final flush
  flushEvents();
}

// ============================================
// INTERNAL
// ============================================

function startFlushTimer(): void {
  if (flushTimer) return;

  flushTimer = setInterval(() => {
    flushEvents();
  }, FLUSH_INTERVAL);
}

async function loadPersistedEvents(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(TELEMETRY_QUEUE_KEY);
    if (stored) {
      const persisted = JSON.parse(stored) as QueuedEvent[];
      eventQueue = [...persisted, ...eventQueue];
    }
  } catch (error) {
    console.error('[Telemetry] Failed to load persisted events:', error);
  }
}

async function persistEvents(): Promise<void> {
  try {
    await AsyncStorage.setItem(TELEMETRY_QUEUE_KEY, JSON.stringify(eventQueue));
  } catch (error) {
    console.error('[Telemetry] Failed to persist events:', error);
  }
}
