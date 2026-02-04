/**
 * NextGen Fiber - SubmissionsList Component
 * List of production submissions for a job
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { ProductionSubmission, SubmissionStatus } from '../types/jobs';
import { StatusBadge } from './StatusBadge';

// ============================================
// TYPES
// ============================================

interface SubmissionsListProps {
  submissions: ProductionSubmission[];
  onRetry?: (submissionId: string) => void;
  onViewDetails?: (submission: ProductionSubmission) => void;
}

// ============================================
// HELPERS
// ============================================

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================
// SUBMISSION ITEM
// ============================================

interface SubmissionItemProps {
  submission: ProductionSubmission;
  onRetry?: (submissionId: string) => void;
  onViewDetails?: (submission: ProductionSubmission) => void;
}

function SubmissionItem({
  submission,
  onRetry,
  onViewDetails,
}: SubmissionItemProps): JSX.Element {
  const isFailed = submission.syncStatus === SubmissionStatus.FAILED;
  const isPending =
    submission.syncStatus === SubmissionStatus.QUEUED ||
    submission.syncStatus === SubmissionStatus.SENDING;

  return (
    <TouchableOpacity
      style={styles.item}
      onPress={() => onViewDetails?.(submission)}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.itemHeader}>
        <View style={styles.itemHeaderLeft}>
          <Text style={styles.dateText}>
            Conclusão: {formatDate(submission.completionDate)}
          </Text>
          <StatusBadge status={submission.syncStatus} size="small" />
        </View>
        {isFailed && onRetry && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => onRetry(submission.id)}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Form Data Preview */}
      <View style={styles.formDataPreview}>
        {Object.entries(submission.formData)
          .slice(0, 3)
          .map(([key, value]) => (
            <View key={key} style={styles.dataRow}>
              <Text style={styles.dataKey}>{key}:</Text>
              <Text style={styles.dataValue} numberOfLines={1}>
                {value !== null ? String(value) : '-'}
              </Text>
            </View>
          ))}
        {Object.keys(submission.formData).length > 3 && (
          <Text style={styles.moreText}>
            +{Object.keys(submission.formData).length - 3} campos
          </Text>
        )}
      </View>

      {/* Footer */}
      <View style={styles.itemFooter}>
        <Text style={styles.submittedBy}>
          Por: {submission.submittedByName}
        </Text>
        <Text style={styles.submittedAt}>
          {formatDateTime(submission.submittedAt)}
        </Text>
      </View>

      {/* Error message */}
      {submission.syncError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{submission.syncError}</Text>
        </View>
      )}

      {/* Pending indicator */}
      {isPending && (
        <View style={styles.pendingIndicator}>
          <Text style={styles.pendingText}>
            {submission.syncStatus === SubmissionStatus.SENDING
              ? 'Enviando...'
              : 'Aguardando conexão'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function SubmissionsList({
  submissions,
  onRetry,
  onViewDetails,
}: SubmissionsListProps): JSX.Element {
  const renderItem = useCallback(
    ({ item }: { item: ProductionSubmission }) => (
      <SubmissionItem
        submission={item}
        onRetry={onRetry}
        onViewDetails={onViewDetails}
      />
    ),
    [onRetry, onViewDetails]
  );

  const keyExtractor = useCallback((item: ProductionSubmission) => item.id, []);

  if (submissions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyText}>Nenhuma produção enviada</Text>
        <Text style={styles.emptySubtext}>
          Preencha o formulário acima para enviar
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={submissions}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      contentContainerStyle={styles.listContent}
      scrollEnabled={false}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  listContent: {
    paddingVertical: 8,
  },
  separator: {
    height: 12,
  },

  // Item
  item: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  retryButton: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  retryButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#991B1B',
  },

  // Form data preview
  formDataPreview: {
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
  },
  dataRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dataKey: {
    fontSize: 12,
    color: '#6B7280',
    width: 100,
  },
  dataValue: {
    fontSize: 12,
    color: '#111827',
    flex: 1,
    fontWeight: '500',
  },
  moreText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 4,
  },

  // Footer
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  submittedBy: {
    fontSize: 12,
    color: '#6B7280',
  },
  submittedAt: {
    fontSize: 12,
    color: '#9CA3AF',
  },

  // Error
  errorContainer: {
    backgroundColor: '#FEE2E2',
    borderRadius: 4,
    padding: 8,
    marginTop: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#991B1B',
  },

  // Pending
  pendingIndicator: {
    backgroundColor: '#FEF3C7',
    borderRadius: 4,
    padding: 8,
    marginTop: 8,
  },
  pendingText: {
    fontSize: 12,
    color: '#92400E',
    textAlign: 'center',
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#6B7280',
  },
});
