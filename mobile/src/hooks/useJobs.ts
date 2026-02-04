/**
 * NextGen Fiber - useJobs Hook
 * Manages job data fetching, caching, and state
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Job,
  JobListItem,
  JobStatus,
  ProductionSubmission,
  Comment,
  PaginatedResponse,
} from '../types/jobs';
import {
  fetchJobs,
  fetchJobById,
  fetchSubmissions,
  fetchComments,
} from '../api/jobsApi';
import { trackEvent } from '../services/telemetry';

// ============================================
// CONSTANTS
// ============================================

const JOBS_CACHE_KEY = 'jobs_cache';
const JOB_DETAIL_CACHE_PREFIX = 'job_detail_';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ============================================
// TYPES
// ============================================

export type JobFilter = 'ALL' | 'AVAILABLE' | 'IN_PROGRESS' | 'SUBMITTED' | 'CLOSED';

interface JobsState {
  jobs: JobListItem[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  hasMore: boolean;
  page: number;
}

interface UseJobsReturn extends JobsState {
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  setFilter: (filter: JobFilter) => void;
  currentFilter: JobFilter;
}

interface JobDetailState {
  job: Job | null;
  submissions: ProductionSubmission[];
  comments: Comment[];
  isLoading: boolean;
  error: string | null;
}

interface UseJobDetailReturn extends JobDetailState {
  refresh: () => Promise<void>;
  refreshComments: () => Promise<void>;
}

// ============================================
// FILTER MAPPING
// ============================================

function filterToStatus(filter: JobFilter): JobStatus | undefined {
  switch (filter) {
    case 'AVAILABLE':
      return JobStatus.AVAILABLE;
    case 'IN_PROGRESS':
      return JobStatus.IN_PROGRESS;
    case 'SUBMITTED':
      return JobStatus.SUBMITTED;
    case 'CLOSED':
      return JobStatus.CLOSED;
    default:
      return undefined;
  }
}

// ============================================
// useJobs HOOK
// ============================================

export function useJobs(): UseJobsReturn {
  const [state, setState] = useState<JobsState>({
    jobs: [],
    isLoading: true,
    isRefreshing: false,
    error: null,
    hasMore: true,
    page: 1,
  });

  const [currentFilter, setCurrentFilter] = useState<JobFilter>('ALL');
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadJobs = useCallback(async (page: number, isRefresh: boolean = false) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setState((prev) => ({
      ...prev,
      isLoading: page === 1 && !isRefresh,
      isRefreshing: isRefresh,
      error: null,
    }));

    try {
      const status = filterToStatus(currentFilter);
      const response = await fetchJobs({ page, status });

      setState((prev) => ({
        ...prev,
        jobs: page === 1 ? response.data : [...prev.jobs, ...response.data],
        isLoading: false,
        isRefreshing: false,
        hasMore: response.pagination.hasMore,
        page,
      }));

      // Cache first page
      if (page === 1) {
        await AsyncStorage.setItem(
          `${JOBS_CACHE_KEY}_${currentFilter}`,
          JSON.stringify({
            data: response.data,
            timestamp: Date.now(),
          })
        );
      }

      trackEvent({ type: 'JOB_LIST_VIEWED', filter: currentFilter });
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;

      const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar jobs';
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isRefreshing: false,
        error: errorMessage,
      }));
    }
  }, [currentFilter]);

  // Load cached data on mount
  useEffect(() => {
    const loadCached = async () => {
      try {
        const cached = await AsyncStorage.getItem(`${JOBS_CACHE_KEY}_${currentFilter}`);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const isStale = Date.now() - timestamp > CACHE_TTL;

          setState((prev) => ({
            ...prev,
            jobs: data,
            isLoading: isStale, // Still show loading if stale
          }));

          if (isStale) {
            loadJobs(1);
          }
        } else {
          loadJobs(1);
        }
      } catch {
        loadJobs(1);
      }
    };

    loadCached();
  }, [currentFilter, loadJobs]);

  const refresh = useCallback(async () => {
    await loadJobs(1, true);
  }, [loadJobs]);

  const loadMore = useCallback(async () => {
    if (state.isLoading || !state.hasMore) return;
    await loadJobs(state.page + 1);
  }, [loadJobs, state.isLoading, state.hasMore, state.page]);

  const setFilter = useCallback((filter: JobFilter) => {
    setCurrentFilter(filter);
    setState((prev) => ({
      ...prev,
      jobs: [],
      page: 1,
      hasMore: true,
    }));
  }, []);

  return {
    ...state,
    refresh,
    loadMore,
    setFilter,
    currentFilter,
  };
}

// ============================================
// useJobDetail HOOK
// ============================================

export function useJobDetail(jobId: string): UseJobDetailReturn {
  const [state, setState] = useState<JobDetailState>({
    job: null,
    submissions: [],
    comments: [],
    isLoading: true,
    error: null,
  });

  const loadJobDetail = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Load all data in parallel
      const [job, submissionsRes, commentsRes] = await Promise.all([
        fetchJobById(jobId),
        fetchSubmissions(jobId),
        fetchComments(jobId),
      ]);

      setState({
        job,
        submissions: submissionsRes.data,
        comments: commentsRes.data,
        isLoading: false,
        error: null,
      });

      // Cache job detail
      await AsyncStorage.setItem(
        `${JOB_DETAIL_CACHE_PREFIX}${jobId}`,
        JSON.stringify({
          job,
          submissions: submissionsRes.data,
          comments: commentsRes.data,
          timestamp: Date.now(),
        })
      );

      trackEvent({ type: 'JOB_OPENED', jobId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar job';
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, [jobId]);

  // Load cached data on mount
  useEffect(() => {
    const loadCached = async () => {
      try {
        const cached = await AsyncStorage.getItem(`${JOB_DETAIL_CACHE_PREFIX}${jobId}`);
        if (cached) {
          const { job, submissions, comments, timestamp } = JSON.parse(cached);
          const isStale = Date.now() - timestamp > CACHE_TTL;

          setState({
            job,
            submissions,
            comments,
            isLoading: isStale,
            error: null,
          });

          if (isStale) {
            loadJobDetail();
          }
        } else {
          loadJobDetail();
        }
      } catch {
        loadJobDetail();
      }
    };

    loadCached();
  }, [jobId, loadJobDetail]);

  const refresh = useCallback(async () => {
    await loadJobDetail();
  }, [loadJobDetail]);

  const refreshComments = useCallback(async () => {
    try {
      const commentsRes = await fetchComments(jobId);
      setState((prev) => ({
        ...prev,
        comments: commentsRes.data,
      }));
    } catch (error) {
      console.error('[useJobDetail] Failed to refresh comments:', error);
    }
  }, [jobId]);

  return {
    ...state,
    refresh,
    refreshComments,
  };
}
