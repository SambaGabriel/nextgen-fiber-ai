import React, { useState, useCallback, useEffect } from 'react';
import {
  Sparkles,
  AlertTriangle,
  TrendingUp,
  Zap,
  Lightbulb,
  Target,
  X,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  Brain,
  DollarSign,
  Activity,
  Truck
} from 'lucide-react';
import { User } from '../../types';

// Insight types
type InsightType = 'MARGIN_ALERT' | 'PERFORMANCE_TIP' | 'ANOMALY' | 'FORECAST' | 'SUGGESTION';
type InsightPriority = 'critical' | 'warning' | 'info' | 'success';

interface Insight {
  id: string;
  type: InsightType;
  priority: InsightPriority;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  timestamp: Date;
}

interface AIInsightsProps {
  user: User | null;
  context?: 'dashboard' | 'job' | 'payroll';
}

// Icon mapping for insight types
const getInsightIcon = (type: InsightType) => {
  switch (type) {
    case 'MARGIN_ALERT':
      return DollarSign;
    case 'PERFORMANCE_TIP':
      return TrendingUp;
    case 'ANOMALY':
      return Activity;
    case 'FORECAST':
      return Target;
    case 'SUGGESTION':
      return Lightbulb;
    default:
      return Sparkles;
  }
};

// Priority styling
const getPriorityStyles = (priority: InsightPriority) => {
  switch (priority) {
    case 'critical':
      return {
        border: '1px solid var(--error, #ef4444)',
        background: 'rgba(239, 68, 68, 0.1)',
        iconColor: 'var(--error, #ef4444)',
        badgeBg: 'rgba(239, 68, 68, 0.2)',
        badgeText: 'var(--error, #ef4444)'
      };
    case 'warning':
      return {
        border: '1px solid var(--warning, #f59e0b)',
        background: 'rgba(245, 158, 11, 0.1)',
        iconColor: 'var(--warning, #f59e0b)',
        badgeBg: 'rgba(245, 158, 11, 0.2)',
        badgeText: 'var(--warning, #f59e0b)'
      };
    case 'info':
      return {
        border: '1px solid var(--neural-core, #00d4ff)',
        background: 'rgba(0, 212, 255, 0.1)',
        iconColor: 'var(--neural-core, #00d4ff)',
        badgeBg: 'rgba(0, 212, 255, 0.2)',
        badgeText: 'var(--neural-core, #00d4ff)'
      };
    case 'success':
      return {
        border: '1px solid var(--online-core, #10b981)',
        background: 'rgba(16, 185, 129, 0.1)',
        iconColor: 'var(--online-core, #10b981)',
        badgeBg: 'rgba(16, 185, 129, 0.2)',
        badgeText: 'var(--online-core, #10b981)'
      };
    default:
      return {
        border: '1px solid var(--border-default)',
        background: 'var(--surface)',
        iconColor: 'var(--text-tertiary)',
        badgeBg: 'var(--elevated)',
        badgeText: 'var(--text-secondary)'
      };
  }
};

// Generate mock insights based on context
const generateMockInsights = (context: 'dashboard' | 'job' | 'payroll'): Insight[] => {
  const baseInsights: Insight[] = [
    {
      id: 'insight-1',
      type: 'MARGIN_ALERT',
      priority: 'critical',
      title: 'Low Margin Alert',
      description: 'Job BSPD001 has 8% margin (below 15% target). Consider reviewing rate card assignments.',
      actionLabel: 'View Job',
      timestamp: new Date()
    },
    {
      id: 'insight-2',
      type: 'PERFORMANCE_TIP',
      priority: 'success',
      title: 'Top Performer',
      description: 'Mike completed 20% more footage this week compared to last week. Great progress!',
      actionLabel: 'View Details',
      timestamp: new Date(Date.now() - 3600000)
    },
    {
      id: 'insight-3',
      type: 'ANOMALY',
      priority: 'warning',
      title: 'Unusual Activity Detected',
      description: 'Unusual production spike detected on Tuesday. 3x normal volume submitted.',
      actionLabel: 'Investigate',
      timestamp: new Date(Date.now() - 7200000)
    },
    {
      id: 'insight-4',
      type: 'FORECAST',
      priority: 'info',
      title: 'Monthly Projection',
      description: 'Projected revenue this month: $847k (+12% vs last month). On track to exceed targets.',
      actionLabel: 'View Forecast',
      timestamp: new Date(Date.now() - 10800000)
    },
    {
      id: 'insight-5',
      type: 'SUGGESTION',
      priority: 'info',
      title: 'Route Optimization',
      description: 'Consider assigning TRK-102 to higher-rate routes. Potential 18% revenue increase.',
      actionLabel: 'Optimize',
      timestamp: new Date(Date.now() - 14400000)
    }
  ];

  // Filter based on context
  switch (context) {
    case 'job':
      return baseInsights.filter(i =>
        ['MARGIN_ALERT', 'ANOMALY', 'SUGGESTION'].includes(i.type)
      );
    case 'payroll':
      return baseInsights.filter(i =>
        ['PERFORMANCE_TIP', 'FORECAST', 'ANOMALY'].includes(i.type)
      );
    default:
      return baseInsights;
  }
};

