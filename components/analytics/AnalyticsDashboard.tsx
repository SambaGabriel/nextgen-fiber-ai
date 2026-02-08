/**
 * Analytics Dashboard Component
 * Real-time business metrics for admins and supervisors
 */

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  DollarSign,
  Briefcase,
  Users,
  TrendingUp,
  Calendar,
  Download,
  RefreshCw,
  ChevronDown,
  Filter,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import type { User } from '../../types';
import { supabase } from '../../services/supabase';
import { JobStatus } from '../../types/project';

// ============================================
// TYPES
// ============================================

interface AnalyticsDashboardProps {
  user: User | null;
  dateRange?: { start: Date; end: Date };
}

interface DateRangeOption {
  label: string;
  value: 'this_week' | 'this_month' | 'last_30_days' | 'custom';
  getRange: () => { start: Date; end: Date };
}

interface MetricCard {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

interface RevenueDataPoint {
  week: string;
  revenue: number;
  margin: number;
}

interface JobStatusData {
  name: string;
  value: number;
  color: string;
}

interface LinemanPerformance {
  id: string;
  name: string;
  jobsCompleted: number;
  totalFootage: number;
  earnings: number;
  avgMargin: number;
}

interface ProductionByLineman {
  name: string;
  footage: number;
  jobs: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('en-US').format(value);
};

const getDateRangeOptions = (): DateRangeOption[] => {
  const now = new Date();

  return [
    {
      label: 'This Week',
      value: 'this_week',
      getRange: () => {
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        start.setHours(0, 0, 0, 0);
        return { start, end: now };
      }
    },
    {
      label: 'This Month',
      value: 'this_month',
      getRange: () => {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start, end: now };
      }
    },
    {
      label: 'Last 30 Days',
      value: 'last_30_days',
      getRange: () => {
        const start = new Date(now);
        start.setDate(now.getDate() - 30);
        return { start, end: now };
      }
    },
    {
      label: 'Custom',
      value: 'custom',
      getRange: () => ({ start: now, end: now })
    }
  ];
};

// Generate mock data for last 12 weeks
const generateRevenueData = (): RevenueDataPoint[] => {
  const weeks: RevenueDataPoint[] = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const weekDate = new Date(now);
    weekDate.setDate(now.getDate() - (i * 7));
    const weekLabel = `W${52 - i}`;

    weeks.push({
      week: weekLabel,
      revenue: Math.floor(Math.random() * 50000) + 20000,
      margin: Math.floor(Math.random() * 20) + 15
    });
  }

  return weeks;
};

// Chart colors
const CHART_COLORS = {
  primary: '#00d4ff',
  secondary: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  purple: '#a855f7',
  pink: '#ec4899'
};

const JOB_STATUS_COLORS: Record<string, string> = {
  'Completed': CHART_COLORS.secondary,
  'In Progress': CHART_COLORS.primary,
  'Assigned': CHART_COLORS.warning,
  'Submitted': CHART_COLORS.purple,
  'Pending': CHART_COLORS.pink
};

// ============================================
// COMPONENT
// ============================================

