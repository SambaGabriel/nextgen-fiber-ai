/**
 * RedlineStatusBadge - Visual badge for redline workflow status
 * Shows the current state of job redlines with appropriate colors and icons
 */

import React from 'react';
import { AlertCircle, Upload, Clock, CheckCircle, XCircle, FileX } from 'lucide-react';
import { RedlineStatus } from '../../types/project';

interface Props {
  status: RedlineStatus | string | undefined;
  size?: 'sm' | 'md';
}

const configs: Record<string, { icon: any; label: string; bg: string; color: string }> = {
  not_uploaded: {
    icon: AlertCircle,
    label: 'Pending Redlines',
    bg: 'rgba(251, 146, 60, 0.15)',
    color: '#fb923c'
  },
  uploaded: {
    icon: Upload,
    label: 'Uploaded',
    bg: 'var(--neural-dim)',
    color: 'var(--neural-core)'
  },
  under_review: {
    icon: Clock,
    label: 'Under Review',
    bg: 'var(--energy-pulse)',
    color: 'var(--energy-core)'
  },
  approved: {
    icon: CheckCircle,
    label: 'Approved',
    bg: 'var(--online-glow)',
    color: 'var(--online-core)'
  },
  rejected: {
    icon: XCircle,
    label: 'Rejected',
    bg: 'var(--critical-glow)',
    color: 'var(--critical-core)'
  }
};

// Default config for unknown status
const defaultConfig = {
  icon: FileX,
  label: 'Unknown',
  bg: 'var(--elevated)',
  color: 'var(--text-tertiary)'
};

export const RedlineStatusBadge: React.FC<Props> = ({ status, size = 'md' }) => {
  // Handle undefined or null status
  const statusKey = status || 'not_uploaded';
  const config = configs[statusKey] || defaultConfig;
  const Icon = config.icon;

  const sizeClasses = size === 'sm'
    ? 'px-1.5 py-0.5 text-[8px] gap-1'
    : 'px-2 py-1 text-[10px] gap-1.5';

  const iconSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';

  return (
    <span
      className={`inline-flex items-center rounded-lg font-bold uppercase tracking-wide ${sizeClasses}`}
      style={{ background: config.bg, color: config.color }}
    >
      <Icon className={iconSize} />
      {config.label}
    </span>
  );
};

export default RedlineStatusBadge;
