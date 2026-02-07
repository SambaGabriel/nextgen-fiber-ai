/**
 * MyJobs - List of jobs assigned to the lineman
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Briefcase, MapPin, Calendar, Clock, ChevronRight,
  CheckCircle2, AlertTriangle, Play, Send, FileText, MessageCircle
} from 'lucide-react';
import { Job, JobStatus, JobUnreadCount } from '../types/project';
import { jobStorageSupabase } from '../services/jobStorageSupabase';
import { chatStorage } from '../services/chatStorage';
import { Language, User } from '../types';
import FiberLoader from './FiberLoader';

interface MyJobsProps {
  user: User;
  lang: Language;
  onSelectJob: (job: Job) => void;
}

const translations = {
  EN: {
    title: 'My Jobs',
    subtitle: 'Jobs assigned to you',
    tabs: {
      all: 'All',
      assigned: 'New',
      inProgress: 'In Progress',
      submitted: 'Submitted',
      completed: 'Completed'
    },
    empty: 'No jobs in this category',
    emptyAll: 'No jobs assigned yet. Check back later.',
    client: 'Client',
    scheduled: 'Scheduled',
    estimated: 'Est. Footage',
    viewDetails: 'View Details',
    status: {
      assigned: 'New',
      in_progress: 'In Progress',
      submitted: 'Submitted',
      approved: 'Approved',
      needs_revision: 'Needs Revision',
      completed: 'Completed'
    }
  },
  PT: {
    title: 'Meus Jobs',
    subtitle: 'Jobs atribuídos a você',
    tabs: {
      all: 'Todos',
      assigned: 'Novos',
      inProgress: 'Em Progresso',
      submitted: 'Enviados',
      completed: 'Concluídos'
    },
    empty: 'Nenhum job nesta categoria',
    emptyAll: 'Nenhum job atribuído ainda. Verifique mais tarde.',
    client: 'Cliente',
    scheduled: 'Agendado',
    estimated: 'Metragem Est.',
    viewDetails: 'Ver Detalhes',
    status: {
      assigned: 'Novo',
      in_progress: 'Em Progresso',
      submitted: 'Enviado',
      approved: 'Aprovado',
      needs_revision: 'Revisão Necessária',
      completed: 'Concluído'
    }
  },
  ES: {
    title: 'Mis Jobs',
    subtitle: 'Jobs asignados a ti',
    tabs: {
      all: 'Todos',
      assigned: 'Nuevos',
      inProgress: 'En Progreso',
      submitted: 'Enviados',
      completed: 'Completados'
    },
    empty: 'No hay jobs en esta categoría',
    emptyAll: 'No hay jobs asignados aún. Revisa más tarde.',
    client: 'Cliente',
    scheduled: 'Programado',
    estimated: 'Metraje Est.',
    viewDetails: 'Ver Detalles',
    status: {
      assigned: 'Nuevo',
      in_progress: 'En Progreso',
      submitted: 'Enviado',
      approved: 'Aprobado',
      needs_revision: 'Necesita Revisión',
      completed: 'Completado'
    }
  }
};

type TabType = 'all' | 'assigned' | 'inProgress' | 'submitted' | 'completed';

const MyJobs: React.FC<MyJobsProps> = ({ user, lang, onSelectJob }) => {
  const t = translations[lang];
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());

  // Load jobs and unread counts
  const loadJobs = useCallback(async () => {
    setIsLoading(true);

    try {
      // Get jobs assigned to THIS lineman only
      const allJobs = await jobStorageSupabase.getByLineman(user.id);
      // Double-check filter: only show jobs where this user is assigned
      const myJobs = allJobs.filter(job => job.assignedToId === user.id);
      setJobs(myJobs);

      // Load unread counts for all jobs
      const counts = chatStorage.getUnreadCounts(user.id);
      const countMap = new Map<string, number>();
      counts.forEach(c => {
        if (c.unreadCount > 0) {
          countMap.set(c.jobId, c.unreadCount);
        }
      });
      setUnreadCounts(countMap);
    } catch (error) {
      console.error('Error loading jobs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    loadJobs();

    // Poll for unread count updates every 10 seconds
    const pollInterval = setInterval(() => {
      const counts = chatStorage.getUnreadCounts(user.id);
      const countMap = new Map<string, number>();
      counts.forEach(c => {
        if (c.unreadCount > 0) {
          countMap.set(c.jobId, c.unreadCount);
        }
      });
      setUnreadCounts(countMap);
    }, 10000);

    return () => clearInterval(pollInterval);
  }, [loadJobs, user.id]);

  // Filter jobs by tab
  const filteredJobs = jobs.filter(job => {
    switch (activeTab) {
      case 'assigned':
        return job.status === JobStatus.ASSIGNED;
      case 'inProgress':
        return job.status === JobStatus.IN_PROGRESS;
      case 'submitted':
        return [JobStatus.SUBMITTED, JobStatus.APPROVED].includes(job.status);
      case 'completed':
        return job.status === JobStatus.COMPLETED;
      default:
        return true;
    }
  }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  // Get status badge config
  const getStatusConfig = (status: JobStatus) => {
    const configs: Record<JobStatus, { bg: string; color: string; icon: React.ReactNode }> = {
      [JobStatus.ASSIGNED]: {
        bg: 'var(--neural-dim)',
        color: 'var(--neural-core)',
        icon: <Briefcase className="w-4 h-4" />
      },
      [JobStatus.IN_PROGRESS]: {
        bg: 'var(--energy-pulse)',
        color: 'var(--energy-core)',
        icon: <Play className="w-4 h-4" />
      },
      [JobStatus.SUBMITTED]: {
        bg: 'var(--online-glow)',
        color: 'var(--online-core)',
        icon: <Send className="w-4 h-4" />
      },
      [JobStatus.APPROVED]: {
        bg: 'var(--online-glow)',
        color: 'var(--online-core)',
        icon: <CheckCircle2 className="w-4 h-4" />
      },
      [JobStatus.NEEDS_REVISION]: {
        bg: 'rgba(251, 146, 60, 0.1)',
        color: '#fb923c',
        icon: <AlertTriangle className="w-4 h-4" />
      },
      [JobStatus.COMPLETED]: {
        bg: 'var(--online-glow)',
        color: 'var(--online-core)',
        icon: <CheckCircle2 className="w-4 h-4" />
      }
    };
    return configs[status];
  };

  // Tab counts
  const tabCounts = {
    all: jobs.length,
    assigned: jobs.filter(j => j.status === JobStatus.ASSIGNED).length,
    inProgress: jobs.filter(j => j.status === JobStatus.IN_PROGRESS).length,
    submitted: jobs.filter(j => [JobStatus.SUBMITTED, JobStatus.APPROVED].includes(j.status)).length,
    completed: jobs.filter(j => j.status === JobStatus.COMPLETED).length
  };

  const tabs: { id: TabType; label: string; count: number }[] = [
    { id: 'all', label: t.tabs.all, count: tabCounts.all },
    { id: 'assigned', label: t.tabs.assigned, count: tabCounts.assigned },
    { id: 'inProgress', label: t.tabs.inProgress, count: tabCounts.inProgress },
    { id: 'submitted', label: t.tabs.submitted, count: tabCounts.submitted },
    { id: 'completed', label: t.tabs.completed, count: tabCounts.completed }
  ];

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--void)' }}>
      {/* Header */}
      <div className="flex-shrink-0 px-4 sm:px-6 lg:px-8 py-4 sm:py-6" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-3xl font-black tracking-tighter uppercase text-gradient-neural">
              {t.title}
            </h1>
            <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {t.subtitle}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div
          className="flex gap-1 p-1 rounded-xl overflow-x-auto scrollbar-hide"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
        >
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-[9px] sm:text-[10px] font-bold uppercase tracking-widest transition-all flex-shrink-0"
              style={{
                background: activeTab === tab.id ? 'var(--gradient-neural)' : 'transparent',
                color: activeTab === tab.id ? 'var(--void)' : 'var(--text-tertiary)'
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded text-[8px]"
                  style={{
                    background: activeTab === tab.id ? 'rgba(0,0,0,0.2)' : 'var(--elevated)',
                    color: activeTab === tab.id ? 'white' : 'var(--text-tertiary)'
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Jobs List */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <FiberLoader size={60} text="Loading..." />
          </div>
        ) : filteredJobs.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-64 rounded-2xl"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
          >
            <Briefcase className="w-10 h-10 sm:w-12 sm:h-12 mb-4" style={{ color: 'var(--text-ghost)' }} />
            <p className="text-xs sm:text-sm text-center px-4" style={{ color: 'var(--text-tertiary)' }}>
              {jobs.length === 0 ? t.emptyAll : t.empty}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredJobs.map(job => {
              const statusConfig = getStatusConfig(job.status);
              const jobUnreadCount = unreadCounts.get(job.id) || 0;
              return (
                <button
                  key={job.id}
                  onClick={() => onSelectJob(job)}
                  className="w-full p-4 sm:p-5 rounded-xl sm:rounded-2xl transition-all hover:scale-[1.005] cursor-pointer group text-left relative"
                  style={{
                    background: 'var(--surface)',
                    border: jobUnreadCount > 0 ? '1px solid var(--neural-core)' : '1px solid var(--border-default)'
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                      {/* Status Icon with unread indicator */}
                      <div className="relative flex-shrink-0">
                        <div
                          className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center"
                          style={{ background: statusConfig.bg }}
                        >
                          <div style={{ color: statusConfig.color }}>{statusConfig.icon}</div>
                        </div>
                        {/* Unread badge */}
                        {jobUnreadCount > 0 && (
                          <div
                            className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white animate-pulse"
                            style={{ background: 'var(--gradient-neural)' }}
                          >
                            {jobUnreadCount > 9 ? '9+' : jobUnreadCount}
                          </div>
                        )}
                      </div>

                      {/* Job Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-black text-sm sm:text-lg tracking-tight truncate" style={{ color: 'var(--text-primary)' }}>
                            {job.title}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded-lg text-[8px] sm:text-[9px] font-black uppercase tracking-widest flex-shrink-0"
                            style={{ background: statusConfig.bg, color: statusConfig.color }}
                          >
                            {t.status[job.status]}
                          </span>
                          {/* Message indicator on mobile */}
                          {jobUnreadCount > 0 && (
                            <span className="sm:hidden flex items-center gap-1 px-2 py-0.5 rounded-lg text-[8px] font-black" style={{ background: 'var(--neural-dim)', color: 'var(--neural-core)' }}>
                              <MessageCircle className="w-3 h-3" />
                              {jobUnreadCount}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] sm:text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {job.jobCode}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {job.clientName}
                          </span>
                          {job.scheduledDate && (
                            <span className="flex items-center gap-1 hidden sm:flex">
                              <Calendar className="w-3 h-3" />
                              {new Date(job.scheduledDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right side */}
                    <div className="flex items-center gap-3 sm:gap-4">
                      {job.estimatedFootage && (
                        <div className="text-right hidden sm:block">
                          <p className="text-lg font-black" style={{ color: 'var(--neural-core)' }}>
                            {job.estimatedFootage.toLocaleString()}
                          </p>
                          <p className="text-[8px] font-bold uppercase" style={{ color: 'var(--text-ghost)' }}>ft</p>
                        </div>
                      )}
                      <ChevronRight
                        className="w-5 h-5 opacity-40 group-hover:opacity-100 transition-opacity"
                        style={{ color: 'var(--text-ghost)' }}
                      />
                    </div>
                  </div>

                  {/* Location on mobile */}
                  {job.location?.address && (
                    <div className="mt-2 pt-2 sm:hidden" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--text-ghost)' }}>
                        <MapPin className="w-3 h-3" />
                        {job.location.address}, {job.location.city}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyJobs;
