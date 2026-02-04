/**
 * Billing Module Layout
 * Tesla/SpaceX/Nothing/B&O inspired premium design
 */

import React, { useState } from 'react';
import {
  Inbox, Receipt, Calculator, FileText, TrendingUp,
  Settings, ChevronLeft, ChevronRight, DollarSign,
  AlertCircle, Clock, CheckCircle, XCircle, Zap, Plus
} from 'lucide-react';

// Types
export type BillingView =
  | 'inbox'
  | 'batches'
  | 'batch-builder'
  | 'quick-invoice'
  | 'rate-cards'
  | 'tracker'
  | 'reports'
  | 'settings';

interface BillingLayoutProps {
  currentView: BillingView;
  onViewChange: (view: BillingView) => void;
  children: React.ReactNode;
}

interface QuickStat {
  label: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
  color: 'neural' | 'energy' | 'online' | 'critical';
}

// Quick stats for sidebar
const useQuickStats = (): QuickStat[] => {
  return [
    {
      label: 'Ready to Invoice',
      value: 47,
      icon: <CheckCircle className="w-4 h-4" />,
      color: 'online'
    },
    {
      label: 'Needs Review',
      value: 12,
      icon: <AlertCircle className="w-4 h-4" />,
      color: 'energy'
    },
    {
      label: 'Outstanding',
      value: '$124.5K',
      icon: <Clock className="w-4 h-4" />,
      color: 'neural'
    },
    {
      label: 'Overdue',
      value: '$18.2K',
      icon: <XCircle className="w-4 h-4" />,
      color: 'critical'
    }
  ];
};

const getColorVars = (color: QuickStat['color']) => {
  switch (color) {
    case 'neural':
      return { bg: 'var(--neural-dim)', border: 'var(--border-neural)', icon: 'var(--neural-core)' };
    case 'energy':
      return { bg: 'var(--energy-pulse)', border: 'rgba(168, 85, 247, 0.2)', icon: 'var(--energy-core)' };
    case 'online':
      return { bg: 'var(--online-glow)', border: 'rgba(16, 185, 129, 0.2)', icon: 'var(--online-core)' };
    case 'critical':
      return { bg: 'rgba(239, 68, 68, 0.1)', border: 'rgba(239, 68, 68, 0.2)', icon: 'var(--critical-core)' };
  }
};

const BillingLayout: React.FC<BillingLayoutProps> = ({
  currentView,
  onViewChange,
  children
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const quickStats = useQuickStats();

  const navItems = [
    { id: 'inbox' as BillingView, label: 'Production Inbox', icon: Inbox, badge: 47 },
    { id: 'quick-invoice' as BillingView, label: 'Quick Invoice', icon: Plus, highlight: true },
    { id: 'batches' as BillingView, label: 'Invoice Batches', icon: Receipt },
    { id: 'tracker' as BillingView, label: 'AR Tracker', icon: TrendingUp },
    { id: 'rate-cards' as BillingView, label: 'Rate Cards', icon: Calculator },
    { id: 'reports' as BillingView, label: 'Reports', icon: FileText },
    { id: 'settings' as BillingView, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex h-full" style={{ background: 'var(--void)' }}>
      {/* Sidebar */}
      <aside
        className={`
          ${isCollapsed ? 'w-20' : 'w-72'}
          flex-shrink-0 flex flex-col
          transition-all duration-500 ease-out
        `}
        style={{
          background: 'var(--deep)',
          borderRight: '1px solid var(--border-subtle)'
        }}
      >
        {/* Header */}
        <div
          className="h-16 flex items-center justify-between px-4"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              <div
                className="p-2 rounded-xl"
                style={{
                  background: 'var(--gradient-neural)',
                  boxShadow: 'var(--shadow-neural)'
                }}
              >
                <DollarSign className="w-5 h-5" style={{ color: 'var(--void)' }} />
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>Finance Hub</span>
                <p className="text-[9px] font-medium" style={{ color: 'var(--text-ghost)' }}>Command Center</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-xl transition-all duration-300 hover:scale-105"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-default)'
            }}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            ) : (
              <ChevronLeft className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            )}
          </button>
        </div>

        {/* Quick Stats */}
        {!isCollapsed && (
          <div
            className="p-4"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
          >
            <p
              className="text-[9px] font-black uppercase tracking-[0.2em] mb-4"
              style={{ color: 'var(--text-ghost)' }}
            >
              Live Stats
            </p>
            <div className="grid grid-cols-2 gap-3">
              {quickStats.map((stat, i) => {
                const colors = getColorVars(stat.color);
                return (
                  <div
                    key={i}
                    className="p-3 rounded-xl relative overflow-hidden group hover:scale-[1.02] transition-transform"
                    style={{
                      background: colors.bg,
                      border: `1px solid ${colors.border}`
                    }}
                  >
                    <div style={{ color: colors.icon }} className="mb-2">{stat.icon}</div>
                    <p className="text-lg font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
                    <p className="text-[8px] font-bold uppercase tracking-widest mt-1" style={{ color: 'var(--text-ghost)' }}>
                      {stat.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            const isHighlight = 'highlight' in item && item.highlight;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl
                  text-xs font-bold uppercase tracking-widest transition-all duration-300
                  ${isCollapsed ? 'justify-center' : ''}
                  group
                `}
                style={{
                  background: isHighlight && !isActive
                    ? 'var(--gradient-neural)'
                    : isActive
                      ? 'var(--neural-dim)'
                      : 'transparent',
                  border: isActive ? '1px solid var(--border-neural)' : '1px solid transparent',
                  color: isHighlight && !isActive
                    ? 'var(--void)'
                    : isActive
                      ? 'var(--neural-core)'
                      : 'var(--text-tertiary)',
                  boxShadow: isHighlight && !isActive ? 'var(--shadow-neural)' : 'none'
                }}
                title={isCollapsed ? item.label : undefined}
              >
                <item.icon
                  className={`w-5 h-5 transition-all ${isActive ? '' : 'group-hover:scale-110'}`}
                  style={{
                    color: isHighlight && !isActive
                      ? 'var(--void)'
                      : isActive
                        ? 'var(--neural-core)'
                        : 'var(--text-tertiary)'
                  }}
                />
                {!isCollapsed && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge && (
                      <span
                        className="px-2 py-0.5 rounded-lg text-[10px] font-black"
                        style={{
                          background: 'var(--gradient-neural)',
                          color: 'var(--void)'
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div
          className="p-4"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          {!isCollapsed && (
            <div className="text-center">
              <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--text-ghost)' }}>
                System Status
              </p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="status-online" />
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--online-core)' }}>
                  Connected
                </span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
};

export default BillingLayout;
