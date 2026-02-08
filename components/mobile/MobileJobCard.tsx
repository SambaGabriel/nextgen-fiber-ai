/**
 * MobileJobCard - Mobile-optimized job card component with swipe actions
 * Designed for touch-first interaction on mobile devices
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  MapPin, Calendar, Play, MessageCircle, Navigation,
  ChevronRight
} from 'lucide-react';
import { Job, JobStatus } from '../../types/project';

interface MobileJobCardProps {
  job: Job;
  onSelect: (job: Job) => void;
  onQuickAction?: (job: Job, action: 'start' | 'chat' | 'map') => void;
  unreadCount?: number;
}

// Status colors matching the design system
const statusColors: Record<string, { bg: string; text: string }> = {
  [JobStatus.ASSIGNED]: {
    bg: 'var(--info-core)',
    text: '#ffffff'
  },
  [JobStatus.IN_PROGRESS]: {
    bg: 'var(--warning-core)',
    text: '#000000'
  },
  [JobStatus.PRODUCTION_SUBMITTED]: {
    bg: 'var(--success-core)',
    text: '#ffffff'
  },
  [JobStatus.SUBMITTED]: {
    bg: 'var(--success-core)',
    text: '#ffffff'
  },
  [JobStatus.PENDING_REDLINES]: {
    bg: 'var(--critical-core)',
    text: '#ffffff'
  },
  // Default fallback
  default: {
    bg: 'var(--elevated)',
    text: 'var(--text-primary)'
  }
};

// Status labels
const statusLabels: Record<string, string> = {
  [JobStatus.UNASSIGNED]: 'Unassigned',
  [JobStatus.ASSIGNED]: 'Assigned',
  [JobStatus.IN_PROGRESS]: 'In Progress',
  [JobStatus.SUBMITTED]: 'Submitted',
  [JobStatus.PRODUCTION_SUBMITTED]: 'Submitted',
  [JobStatus.PENDING_REDLINES]: 'Pending Redlines',
  [JobStatus.REDLINE_UPLOADED]: 'Redline Uploaded',
  [JobStatus.UNDER_CLIENT_REVIEW]: 'Under Review',
  [JobStatus.APPROVED]: 'Approved',
  [JobStatus.REJECTED]: 'Rejected',
  [JobStatus.NEEDS_REVISION]: 'Needs Revision',
  [JobStatus.READY_TO_INVOICE]: 'Ready to Invoice',
  [JobStatus.COMPLETED]: 'Completed'
};

// Check if status allows starting work
const canStartWork = (status: JobStatus): boolean => {
  return status === JobStatus.ASSIGNED;
};

const MobileJobCard: React.FC<MobileJobCardProps> = ({
  job,
  onSelect,
  onQuickAction,
  unreadCount = 0
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const statusConfig = statusColors[job.status] || statusColors.default;
  const statusLabel = statusLabels[job.status] || job.status;
  const showStartButton = canStartWork(job.status);

  // Format location
  const locationText = job.location?.city && job.location?.state
    ? `${job.location.city}, ${job.location.state}`
    : job.location?.city || job.location?.address || 'No location';

  // Format date
  const formattedDate = job.scheduledDate
    ? new Date(job.scheduledDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })
    : null;

  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsPressed(true);
  }, []);

  // Handle touch move for swipe detection
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;

    // Only track horizontal swipes (ignore vertical scrolling)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      setIsSwiping(true);
      setIsPressed(false);

      // Limit swipe distance
      const clampedX = Math.max(-100, Math.min(100, deltaX));
      setSwipeX(clampedX);
    }
  }, []);

  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    setIsPressed(false);

    if (isSwiping) {
      // Swipe right threshold - start production
      if (swipeX > 60 && showStartButton && onQuickAction) {
        onQuickAction(job, 'start');
      }
      // Swipe left threshold - view details
      else if (swipeX < -60) {
        onSelect(job);
      }
    }

    // Reset swipe state
    setSwipeX(0);
    setIsSwiping(false);
  }, [isSwiping, swipeX, showStartButton, onQuickAction, job, onSelect]);

  // Handle card click
  const handleClick = useCallback(() => {
    if (!isSwiping) {
      onSelect(job);
    }
  }, [isSwiping, onSelect, job]);

  // Handle quick action buttons
  const handleQuickAction = useCallback((e: React.MouseEvent, action: 'start' | 'chat' | 'map') => {
    e.stopPropagation();
    if (onQuickAction) {
      onQuickAction(job, action);
    }
  }, [onQuickAction, job]);

  return (
    <div
      ref={cardRef}
      className="relative overflow-hidden"
      style={{
        margin: '0 16px 12px 16px'
      }}
    >
      {/* Swipe hint backgrounds */}
      <div
        className="absolute inset-0 rounded-2xl flex items-center justify-start pl-4"
        style={{
          background: showStartButton ? 'var(--success-core)' : 'var(--elevated)',
          opacity: swipeX > 0 ? Math.min(swipeX / 100, 1) : 0,
          transition: isSwiping ? 'none' : 'opacity 0.2s ease'
        }}
      >
        {showStartButton && (
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Play className="w-5 h-5" />
            <span>Start</span>
          </div>
        )}
      </div>
      <div
        className="absolute inset-0 rounded-2xl flex items-center justify-end pr-4"
        style={{
          background: 'var(--info-core)',
          opacity: swipeX < 0 ? Math.min(Math.abs(swipeX) / 100, 1) : 0,
          transition: isSwiping ? 'none' : 'opacity 0.2s ease'
        }}
      >
        <div className="flex items-center gap-2 text-white font-bold text-sm">
          <span>Details</span>
          <ChevronRight className="w-5 h-5" />
        </div>
      </div>

      {/* Main card */}
      <div
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative rounded-2xl cursor-pointer"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-default)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.08)',
          transform: `translateX(${swipeX}px) scale(${isPressed ? 0.98 : 1})`,
          transition: isSwiping ? 'none' : 'transform 0.2s ease',
          touchAction: 'pan-y'
        }}
      >
        {/* Card content */}
        <div className="p-4">
          {/* Top row: Job code badge + Status pill */}
          <div className="flex items-center justify-between mb-3">
            <span
              className="px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide"
              style={{
                background: 'var(--elevated)',
                color: 'var(--text-secondary)'
              }}
            >
              {job.jobCode}
            </span>
            <span
              className="px-3 py-1 rounded-full text-xs font-bold"
              style={{
                background: statusConfig.bg,
                color: statusConfig.text
              }}
            >
              {statusLabel}
            </span>
          </div>

          {/* Title */}
          <h3
            className="text-base font-bold mb-2 truncate"
            style={{ color: 'var(--text-primary)' }}
          >
            {job.title}
          </h3>

          {/* Location */}
          <div
            className="flex items-center gap-1.5 mb-2 text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{locationText}</span>
          </div>

          {/* Client/Customer info */}
          <div
            className="text-sm mb-3"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {job.customerName && (
              <span>{job.customerName}</span>
            )}
            {job.customerName && job.clientName && (
              <span className="mx-1.5">|</span>
            )}
            {job.clientName && (
              <span>{job.clientName}</span>
            )}
          </div>

          {/* Footer: Scheduled date + Quick action buttons */}
          <div
            className="flex items-center justify-between pt-3"
            style={{ borderTop: '1px solid var(--border-subtle)' }}
          >
            {/* Scheduled date */}
            <div className="flex items-center gap-2">
              {formattedDate && (
                <div
                  className="flex items-center gap-1.5 text-sm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <Calendar className="w-4 h-4" />
                  <span>{formattedDate}</span>
                </div>
              )}
            </div>

            {/* Quick action buttons */}
            <div className="flex items-center gap-2">
              {/* Start Work button - only if status allows */}
              {showStartButton && onQuickAction && (
                <button
                  onClick={(e) => handleQuickAction(e, 'start')}
                  className="flex items-center justify-center rounded-xl transition-transform active:scale-95"
                  style={{
                    width: '48px',
                    height: '48px',
                    background: 'var(--success-core)',
                    color: '#ffffff'
                  }}
                  aria-label="Start Work"
                >
                  <Play className="w-5 h-5" />
                </button>
              )}

              {/* View Map button */}
              {onQuickAction && (
                <button
                  onClick={(e) => handleQuickAction(e, 'map')}
                  className="flex items-center justify-center rounded-xl transition-transform active:scale-95"
                  style={{
                    width: '48px',
                    height: '48px',
                    background: 'var(--info-core)',
                    color: '#ffffff'
                  }}
                  aria-label="View Map"
                >
                  <Navigation className="w-5 h-5" />
                </button>
              )}

              {/* Chat button with unread badge */}
              {onQuickAction && (
                <button
                  onClick={(e) => handleQuickAction(e, 'chat')}
                  className="relative flex items-center justify-center rounded-xl transition-transform active:scale-95"
                  style={{
                    width: '48px',
                    height: '48px',
                    background: 'var(--elevated)',
                    color: 'var(--text-primary)'
                  }}
                  aria-label="Chat"
                >
                  <MessageCircle className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span
                      className="absolute -top-1 -right-1 min-w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold px-1"
                      style={{
                        background: 'var(--critical-core)',
                        color: '#ffffff'
                      }}
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Swipe hint indicator (subtle) */}
      {!isSwiping && swipeX === 0 && (
        <div
          className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex items-center gap-1 text-xs opacity-40"
          style={{ color: 'var(--text-ghost)' }}
        >
          <ChevronRight className="w-3 h-3 rotate-180" />
          <span>swipe</span>
          <ChevronRight className="w-3 h-3" />
        </div>
      )}
    </div>
  );
};

export default MobileJobCard;
