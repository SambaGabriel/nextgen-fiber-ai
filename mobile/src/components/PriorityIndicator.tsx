/**
 * NextGen Fiber - PriorityIndicator Component
 * Visual indicator for job priority
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// ============================================
// TYPES
// ============================================

type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

interface PriorityIndicatorProps {
  priority: Priority;
  showLabel?: boolean;
}

// ============================================
// PRIORITY CONFIG
// ============================================

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; icon: string }> = {
  LOW: {
    label: 'Baixa',
    color: '#9CA3AF',
    icon: '↓',
  },
  NORMAL: {
    label: 'Normal',
    color: '#3B82F6',
    icon: '→',
  },
  HIGH: {
    label: 'Alta',
    color: '#F59E0B',
    icon: '↑',
  },
  URGENT: {
    label: 'Urgente',
    color: '#EF4444',
    icon: '⚡',
  },
};

// ============================================
// COMPONENT
// ============================================

export function PriorityIndicator({
  priority,
  showLabel = false,
}: PriorityIndicatorProps): JSX.Element {
  const config = PRIORITY_CONFIG[priority];

  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      {showLabel && (
        <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
      )}
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
  },
});