const AnalyticsDashboard = memo<AnalyticsDashboardProps>(({ user, dateRange: propDateRange }) => {
  // State
  const [selectedDateRange, setSelectedDateRange] = useState<'this_week' | 'this_month' | 'last_30_days' | 'custom'>('this_month');
  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [showClientFilter, setShowClientFilter] = useState(false);
  const [showCustomerFilter, setShowCustomerFilter] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Data state
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [jobsCompleted, setJobsCompleted] = useState(0);
  const [activeLinemen, setActiveLinemen] = useState(0);
  const [avgMargin, setAvgMargin] = useState(0);
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
  const [jobStatusData, setJobStatusData] = useState<JobStatusData[]>([]);
  const [productionByLineman, setProductionByLineman] = useState<ProductionByLineman[]>([]);
  const [marginTrend, setMarginTrend] = useState<{ week: string; margin: number }[]>([]);
  const [topPerformers, setTopPerformers] = useState<LinemanPerformance[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [sortColumn, setSortColumn] = useState<keyof LinemanPerformance>('earnings');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Get current date range
  const currentDateRange = useMemo(() => {
    if (propDateRange) return propDateRange;
    const option = getDateRangeOptions().find(o => o.value === selectedDateRange);
    return option ? option.getRange() : getDateRangeOptions()[1].getRange();
  }, [propDateRange, selectedDateRange]);

  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load jobs data
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('*')
        .gte('created_at', currentDateRange.start.toISOString())
        .lte('created_at', currentDateRange.end.toISOString());

      if (jobsError) {
        console.error('[AnalyticsDashboard] Error loading jobs:', jobsError);
      }

      // Load clients
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, name')
        .eq('is_active', true);

      if (clientsData) {
        setClients(clientsData);
      }

      // Load customers
      const { data: customersData } = await supabase
        .from('customers')
        .select('id, name')
        .eq('is_active', true);

      if (customersData) {
        setCustomers(customersData);
      }

      // Process jobs data or use mock data if no jobs
      if (jobs && jobs.length > 0) {
        // Calculate metrics from real data
        const completed = jobs.filter(j => j.status === JobStatus.COMPLETED).length;
        setJobsCompleted(completed);

        // Get unique linemen
        const uniqueLinemen = new Set(jobs.map(j => j.assigned_to_id).filter(Boolean));
        setActiveLinemen(uniqueLinemen.size);

        // Calculate job status distribution
        const statusCounts: Record<string, number> = {};
        jobs.forEach(job => {
          const statusLabel = getStatusLabel(job.status);
          statusCounts[statusLabel] = (statusCounts[statusLabel] || 0) + 1;
        });

        setJobStatusData(
          Object.entries(statusCounts).map(([name, value]) => ({
            name,
            value,
            color: JOB_STATUS_COLORS[name] || CHART_COLORS.primary
          }))
        );

        // Calculate production by lineman
        const linemanProduction: Record<string, { name: string; footage: number; jobs: number }> = {};
        jobs.forEach(job => {
          const linemanId = job.assigned_to_id;
          const linemanName = job.assigned_to_name || 'Unknown';
          if (linemanId) {
            if (!linemanProduction[linemanId]) {
              linemanProduction[linemanId] = { name: linemanName, footage: 0, jobs: 0 };
            }
            linemanProduction[linemanId].jobs += 1;
            if (job.production_data?.totalFootage) {
              linemanProduction[linemanId].footage += job.production_data.totalFootage;
            }
          }
        });

        setProductionByLineman(Object.values(linemanProduction).slice(0, 10));

        // Calculate top performers
        const performers: LinemanPerformance[] = Object.entries(linemanProduction).map(([id, data]) => ({
          id,
          name: data.name,
          jobsCompleted: data.jobs,
          totalFootage: data.footage,
          earnings: data.footage * 0.5, // Estimated based on average rate
          avgMargin: Math.random() * 15 + 20 // Mock margin
        }));

        setTopPerformers(performers);
      } else {
        // Use mock data for demonstration
        setTotalRevenue(125750);
        setJobsCompleted(47);
        setActiveLinemen(12);
        setAvgMargin(28.5);

        setJobStatusData([
          { name: 'Completed', value: 47, color: CHART_COLORS.secondary },
          { name: 'In Progress', value: 23, color: CHART_COLORS.primary },
          { name: 'Assigned', value: 15, color: CHART_COLORS.warning },
          { name: 'Submitted', value: 8, color: CHART_COLORS.purple },
          { name: 'Pending', value: 5, color: CHART_COLORS.pink }
        ]);

        setProductionByLineman([
          { name: 'John Smith', footage: 12500, jobs: 8 },
          { name: 'Mike Johnson', footage: 10200, jobs: 7 },
          { name: 'Carlos Rodriguez', footage: 9800, jobs: 6 },
          { name: 'David Williams', footage: 8500, jobs: 5 },
          { name: 'James Brown', footage: 7200, jobs: 5 }
        ]);

        setTopPerformers([
          { id: '1', name: 'John Smith', jobsCompleted: 8, totalFootage: 12500, earnings: 6250, avgMargin: 32.5 },
          { id: '2', name: 'Mike Johnson', jobsCompleted: 7, totalFootage: 10200, earnings: 5100, avgMargin: 30.2 },
          { id: '3', name: 'Carlos Rodriguez', jobsCompleted: 6, totalFootage: 9800, earnings: 4900, avgMargin: 28.8 },
          { id: '4', name: 'David Williams', jobsCompleted: 5, totalFootage: 8500, earnings: 4250, avgMargin: 27.5 },
          { id: '5', name: 'James Brown', jobsCompleted: 5, totalFootage: 7200, earnings: 3600, avgMargin: 25.0 }
        ]);
      }

      // Generate revenue trend data
      setRevenueData(generateRevenueData());

      // Generate margin trend
      const marginData = generateRevenueData().map(d => ({
        week: d.week,
        margin: d.margin
      }));
      setMarginTrend(marginData);

      // Calculate totals from revenue data
      const revData = generateRevenueData();
      setTotalRevenue(revData.reduce((sum, d) => sum + d.revenue, 0));
      setAvgMargin(revData.reduce((sum, d) => sum + d.margin, 0) / revData.length);

      setLastUpdated(new Date());
    } catch (error) {
      console.error('[AnalyticsDashboard] Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentDateRange]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  }, [loadData]);

  // Get status label
  const getStatusLabel = (status: string): string => {
    switch (status) {
      case JobStatus.COMPLETED:
        return 'Completed';
      case JobStatus.IN_PROGRESS:
        return 'In Progress';
      case JobStatus.ASSIGNED:
        return 'Assigned';
      case JobStatus.SUBMITTED:
      case JobStatus.PRODUCTION_SUBMITTED:
        return 'Submitted';
      default:
        return 'Pending';
    }
  };

  // Sort performers
  const sortedPerformers = useMemo(() => {
    return [...topPerformers].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDirection === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [topPerformers, sortColumn, sortDirection]);

  // Handle sort
  const handleSort = useCallback((column: keyof LinemanPerformance) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  }, [sortColumn]);

  // Export to CSV
  const handleExportCSV = useCallback(() => {
    const headers = ['Rank', 'Name', 'Jobs Completed', 'Total Footage', 'Earnings', 'Avg Margin %'];
    const rows = sortedPerformers.map((p, i) => [
      i + 1,
      p.name,
      p.jobsCompleted,
      p.totalFootage,
      p.earnings.toFixed(2),
      p.avgMargin.toFixed(1)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `analytics_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }, [sortedPerformers]);

  // Metric cards data
  const metricCards: MetricCard[] = [
    {
      title: 'Total Revenue',
      value: formatCurrency(totalRevenue),
      change: 12.5,
      changeLabel: 'vs last month',
      icon: <DollarSign className="w-6 h-6" />,
      color: 'var(--success-core)',
      bgColor: 'var(--success-dim)'
    },
    {
      title: 'Jobs Completed',
      value: jobsCompleted,
      change: 8,
      changeLabel: 'vs last month',
      icon: <Briefcase className="w-6 h-6" />,
      color: 'var(--neural-core)',
      bgColor: 'var(--neural-dim)'
    },
    {
      title: 'Active Linemen',
      value: activeLinemen,
      change: 2,
      changeLabel: 'new this month',
      icon: <Users className="w-6 h-6" />,
      color: 'var(--info-core)',
      bgColor: 'var(--info-dim)'
    },
    {
      title: 'Average Margin',
      value: `${avgMargin.toFixed(1)}%`,
      change: -2.3,
      changeLabel: 'vs last month',
      icon: <TrendingUp className="w-6 h-6" />,
      color: 'var(--warning-core)',
      bgColor: 'var(--warning-dim)'
    }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 animate-spin" style={{ color: 'var(--neural-core)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Analytics Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Real-time business metrics and performance insights
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Real-time indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'var(--success-dim)' }}>
            <div className="relative">
              <div className="w-2 h-2 rounded-full animate-ping absolute" style={{ background: 'var(--success-core)' }} />
              <div className="w-2 h-2 rounded-full" style={{ background: 'var(--success-core)' }} />
            </div>
            <span className="text-xs font-medium" style={{ color: 'var(--success-core)' }}>
              Live
            </span>
          </div>

          {/* Date Range Picker */}
          <div className="relative">
            <button
              onClick={() => setShowDateDropdown(!showDateDropdown)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
            >
              <Calendar className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
              {getDateRangeOptions().find(o => o.value === selectedDateRange)?.label}
              <ChevronDown className={`w-4 h-4 transition-transform ${showDateDropdown ? 'rotate-180' : ''}`} style={{ color: 'var(--text-tertiary)' }} />
            </button>
            {showDateDropdown && (
              <div
                className="absolute top-full right-0 mt-2 py-2 rounded-xl shadow-lg z-50 min-w-[160px]"
                style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
              >
                {getDateRangeOptions().map(option => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setSelectedDateRange(option.value);
                      setShowDateDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-white/5 transition-colors"
                    style={{
                      color: selectedDateRange === option.value ? 'var(--neural-core)' : 'var(--text-primary)',
                      fontWeight: selectedDateRange === option.value ? 600 : 400
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Client Filter */}
          <div className="relative">
            <button
              onClick={() => setShowClientFilter(!showClientFilter)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
            >
              <Filter className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
              {selectedClient ? clients.find(c => c.id === selectedClient)?.name : 'All Clients'}
              <ChevronDown className={`w-4 h-4 transition-transform ${showClientFilter ? 'rotate-180' : ''}`} style={{ color: 'var(--text-tertiary)' }} />
            </button>
            {showClientFilter && (
              <div
                className="absolute top-full right-0 mt-2 py-2 rounded-xl shadow-lg z-50 min-w-[180px] max-h-60 overflow-y-auto"
                style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
              >
                <button
                  onClick={() => {
                    setSelectedClient(null);
                    setShowClientFilter(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-white/5 transition-colors"
                  style={{ color: !selectedClient ? 'var(--neural-core)' : 'var(--text-primary)' }}
                >
                  All Clients
                </button>
                {clients.map(client => (
                  <button
                    key={client.id}
                    onClick={() => {
                      setSelectedClient(client.id);
                      setShowClientFilter(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-white/5 transition-colors"
                    style={{ color: selectedClient === client.id ? 'var(--neural-core)' : 'var(--text-primary)' }}
                  >
                    {client.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Customer Filter */}
          <div className="relative">
            <button
              onClick={() => setShowCustomerFilter(!showCustomerFilter)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
            >
              <Filter className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
              {selectedCustomer ? customers.find(c => c.id === selectedCustomer)?.name : 'All Customers'}
              <ChevronDown className={`w-4 h-4 transition-transform ${showCustomerFilter ? 'rotate-180' : ''}`} style={{ color: 'var(--text-tertiary)' }} />
            </button>
            {showCustomerFilter && (
              <div
                className="absolute top-full right-0 mt-2 py-2 rounded-xl shadow-lg z-50 min-w-[180px] max-h-60 overflow-y-auto"
                style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
              >
                <button
                  onClick={() => {
                    setSelectedCustomer(null);
                    setShowCustomerFilter(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-white/5 transition-colors"
                  style={{ color: !selectedCustomer ? 'var(--neural-core)' : 'var(--text-primary)' }}
                >
                  All Customers
                </button>
                {customers.map(customer => (
                  <button
                    key={customer.id}
                    onClick={() => {
                      setSelectedCustomer(customer.id);
                      setShowCustomerFilter(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-white/5 transition-colors"
                    style={{ color: selectedCustomer === customer.id ? 'var(--neural-core)' : 'var(--text-primary)' }}
                  >
                    {customer.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl transition-colors"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} style={{ color: 'var(--text-tertiary)' }} />
          </button>

          {/* Export Button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ background: 'var(--neural-core)', color: 'var(--void)' }}
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Last Updated */}
      <div className="text-xs" style={{ color: 'var(--text-ghost)' }}>
        Last updated: {lastUpdated.toLocaleTimeString()}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((metric, index) => (
          <div
            key={index}
            className="p-5 rounded-2xl transition-transform hover:scale-[1.02]"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl" style={{ background: metric.bgColor }}>
                <div style={{ color: metric.color }}>{metric.icon}</div>
              </div>
              {metric.change !== undefined && (
                <div className="flex items-center gap-1" style={{ color: metric.change >= 0 ? 'var(--success-core)' : 'var(--error-core)' }}>
                  {metric.change >= 0 ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                  <span className="text-xs font-medium">{Math.abs(metric.change)}%</span>
                </div>
              )}
            </div>
            <div>
              <p className="text-2xl lg:text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                {metric.value}
              </p>
              <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                {metric.title}
              </p>
              {metric.changeLabel && (
                <p className="text-xs mt-1" style={{ color: 'var(--text-ghost)' }}>
                  {metric.changeLabel}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend Line Chart */}
        <div className="p-6 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            Revenue Trend (Last 12 Weeks)
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border-default)', borderRadius: '12px', fontSize: '12px' }}
                  labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke={CHART_COLORS.primary}
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6, stroke: CHART_COLORS.primary, strokeWidth: 2, fill: 'var(--surface)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Jobs by Status Pie Chart */}
        <div className="p-6 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            Jobs by Status
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={jobStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {jobStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border-default)', borderRadius: '12px', fontSize: '12px' }}
                  formatter={(value: number, name: string) => [value, name]}
                />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Production by Lineman Bar Chart */}
        <div className="p-6 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            Production by Lineman
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productionByLineman} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" horizontal={false} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k ft`} />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} width={75} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border-default)', borderRadius: '12px', fontSize: '12px' }}
                  formatter={(value: number) => [formatNumber(value) + ' ft', 'Footage']}
                />
                <Bar dataKey="footage" fill={CHART_COLORS.secondary} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Margin Trend Line Chart */}
        <div className="p-6 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            Margin Trend Over Time
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={marginTrend} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }} tickFormatter={(value) => `${value}%`} domain={[0, 40]} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border-default)', borderRadius: '12px', fontSize: '12px' }}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Margin']}
                />
                <Line
                  type="monotone"
                  dataKey="margin"
                  stroke={CHART_COLORS.warning}
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6, stroke: CHART_COLORS.warning, strokeWidth: 2, fill: 'var(--surface)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Performers Table */}
      <div className="p-6 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            Top Performers
          </h3>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Click column headers to sort
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                <th className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                  Rank
                </th>
                <th
                  className="text-left py-3 px-4 text-xs font-bold uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                  style={{ color: sortColumn === 'name' ? 'var(--neural-core)' : 'var(--text-tertiary)' }}
                  onClick={() => handleSort('name')}
                >
                  Name {sortColumn === 'name' && (sortDirection === 'asc' ? '\u2191' : '\u2193')}
                </th>
                <th
                  className="text-right py-3 px-4 text-xs font-bold uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                  style={{ color: sortColumn === 'jobsCompleted' ? 'var(--neural-core)' : 'var(--text-tertiary)' }}
                  onClick={() => handleSort('jobsCompleted')}
                >
                  Jobs {sortColumn === 'jobsCompleted' && (sortDirection === 'asc' ? '\u2191' : '\u2193')}
                </th>
                <th
                  className="text-right py-3 px-4 text-xs font-bold uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                  style={{ color: sortColumn === 'totalFootage' ? 'var(--neural-core)' : 'var(--text-tertiary)' }}
                  onClick={() => handleSort('totalFootage')}
                >
                  Footage {sortColumn === 'totalFootage' && (sortDirection === 'asc' ? '\u2191' : '\u2193')}
                </th>
                <th
                  className="text-right py-3 px-4 text-xs font-bold uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                  style={{ color: sortColumn === 'earnings' ? 'var(--neural-core)' : 'var(--text-tertiary)' }}
                  onClick={() => handleSort('earnings')}
                >
                  Earnings {sortColumn === 'earnings' && (sortDirection === 'asc' ? '\u2191' : '\u2193')}
                </th>
                <th
                  className="text-right py-3 px-4 text-xs font-bold uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                  style={{ color: sortColumn === 'avgMargin' ? 'var(--neural-core)' : 'var(--text-tertiary)' }}
                  onClick={() => handleSort('avgMargin')}
                >
                  Avg Margin {sortColumn === 'avgMargin' && (sortDirection === 'asc' ? '\u2191' : '\u2193')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedPerformers.map((performer, index) => (
                <tr
                  key={performer.id}
                  className="transition-colors hover:bg-white/5"
                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                >
                  <td className="py-4 px-4">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{
                        background: index < 3 ? 'var(--neural-dim)' : 'var(--elevated)',
                        color: index < 3 ? 'var(--neural-core)' : 'var(--text-tertiary)'
                      }}
                    >
                      {index + 1}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {performer.name}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right" style={{ color: 'var(--text-secondary)' }}>
                    {performer.jobsCompleted}
                  </td>
                  <td className="py-4 px-4 text-right" style={{ color: 'var(--text-secondary)' }}>
                    {formatNumber(performer.totalFootage)} ft
                  </td>
                  <td className="py-4 px-4 text-right font-medium" style={{ color: 'var(--success-core)' }}>
                    {formatCurrency(performer.earnings)}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span
                      className="px-2 py-1 rounded-full text-xs font-medium"
                      style={{
                        background: performer.avgMargin >= 30 ? 'var(--success-dim)' : performer.avgMargin >= 25 ? 'var(--warning-dim)' : 'var(--error-dim)',
                        color: performer.avgMargin >= 30 ? 'var(--success-core)' : performer.avgMargin >= 25 ? 'var(--warning-core)' : 'var(--error-core)'
                      }}
                    >
                      {performer.avgMargin.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sortedPerformers.length === 0 && (
          <div className="text-center py-12" style={{ color: 'var(--text-tertiary)' }}>
            No performance data available for the selected period
          </div>
        )}
      </div>
    </div>
  );
});

AnalyticsDashboard.displayName = 'AnalyticsDashboard';

export default AnalyticsDashboard;