// Skeleton loading component
const InsightSkeleton: React.FC = () => (
  <div
    className="p-4 rounded-xl animate-pulse"
    style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
  >
    <div className="flex items-start gap-3">
      <div
        className="w-10 h-10 rounded-lg"
        style={{ background: 'var(--elevated)' }}
      />
      <div className="flex-1">
        <div
          className="h-4 rounded w-1/3 mb-2"
          style={{ background: 'var(--elevated)' }}
        />
        <div
          className="h-3 rounded w-full mb-1"
          style={{ background: 'var(--elevated)' }}
        />
        <div
          className="h-3 rounded w-2/3"
          style={{ background: 'var(--elevated)' }}
        />
      </div>
    </div>
  </div>
);

// Individual insight card component
interface InsightCardProps {
  insight: Insight;
  index: number;
  onDismiss: (id: string) => void;
}

const InsightCard: React.FC<InsightCardProps> = ({ insight, index, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);
  const Icon = getInsightIcon(insight.type);
  const styles = getPriorityStyles(insight.priority);

  // Staggered fade-in animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, index * 100);
    return () => clearTimeout(timer);
  }, [index]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => onDismiss(insight.id), 300);
  }, [insight.id, onDismiss]);

  const priorityLabels: Record<InsightPriority, string> = {
    critical: 'Critical',
    warning: 'Warning',
    info: 'Info',
    success: 'Success'
  };

  return (
    <div
      className="p-4 rounded-xl transition-all duration-300"
      style={{
        background: styles.background,
        border: styles.border,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(20px)'
      }}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: styles.badgeBg }}
        >
          <Icon className="w-5 h-5" style={{ color: styles.iconColor }} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4
              className="text-sm font-bold truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {insight.title}
            </h4>
            <span
              className="px-2 py-0.5 rounded text-[9px] font-bold uppercase"
              style={{ background: styles.badgeBg, color: styles.badgeText }}
            >
              {priorityLabels[insight.priority]}
            </span>
          </div>
          <p
            className="text-xs mb-3 leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            {insight.description}
          </p>
          <div className="flex items-center justify-between">
            {insight.actionLabel && (
              <button
                onClick={insight.onAction}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95"
                style={{
                  background: styles.badgeBg,
                  color: styles.badgeText,
                  border: `1px solid ${styles.iconColor}`
                }}
              >
                {insight.actionLabel}
              </button>
            )}
            <span
              className="text-[10px]"
              style={{ color: 'var(--text-ghost)' }}
            >
              {formatRelativeTime(insight.timestamp)}
            </span>
          </div>
        </div>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="p-1.5 rounded-lg transition-all hover:bg-white/10 flex-shrink-0"
          style={{ color: 'var(--text-tertiary)' }}
          aria-label="Dismiss insight"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Format relative time
const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
};

