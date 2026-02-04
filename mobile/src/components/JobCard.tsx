/**
 * NextGen Fiber - JobCard Component
 * Card display for job list items
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { JobListItem } from '../types/jobs';
import { StatusBadge } from './StatusBadge';
import { PriorityIndicator } from './PriorityIndicator';

// ============================================
// TYPES
// ============================================

interface JobCardProps {
  job: JobListItem;
  onPress: (job: JobListItem) => void;
  showPendingIndicator?: boolean;
}

// ============================================
// HELPERS
// ============================================

function formatDate(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Agora';
  if (diffMins < 60) return `${diffMins}min`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return formatDate(dateString);
}

// ============================================
// COMPONENT
// ============================================

export function JobCard({
  job,
  onPress,
  showPendingIndicator = false,
}: JobCardProps): JSX.Element {
  const isDueSoon =
    job.dueDate && new Date(job.dueDate).getTime() - Date.now() < 86400000 * 2;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
        job.hasUnreadComments && styles.cardUnread,
      ]}
      onPress={() => onPress(job)}
    >
      {/* Header Row */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <PriorityIndicator priority={job.priority} />
          <Text style={styles.clientText}>{job.client}</Text>
        </View>
        <StatusBadge status={job.status} size="small" />
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        <Text style={styles.locationText} numberOfLines={1}>
          {job.city}, {job.state}
        </Text>
        <Text style={styles.oltText} numberOfLines={1}>
          OLT: {job.olt}
          {job.feederId && ` • Feeder: ${job.feederId}`}
          {job.runNumber && ` • Run: ${job.runNumber}`}
        </Text>
      </View>

      {/* Footer Row */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          {job.dueDate && (
            <Text style={[styles.dueText, isDueSoon && styles.dueSoon]}>
              Prazo: {formatDate(job.dueDate)}
            </Text>
          )}
          {job.submissionCount > 0 && (
            <Text style={styles.metaText}>
              {job.submissionCount} envio{job.submissionCount > 1 ? 's' : ''}
            </Text>
          )}
        </View>

        <View style={styles.footerRight}>
          {showPendingIndicator && (
            <View style={styles.pendingDot} />
          )}
          {job.hasUnreadComments && (
            <View style={styles.unreadDot} />
          )}
          <Text style={styles.timeText}>
            {formatRelativeTime(job.lastActivityAt)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardPressed: {
    backgroundColor: '#F9FAFB',
  },
  cardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clientText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
  },

  content: {
    marginBottom: 8,
  },
  locationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  oltText: {
    fontSize: 13,
    color: '#6B7280',
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  dueText: {
    fontSize: 12,
    color: '#6B7280',
  },
  dueSoon: {
    color: '#EF4444',
    fontWeight: '600',
  },
  metaText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  timeText: {
    fontSize: 12,
    color: '#9CA3AF',
  },

  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
});
