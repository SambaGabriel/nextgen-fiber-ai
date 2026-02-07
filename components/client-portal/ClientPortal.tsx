/**
 * ClientPortal - Main container for CLIENT_REVIEWER role
 * Shows scoped jobs, production, and redlines for Prime Contractors
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2, Briefcase, FileText, GitBranch, BarChart3,
  ChevronRight, Loader2, AlertCircle, ExternalLink
} from 'lucide-react';
import { User, Language, ViewState } from '../../types';
import { Job } from '../../types/project';
import { supabase } from '../../services/supabase';

interface ClientPortalProps {
  user: User;
  lang: Language;
  onNavigate?: (view: ViewState) => void;
}

interface ClientScope {
  clientId: string;
  clientName: string;
  canViewJobs: boolean;
  canViewProduction: boolean;
  canViewRateCards: boolean;
  canReviewRedlines: boolean;
  canExportReports: boolean;
}

interface DashboardStats {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  pendingRedlines: number;
  totalFootage: number;
}

const ClientPortal: React.FC<ClientPortalProps> = ({ user, lang, onNavigate }) => {
  const [scopes, setScopes] = useState<ClientScope[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientScope | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load client scopes for this user
  useEffect(() => {
    const loadScopes = async () => {
      try {
        const { data, error } = await supabase
          .from('client_viewer_scope')
          .select(`
            client_id,
            can_view_jobs,
            can_view_production,
            can_view_rate_cards,
            can_review_redlines,
            can_export_reports,
            client:clients(name)
          `)
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (error) throw error;

        const clientScopes: ClientScope[] = (data || []).map(s => ({
          clientId: s.client_id,
          clientName: s.client?.name || 'Unknown',
          canViewJobs: s.can_view_jobs,
          canViewProduction: s.can_view_production,
          canViewRateCards: s.can_view_rate_cards,
          canReviewRedlines: s.can_review_redlines,
          canExportReports: s.can_export_reports
        }));

        setScopes(clientScopes);

        // Auto-select first client if only one
        if (clientScopes.length === 1) {
          setSelectedClient(clientScopes[0]);
        }
      } catch (err) {
        console.error('[ClientPortal] Error loading scopes:', err);
        setError('Failed to load client access');
      } finally {
        setIsLoading(false);
      }
    };

    loadScopes();
  }, [user.id]);

  // Load stats when client is selected
  useEffect(() => {
    if (!selectedClient) {
      setStats(null);
      setRecentJobs([]);
      return;
    }

    const loadStats = async () => {
      try {
        // Get jobs for this client
        const { data: jobs, error: jobsError } = await supabase
          .from('jobs')
          .select('id, status, title, job_code, created_at')
          .eq('client_id', selectedClient.clientId)
          .order('created_at', { ascending: false })
          .limit(10);

        if (jobsError) throw jobsError;

        const allJobs = jobs || [];

        // Calculate stats
        const statsData: DashboardStats = {
          totalJobs: allJobs.length,
          activeJobs: allJobs.filter(j => ['assigned', 'in_progress'].includes(j.status)).length,
          completedJobs: allJobs.filter(j => j.status === 'completed').length,
          pendingRedlines: 0, // Will query separately
          totalFootage: 0 // Will calculate from production
        };

        // Get pending redlines count
        const { count: redlineCount } = await supabase
          .from('rate_card_redlines')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending_review');

        statsData.pendingRedlines = redlineCount || 0;

        setStats(statsData);
        setRecentJobs(allJobs.map(j => ({
          id: j.id,
          title: j.title,
          jobCode: j.job_code,
          status: j.status,
          createdAt: j.created_at
        } as any)));
      } catch (err) {
        console.error('[ClientPortal] Error loading stats:', err);
      }
    };

    loadStats();
  }, [selectedClient]);

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned': return 'var(--energy-core)';
      case 'in_progress': return 'var(--neural-core)';
      case 'submitted': return 'var(--online-core)';
      case 'completed': return 'var(--text-ghost)';
      default: return 'var(--text-secondary)';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--neural-core)' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <AlertCircle className="w-12 h-12" style={{ color: 'var(--critical-core)' }} />
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{error}</p>
      </div>
    );
  }

  if (scopes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <Building2 className="w-12 h-12" style={{ color: 'var(--text-ghost)' }} />
        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>No Access Configured</h2>
        <p className="text-sm text-center max-w-md" style={{ color: 'var(--text-secondary)' }}>
          You don't have access to any client data yet. Please contact your administrator to request access.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--abyss)' }}>
      {/* Header */}
      <div className="p-6 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl" style={{ background: 'var(--neural-dim)' }}>
              <Building2 className="w-6 h-6" style={{ color: 'var(--neural-core)' }} />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Client Portal
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Welcome, {user.name}
              </p>
            </div>
          </div>

          {/* Client Selector */}
          {scopes.length > 1 && (
            <select
              value={selectedClient?.clientId || ''}
              onChange={(e) => {
                const scope = scopes.find(s => s.clientId === e.target.value);
                setSelectedClient(scope || null);
              }}
              className="px-4 py-2.5 rounded-xl text-sm font-medium outline-none cursor-pointer"
              style={{
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)'
              }}
            >
              <option value="">Select Client</option>
              {scopes.map(s => (
                <option key={s.clientId} value={s.clientId}>{s.clientName}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selectedClient ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Building2 className="w-12 h-12" style={{ color: 'var(--text-ghost)' }} />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Select a client to view their data
            </p>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Stats Grid */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg" style={{ background: 'var(--neural-dim)' }}>
                      <Briefcase className="w-4 h-4" style={{ color: 'var(--neural-core)' }} />
                    </div>
                    <span className="text-xs font-bold uppercase" style={{ color: 'var(--text-ghost)' }}>Total Jobs</span>
                  </div>
                  <p className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>{stats.totalJobs}</p>
                </div>

                <div className="p-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg" style={{ background: 'var(--energy-dim)' }}>
                      <BarChart3 className="w-4 h-4" style={{ color: 'var(--energy-core)' }} />
                    </div>
                    <span className="text-xs font-bold uppercase" style={{ color: 'var(--text-ghost)' }}>Active</span>
                  </div>
                  <p className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>{stats.activeJobs}</p>
                </div>

                <div className="p-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg" style={{ background: 'var(--online-glow)' }}>
                      <FileText className="w-4 h-4" style={{ color: 'var(--online-core)' }} />
                    </div>
                    <span className="text-xs font-bold uppercase" style={{ color: 'var(--text-ghost)' }}>Completed</span>
                  </div>
                  <p className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>{stats.completedJobs}</p>
                </div>

                <div className="p-4 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg" style={{ background: 'var(--alert-glow)' }}>
                      <GitBranch className="w-4 h-4" style={{ color: 'var(--alert-core)' }} />
                    </div>
                    <span className="text-xs font-bold uppercase" style={{ color: 'var(--text-ghost)' }}>Pending Redlines</span>
                  </div>
                  <p className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>{stats.pendingRedlines}</p>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {selectedClient.canViewJobs && (
                <button
                  onClick={() => onNavigate?.(ViewState.CLIENT_JOBS)}
                  className="p-4 rounded-xl text-left transition-all hover:scale-[1.02]"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
                >
                  <Briefcase className="w-6 h-6 mb-2" style={{ color: 'var(--neural-core)' }} />
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>View Jobs</p>
                  <p className="text-xs" style={{ color: 'var(--text-ghost)' }}>Browse all jobs</p>
                </button>
              )}

              {selectedClient.canViewProduction && (
                <button
                  onClick={() => onNavigate?.(ViewState.CLIENT_PRODUCTION)}
                  className="p-4 rounded-xl text-left transition-all hover:scale-[1.02]"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
                >
                  <FileText className="w-6 h-6 mb-2" style={{ color: 'var(--energy-core)' }} />
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Production</p>
                  <p className="text-xs" style={{ color: 'var(--text-ghost)' }}>View reports</p>
                </button>
              )}

              {selectedClient.canReviewRedlines && (
                <button
                  onClick={() => onNavigate?.(ViewState.CLIENT_REDLINES)}
                  className="p-4 rounded-xl text-left transition-all hover:scale-[1.02]"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
                >
                  <GitBranch className="w-6 h-6 mb-2" style={{ color: 'var(--alert-core)' }} />
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Redlines</p>
                  <p className="text-xs" style={{ color: 'var(--text-ghost)' }}>Review changes</p>
                </button>
              )}

              {selectedClient.canExportReports && (
                <button
                  className="p-4 rounded-xl text-left transition-all hover:scale-[1.02]"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
                >
                  <ExternalLink className="w-6 h-6 mb-2" style={{ color: 'var(--online-core)' }} />
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Export</p>
                  <p className="text-xs" style={{ color: 'var(--text-ghost)' }}>Download reports</p>
                </button>
              )}
            </div>

            {/* Recent Jobs */}
            {recentJobs.length > 0 && (
              <div className="p-6 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold uppercase" style={{ color: 'var(--text-tertiary)' }}>
                    Recent Jobs
                  </h2>
                  {selectedClient.canViewJobs && (
                    <button
                      onClick={() => onNavigate?.(ViewState.CLIENT_JOBS)}
                      className="text-xs font-bold"
                      style={{ color: 'var(--neural-core)' }}
                    >
                      View All
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {recentJobs.slice(0, 5).map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between p-3 rounded-lg"
                      style={{ background: 'var(--elevated)' }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {job.title || job.jobCode}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-ghost)' }}>
                          {job.jobCode} - {formatDate(job.createdAt)}
                        </p>
                      </div>
                      <div
                        className="px-2 py-1 rounded text-[10px] font-bold uppercase"
                        style={{ background: `${getStatusColor(job.status)}20`, color: getStatusColor(job.status) }}
                      >
                        {job.status.replace('_', ' ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Permissions Info */}
            <div className="p-4 rounded-xl text-center" style={{ background: 'var(--neural-dim)', border: '1px solid var(--border-neural)' }}>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                You have access to <span className="font-bold" style={{ color: 'var(--neural-core)' }}>{selectedClient.clientName}</span> data.
                Contact your administrator for access to additional clients.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientPortal;
