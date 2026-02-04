/**
 * NextGen Fiber - JobsListScreen
 * Main screen showing list of assigned jobs with filters
 */

import React, { useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Text,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { JobListItem } from '../types/jobs';
import { useJobs } from '../hooks/useJobs';
import { useQueueStatus } from '../hooks/useOfflineQueue';
import { JobCard } from '../components/JobCard';
import { FilterTabs } from '../components/FilterTabs';
import { OfflineIndicator } from '../components/OfflineIndicator';
import { getItemsForJob } from '../services/offlineQueue';

// ============================================
// TYPES
// ============================================

type JobsStackParamList = {
  JobsList: undefined;
  JobDetail: { jobId: string };
  OfflineQueue: undefined;
};

type NavigationProp = NativeStackNavigationProp<JobsStackParamList, 'JobsList'>;

// ============================================
// COMPONENT
// ============================================

export function JobsListScreen(): JSX.Element {
  const navigation = useNavigation<NavigationProp>();
  const {
    jobs,
    isLoading,
    isRefreshing,
    error,
    hasMore,
    refresh,
    loadMore,
    setFilter,
    currentFilter,
  } = useJobs();

  const queueStatus = useQueueStatus();

  const handleJobPress = useCallback(
    (job: JobListItem) => {
      navigation.navigate('JobDetail', { jobId: job.id });
    },
    [navigation]
  );

  const handleOfflinePress = useCallback(() => {
    navigation.navigate('OfflineQueue');
  }, [navigation]);

  const renderJob = useCallback(
    ({ item }: { item: JobListItem }) => {
      const pendingItems = getItemsForJob(item.id);
      return (
        <JobCard
          job={item}
          onPress={handleJobPress}
          showPendingIndicator={pendingItems.length > 0}
        />
      );
    },
    [handleJobPress]
  );

  const renderFooter = useCallback(() => {
    if (!hasMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#6B7280" />
      </View>
    );
  }, [hasMore]);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyTitle}>Nenhum job encontrado</Text>
        <Text style={styles.emptySubtitle}>
          {currentFilter === 'ALL'
            ? 'Você não tem jobs atribuídos no momento'
            : `Nenhum job com status "${currentFilter}"`}
        </Text>
      </View>
    );
  }, [isLoading, currentFilter]);

  const keyExtractor = useCallback((item: JobListItem) => item.id, []);

  return (
    <View style={styles.container}>
      {/* Offline/Queue Status */}
      <OfflineIndicator onPress={handleOfflinePress} />

      {/* Filter Tabs */}
      <FilterTabs
        currentFilter={currentFilter}
        onFilterChange={setFilter}
      />

      {/* Error State */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Jobs List */}
      {isLoading && jobs.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Carregando jobs...</Text>
        </View>
      ) : (
        <FlatList
          data={jobs}
          renderItem={renderJob}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={refresh}
              colors={['#3B82F6']}
              tintColor="#3B82F6"
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  listContent: {
    paddingVertical: 8,
    flexGrow: 1,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },

  // Footer
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },

  // Empty
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },

  // Error
  errorContainer: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#991B1B',
    textAlign: 'center',
  },
});
