/**
 * NextGen Fiber - OfflineIndicator Component
 * Shows network status and pending queue items
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useQueueStatus } from '../hooks/useOfflineQueue';

// ============================================
// TYPES
// ============================================

interface OfflineIndicatorProps {
  onPress?: () => void;
}

// ============================================
// COMPONENT
// ============================================

export function OfflineIndicator({ onPress }: OfflineIndicatorProps): JSX.Element | null {
  const { isOnline, isSyncing, pendingCount, failedCount } = useQueueStatus();

  // Don't show if online and no pending items
  if (isOnline && pendingCount === 0 && failedCount === 0) {
    return null;
  }

  const getStatusConfig = () => {
    if (!isOnline) {
      return {
        bg: '#FEF3C7',
        text: '#92400E',
        icon: '📡',
        message: 'Offline',
        subMessage: pendingCount > 0 ? `${pendingCount} na fila` : undefined,
      };
    }

    if (isSyncing) {
      return {
        bg: '#DBEAFE',
        text: '#1E40AF',
        icon: '🔄',
        message: 'Sincronizando...',
        subMessage: `${pendingCount} item${pendingCount > 1 ? 's' : ''}`,
      };
    }

    if (failedCount > 0) {
      return {
        bg: '#FEE2E2',
        text: '#991B1B',
        icon: '⚠️',
        message: `${failedCount} falhou`,
        subMessage: 'Toque para retry',
      };
    }

    if (pendingCount > 0) {
      return {
        bg: '#F3F4F6',
        text: '#374151',
        icon: '⏳',
        message: `${pendingCount} pendente${pendingCount > 1 ? 's' : ''}`,
        subMessage: undefined,
      };
    }

    return null;
  };

  const config = getStatusConfig();
  if (!config) return null;

  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      style={[styles.container, { backgroundColor: config.bg }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.icon}>{config.icon}</Text>
      <View style={styles.textContainer}>
        <Text style={[styles.message, { color: config.text }]}>
          {config.message}
        </Text>
        {config.subMessage && (
          <Text style={[styles.subMessage, { color: config.text }]}>
            {config.subMessage}
          </Text>
        )}
      </View>
    </Container>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  icon: {
    fontSize: 16,
  },
  textContainer: {
    flex: 1,
  },
  message: {
    fontSize: 13,
    fontWeight: '600',
  },
  subMessage: {
    fontSize: 11,
    opacity: 0.8,
  },
});
