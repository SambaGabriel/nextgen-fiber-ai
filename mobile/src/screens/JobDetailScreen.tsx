/**
 * NextGen Fiber - JobDetailScreen
 * Full job details with map, form, submissions, and comments
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Job, JobStatus, CreateSubmissionPayload, CreateCommentPayload } from '../types/jobs';
import { useJobDetail } from '../hooks/useJobs';
import { useOfflineQueue } from '../hooks/useOfflineQueue';
import { StatusBadge } from '../components/StatusBadge';
import { PriorityIndicator } from '../components/PriorityIndicator';
import { MapViewer } from '../components/MapViewer';
import { ProductionForm } from '../components/ProductionForm';
import { SubmissionsList } from '../components/SubmissionsList';
import { CommentsThread } from '../components/CommentsThread';
import { OfflineIndicator } from '../components/OfflineIndicator';
import { startJob } from '../api/jobsApi';

// ============================================
// TYPES
// ============================================

type JobsStackParamList = {
  JobsList: undefined;
  JobDetail: { jobId: string };
};

type JobDetailRouteProp = RouteProp<JobsStackParamList, 'JobDetail'>;

type TabKey = 'info' | 'production' | 'comments';

// ============================================
// TAB CONFIG
// ============================================

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'info', label: 'Info', icon: 'ℹ️' },
  { key: 'production', label: 'Produção', icon: '📝' },
  { key: 'comments', label: 'Chat', icon: '💬' },
];

// ============================================
// HELPERS
// ============================================

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ============================================
// COMPONENT
// ============================================

export function JobDetailScreen(): JSX.Element {
  const route = useRoute<JobDetailRouteProp>();
  const { jobId } = route.params;

  const {
    job,
    submissions,
    comments,
    isLoading,
    error,
    refresh,
    refreshComments,
  } = useJobDetail(jobId);

  const {
    submitProduction,
    submitComment,
    startJob: startJobAction,
    hasPendingSubmission,
    status: queueStatus,
  } = useOfflineQueue();

  const [activeTab, setActiveTab] = useState<TabKey>('info');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Mock current user ID (should come from auth context)
  const currentUserId = 'current-user-id';

  const canStart = job?.status === JobStatus.AVAILABLE;
  const canSubmit =
    job?.status === JobStatus.IN_PROGRESS || job?.status === JobStatus.NEEDS_INFO;
  const hasPending = hasPendingSubmission(jobId);

  const handleStartJob = useCallback(async () => {
    if (!canStart || isStarting) return;

    Alert.alert(
      'Iniciar Job',
      'Tem certeza que deseja iniciar este job?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Iniciar',
          onPress: async () => {
            setIsStarting(true);
            try {
              await startJobAction(jobId);
              await refresh();
            } catch (error) {
              // Queued for offline retry
            } finally {
              setIsStarting(false);
            }
          },
        },
      ]
    );
  }, [canStart, isStarting, startJobAction, jobId, refresh]);

  const handleSubmitProduction = useCallback(
    async (payload: CreateSubmissionPayload) => {
      setIsSubmitting(true);
      try {
        await submitProduction(payload);
        Alert.alert('Sucesso', 'Produção enviada com sucesso!');
        await refresh();
      } catch (error) {
        // Will be queued for offline retry
        Alert.alert('Na Fila', 'Produção salva e será enviada quando online.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [submitProduction, refresh]
  );

  const handleSubmitComment = useCallback(
    async (payload: CreateCommentPayload) => {
      await submitComment(payload);
      await refreshComments();
    },
    [submitComment, refreshComments]
  );

  const unreadCommentsCount = useMemo(
    () => comments.filter((c) => c.isFromOffice).length,
    [comments]
  );

  // Loading/Error states
  if (isLoading && !job) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  if (error && !job) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refresh}>
          <Text style={styles.retryButtonText}>Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Job não encontrado</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Offline Indicator */}
      <OfflineIndicator />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerLeft}>
            <PriorityIndicator priority={job.priority} showLabel />
            <Text style={styles.clientText}>{job.client}</Text>
          </View>
          <StatusBadge status={job.status} size="medium" />
        </View>

        <Text style={styles.locationText}>
          {job.city}, {job.state}
        </Text>
        <Text style={styles.oltText}>
          OLT: {job.olt}
          {job.feederId && ` • Feeder: ${job.feederId}`}
          {job.runNumber && ` • Run: ${job.runNumber}`}
        </Text>

        {job.dueDate && (
          <Text style={styles.dueDateText}>
            Prazo: {formatDate(job.dueDate)}
          </Text>
        )}

        {/* Start Job Button */}
        {canStart && (
          <TouchableOpacity
            style={[styles.startButton, isStarting && styles.startButtonDisabled]}
            onPress={handleStartJob}
            disabled={isStarting}
          >
            <Text style={styles.startButtonText}>
              {isStarting ? 'Iniciando...' : '▶️ Iniciar Job'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text
              style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}
            >
              {tab.label}
            </Text>
            {tab.key === 'comments' && unreadCommentsCount > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{unreadCommentsCount}</Text>
              </View>
            )}
            {tab.key === 'production' && hasPending && (
              <View style={styles.pendingDot} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      {activeTab === 'info' && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refresh} />
          }
        >
          {/* Map */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mapa</Text>
            <MapViewer mapAsset={job.mapAsset} jobId={jobId} />
          </View>

          {/* Instructions */}
          {job.instructions && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Instruções</Text>
              <View style={styles.instructionsContainer}>
                <Text style={styles.instructionsText}>
                  {job.instructions.text}
                </Text>
                {job.instructions.attachments.length > 0 && (
                  <View style={styles.attachmentsList}>
                    {job.instructions.attachments.map((att) => (
                      <TouchableOpacity key={att.id} style={styles.attachment}>
                        <Text style={styles.attachmentName}>📎 {att.fileName}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Job Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Detalhes</Text>
            <View style={styles.detailsGrid}>
              <DetailRow label="Atribuído em" value={formatDate(job.assignedAt)} />
              <DetailRow label="Iniciado em" value={formatDate(job.startedAt)} />
              <DetailRow label="Envios" value={String(job.submissionCount)} />
              <DetailRow label="Comentários" value={String(job.commentCount)} />
            </View>
          </View>
        </ScrollView>
      )}

      {activeTab === 'production' && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Production Form */}
          {canSubmit && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Nova Produção</Text>
              <ProductionForm
                formSchema={job.formSchema}
                jobId={jobId}
                onSubmit={handleSubmitProduction}
                isSubmitting={isSubmitting}
                disabled={!canSubmit}
              />
            </View>
          )}

          {!canSubmit && (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                {job.status === JobStatus.AVAILABLE
                  ? 'Inicie o job para enviar produção'
                  : 'Este job não aceita mais envios'}
              </Text>
            </View>
          )}

          {/* Submissions History */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Histórico ({submissions.length})
            </Text>
            <SubmissionsList submissions={submissions} />
          </View>
        </ScrollView>
      )}

      {activeTab === 'comments' && (
        <CommentsThread
          comments={comments}
          jobId={jobId}
          currentUserId={currentUserId}
          onSendComment={handleSubmitComment}
          onRefresh={refreshComments}
        />
      )}
    </View>
  );
}

// ============================================
// DETAIL ROW
// ============================================

function DetailRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Header
  header: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTop: {
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
  locationText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  oltText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  dueDateText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '500',
  },
  startButton: {
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  startButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#3B82F6',
  },
  tabIcon: {
    fontSize: 16,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabLabelActive: {
    color: '#3B82F6',
  },
  tabBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 18,
    alignItems: 'center',
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  pendingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
  },

  // Content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },

  // Instructions
  instructionsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
  },
  instructionsText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  attachmentsList: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  attachment: {
    paddingVertical: 8,
  },
  attachmentName: {
    fontSize: 13,
    color: '#3B82F6',
  },

  // Details
  detailsGrid: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },

  // Info box
  infoBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#92400E',
    textAlign: 'center',
  },
});
