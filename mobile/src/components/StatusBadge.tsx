/**
 * NextGen Fiber - StatusBadge Component
 * Visual indicator for job and submission statuses
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { JobStatus, SubmissionStatus } from '../types/jobs';

// ============================================
// TYPES
// ============================================

interface StatusBadgeProps {
  status: JobStatus | SubmissionStatus;
  size?: 'small' | 'medium' | 'large';
}

// ============================================
// STATUS CONFIG
// ============================================

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  // Job statuses
  [JobStatus.AVAILABLE]: {
    label: 'Disponível',
    bg: '#DBEAFE',
    text: '#1E40AF',
  },
  [JobStatus.IN_PROGRESS]: {
    label: 'Em Andamento',
    bg: '#FEF3C7',
    text: '#92400E',
  },
  [JobStatus.SUBMITTED]: {
    label: 'Enviado',
    bg: '#E0E7FF',
    text: '#3730A3',
  },
  [JobStatus.NEEDS_INFO]: {
    label: 'Precisa Info',
    bg: '#FEE2E2',
    text: '#991B1B',
  },
  [JobStatus.APPROVED]: {
    label: 'Aprovado',
    bg: '#D1FAE5',
    text: '#065F46',
  },
  [JobStatus.CLOSED]: {
    label: 'Fechado',
    bg: '#E5E7EB',
    text: '#374151',
  },
  [JobStatus.REJECTED]: {
    label: 'Rejeitado',
    bg: '#FEE2E2',
    text: '#991B1B',
  },

  // Submission statuses
  [SubmissionStatus.QUEUED]: {
    label: 'Na Fila',
    bg: '#F3F4F6',
    text: '#4B5563',
  },
  [SubmissionStatus.SENDING]: {
    label: 'Enviando...',
    bg: '#DBEAFE',
    text: '#1E40AF',
  },
  [SubmissionStatus.SENT]: {
    label: 'Enviado',
    bg: '#D1FAE5',
    text: '#065F46',
  },
  [SubmissionStatus.FAILED]: {
    label: 'Falhou',
    bg: '#FEE2E2',
    text: '#991B1B',
  },
};

// ============================================
// COMPONENT
// ============================================

export function StatusBadge({ status, size = 'medium' }: StatusBadgeProps): JSX.Element {
  const config = STATUS_CONFIG[status] || {
    label: status,
    bg: '#E5E7EB',
    text: '#374151',
  };

  const sizeStyles = {
    small: { paddingH: 6, paddingV: 2, fontSize: 10 },
    medium: { paddingH: 8, paddingV: 4, fontSize: 12 },
    large: { paddingH: 12, paddingV: 6, fontSize: 14 },
  };

  const { paddingH, paddingV, fontSize } = sizeStyles[size];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          paddingHorizontal: paddingH,
          paddingVertical: paddingV,
        },
      ]}
    >
      <Text style={[styles.text, { color: config.text, fontSize }]}>
        {config.label}
      </Text>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  badge: {
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '600',
  },
});