// Main component
const AIInsights: React.FC<AIInsightsProps> = ({ user, context = 'dashboard' }) => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial insights
  useEffect(() => {
    const loadInsights = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        const mockInsights = generateMockInsights(context);
        setInsights(mockInsights);
      } catch (err) {
        console.error('[AIInsights] Error loading insights:', err);
        setError('Failed to load insights');
      } finally {
        setIsLoading(false);
      }
    };
    loadInsights();
  }, [context]);

  // Dismiss insight
  const handleDismiss = useCallback((id: string) => {
    setInsights(prev => prev.filter(i => i.id !== id));
  }, []);

  // Generate new insights (would call Claude API in production)
  const handleGenerateInsights = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    try {
      // In production, this would call the Claude API
      // const response = await claudeService.generateInsights(context, user);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Generate new mock insights with new IDs
      const newInsights = generateMockInsights(context).map(i => ({
        ...i,
        id: `insight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date()
      }));

      setInsights(newInsights);
    } catch (err) {
      console.error('[AIInsights] Error generating insights:', err);
      setError('Failed to generate insights');
    } finally {
      setIsGenerating(false);
    }
  }, [context]);

  // Toggle collapse
  const toggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  // No user or no insights
  if (!user) {
    return null;
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-default)'
      }}
    >
      {/* Header */}
      <div
        className="p-4 flex items-center justify-between cursor-pointer select-none"
        style={{
          background: 'var(--elevated)',
          borderBottom: isCollapsed ? 'none' : '1px solid var(--border-subtle)'
        }}
        onClick={toggleCollapse}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'var(--neural-dim, rgba(0, 212, 255, 0.1))',
              border: '1px solid var(--border-neural, rgba(0, 212, 255, 0.2))'
            }}
          >
            <Brain className="w-5 h-5" style={{ color: 'var(--neural-core, #00d4ff)' }} />
          </div>
          <div>
            <h3
              className="text-sm font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              AI Insights
            </h3>
            <p
              className="text-[10px] uppercase tracking-wider"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {insights.length} active insight{insights.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Generate button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleGenerateInsights();
            }}
            disabled={isGenerating || isLoading}
            className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            style={{
              background: 'var(--neural-dim, rgba(0, 212, 255, 0.1))',
              color: 'var(--neural-core, #00d4ff)',
              border: '1px solid var(--border-neural, rgba(0, 212, 255, 0.2))'
            }}
          >
            {isGenerating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            <span className="hidden sm:inline">
              {isGenerating ? 'Generating...' : 'Refresh'}
            </span>
          </button>

          {/* Collapse toggle */}
          <div
            className="p-2 rounded-lg"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {isCollapsed ? (
              <ChevronDown className="w-5 h-5" />
            ) : (
              <ChevronUp className="w-5 h-5" />
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        className="transition-all duration-300 overflow-hidden"
        style={{
          maxHeight: isCollapsed ? 0 : '1000px',
          opacity: isCollapsed ? 0 : 1
        }}
      >
        <div className="p-4 space-y-3">
          {/* Error state */}
          {error && (
            <div
              className="p-4 rounded-xl flex items-center gap-3"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid var(--error, #ef4444)'
              }}
            >
              <AlertTriangle className="w-5 h-5" style={{ color: 'var(--error, #ef4444)' }} />
              <span className="text-sm" style={{ color: 'var(--error, #ef4444)' }}>{error}</span>
            </div>
          )}

          {/* Loading skeleton */}
          {isLoading && (
            <>
              <InsightSkeleton />
              <InsightSkeleton />
              <InsightSkeleton />
            </>
          )}

          {/* Insights list */}
          {!isLoading && insights.length > 0 && (
            insights.map((insight, index) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                index={index}
                onDismiss={handleDismiss}
              />
            ))
          )}

          {/* Empty state */}
          {!isLoading && insights.length === 0 && !error && (
            <div
              className="p-8 text-center rounded-xl"
              style={{
                background: 'var(--elevated)',
                border: '1px dashed var(--border-default)'
              }}
            >
              <Sparkles
                className="w-12 h-12 mx-auto mb-3"
                style={{ color: 'var(--text-ghost)' }}
              />
              <p
                className="text-sm font-medium mb-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                No insights available
              </p>
              <p
                className="text-xs mb-4"
                style={{ color: 'var(--text-tertiary)' }}
              >
                Click refresh to generate new AI insights
              </p>
              <button
                onClick={handleGenerateInsights}
                disabled={isGenerating}
                className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 active:scale-95"
                style={{
                  background: 'var(--neural-core, #00d4ff)',
                  color: 'var(--void, #0a0a0f)'
                }}
              >
                {isGenerating ? 'Generating...' : 'Generate Insights'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIInsights;
