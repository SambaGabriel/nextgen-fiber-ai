/**
 * Redline Types - Rate Card versioning and approval workflow
 */

export type RedlineStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'applied';

export type RedlineReviewAction = 'approve' | 'reject' | 'request_changes' | 'comment';

export interface RedlineChange {
  code: string;           // Rate code (e.g., 'BSPD82C')
  field: 'nextgen_rate' | 'lineman_rate' | 'truck_investor_rate';
  oldValue: number;
  newValue: number;
  description?: string;   // Optional description of why this change
}

export interface Redline {
  id: string;
  sourceProfileId: string;
  sourceGroupId: string;
  sourceProfileName?: string;
  sourceGroupName?: string;

  // Version tracking
  versionNumber: number;
  versionLabel?: string;  // 'v2.1', 'Q1 2024 Update'

  // Changes
  proposedChanges: RedlineChange[];
  changeSummary?: string;

  // Workflow status
  status: RedlineStatus;

  // Creator
  createdBy: string;
  createdByName: string;
  createdAt: string;

  // Submission
  submittedAt?: string;
  submittedBy?: string;

  // Review
  reviewedAt?: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewNotes?: string;

  // Application
  appliedAt?: string;
  appliedBy?: string;

  // SR Number (Customer Reference)
  srNumber?: string;
  srReference?: string;

  // Active flag
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface RedlineReview {
  id: string;
  redlineId: string;
  reviewerId: string;
  reviewerName: string;
  reviewerRole: string;  // 'ADMIN', 'REDLINE_SPECIALIST', 'CLIENT_REVIEWER'
  action: RedlineReviewAction;
  notes?: string;
  createdAt: string;
}

export interface CreateRedlineRequest {
  sourceProfileId: string;
  sourceGroupId: string;
  proposedChanges: RedlineChange[];
  changeSummary?: string;
  versionLabel?: string;
  srNumber?: string;
  srReference?: string;
}

export interface SubmitRedlineRequest {
  redlineId: string;
}

export interface ReviewRedlineRequest {
  redlineId: string;
  action: RedlineReviewAction;
  notes?: string;
}

export interface ApplyRedlineRequest {
  redlineId: string;
}

// Stats for dashboard
export interface RedlineStats {
  totalRedlines: number;
  draftCount: number;
  pendingReviewCount: number;
  approvedCount: number;
  rejectedCount: number;
  appliedCount: number;
  recentActivity: RedlineReview[];
}
