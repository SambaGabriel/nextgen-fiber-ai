# NextGen CRM - Job Redlines Implementation Plan

## Executive Summary

This plan restructures the system to handle **Job Redlines** (documents submitted after production) as a workflow layer inside Jobs Management, NOT as a separate page.

### Key Distinction
- **Rate Card Redlines** (existing): Changes to rate card pricing that need approval
- **Job Redlines** (NEW): Marked-up documents/PDFs attached to jobs after lineman submits production

---

## PHASE 1: REMOVE STANDALONE REDLINES MENU

### Files to Modify

#### 1. `/components/Layout.tsx`
**Action:** Remove "Redlines" from navigation for Admin/Supervisor roles

```diff
// Line 79-88: Admin/Supervisor navigation
if (isAdmin || isSupervisor) {
    return [
        { id: ViewState.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
        { id: ViewState.JOBS_ADMIN, label: 'Jobs', icon: Briefcase },
        { id: ViewState.FINANCE_HUB, label: 'Invoices', icon: Wallet },
        { id: ViewState.MAP_ANALYZER, label: 'Maps', icon: ScanLine },
        { id: ViewState.RATE_CARDS, label: 'Rate Cards', icon: DollarSign },
-       { id: ViewState.REDLINES, label: 'Redlines', icon: ClipboardList },
        { id: ViewState.SETTINGS, label: 'Settings', icon: Settings },
    ];
}

// Line 101-108: Redline Specialist navigation
if (isRedlineSpecialist) {
    return [
        { id: ViewState.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
+       { id: ViewState.JOBS_ADMIN, label: 'Jobs', icon: Briefcase },  // ADD: Jobs access
        { id: ViewState.RATE_CARDS, label: 'Rate Cards', icon: DollarSign },
-       { id: ViewState.REDLINES, label: 'Redlines', icon: ClipboardList },
        { id: ViewState.SETTINGS, label: 'Settings', icon: Settings },
    ];
}

// Line 111-118: Client Reviewer navigation
if (isClientReviewer) {
    return [
        { id: ViewState.CLIENT_PORTAL, label: 'Portal', icon: LayoutDashboard },
        { id: ViewState.CLIENT_JOBS, label: 'Jobs', icon: Briefcase },
-       { id: ViewState.CLIENT_REDLINES, label: 'Redlines', icon: ClipboardList },
        { id: ViewState.SETTINGS, label: 'Settings', icon: Settings },
    ];
}
```

#### 2. `/types.ts` - ViewState Enum
**Action:** Keep but deprecate REDLINES views, add new JOB_DETAIL_ADMIN

```typescript
// Keep these for now (remove in future cleanup):
REDLINES = 'REDLINES',          // @deprecated - Rate Card Redlines (access from Rate Cards)
REDLINE_EDITOR = 'REDLINE_EDITOR',
REDLINE_REVIEW = 'REDLINE_REVIEW',
CLIENT_REDLINES = 'CLIENT_REDLINES',

// Add new view for admin job details with redlines:
JOB_DETAIL_ADMIN = 'JOB_DETAIL_ADMIN',  // Admin view of job with redlines panel
```

#### 3. `/App.tsx`
**Action:** Update routing - redirect old REDLINES to JOBS_ADMIN

```typescript
// In renderContent(), change REDLINES case:
case ViewState.REDLINES:
case ViewState.REDLINE_EDITOR:
case ViewState.REDLINE_REVIEW:
    // Redirect to Jobs Admin where redlines are now handled
    setCurrentView(ViewState.JOBS_ADMIN);
    return null;

// Add new case for admin job details:
case ViewState.JOB_DETAIL_ADMIN:
    return selectedJob ? (
        <JobDetailsAdmin
            job={selectedJob}
            user={user}
            lang={currentLang}
            onBack={() => setCurrentView(ViewState.JOBS_ADMIN)}
        />
    ) : null;
```

---

## PHASE 2: ENHANCED JOB STATUSES

### Update `/types/project.ts`

```typescript
// Replace JobStatus enum with expanded workflow:
export enum JobStatus {
  // Assignment Phase
  UNASSIGNED = 'unassigned',           // Created but not assigned
  ASSIGNED = 'assigned',               // Assigned to lineman

  // Production Phase
  IN_PROGRESS = 'in_progress',         // Lineman started
  PRODUCTION_SUBMITTED = 'production_submitted', // Lineman submitted production

  // Redline Phase
  PENDING_REDLINES = 'pending_redlines',     // Waiting for redline upload
  REDLINE_UPLOADED = 'redline_uploaded',     // Redline files uploaded
  UNDER_CLIENT_REVIEW = 'under_client_review', // Sent to client for review

  // Approval Phase
  APPROVED = 'approved',               // Client approved + SR assigned
  REJECTED = 'rejected',               // Client rejected, needs fix

  // Completion Phase
  READY_TO_INVOICE = 'ready_to_invoice', // Ready for billing
  COMPLETED = 'completed'              // Invoiced and done
}

// Add RedlineStatus for tracking within job:
export enum RedlineStatus {
  NOT_UPLOADED = 'not_uploaded',
  UPLOADED = 'uploaded',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected'
}

// Extend Job interface:
export interface Job {
  // ... existing fields ...

  // Redline workflow (NEW)
  redlineStatus?: RedlineStatus;
  srNumber?: string;                    // SR number when approved
  srReference?: string;                 // External SR link
  lastRedlineVersionNumber?: number;

  // Redline versions stored in separate table
  redlineVersions?: RedlineVersion[];
}
```

### Add New Interfaces

```typescript
// Job Redline Version (document uploads)
export interface RedlineVersion {
  id: string;
  jobId: string;
  versionNumber: number;              // Auto-increment: v1, v2, v3...
  files: RedlineFile[];
  uploadedByUserId: string;
  uploadedByName: string;
  uploadedAt: string;
  internalNotes?: string;             // Specialist notes
  clientNotes?: string;               // Notes visible to client
  reviewStatus: RedlineStatus;
  reviewedAt?: string;
  reviewedByUserId?: string;
  reviewedByName?: string;
  reviewerNotes?: string;             // Required if rejected
}

// Individual file in a redline version
export interface RedlineFile {
  id: string;
  redlineVersionId: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
}

// Review record (audit trail)
export interface RedlineReviewRecord {
  id: string;
  redlineVersionId: string;
  reviewerUserId: string;
  reviewerName: string;
  reviewerRole: string;
  action: 'approve' | 'reject';
  srNumber?: string;                  // Required if approved
  notes?: string;                     // Required if rejected
  reviewedAt: string;
}
```

---

## PHASE 3: DATABASE SCHEMA

### Migration: `008_job_redlines.sql`

```sql
-- ============================================================================
-- Migration 008: Job Redlines Workflow
-- ============================================================================
-- Implements document redlines attached to jobs (NOT rate card redlines)
-- ============================================================================

-- 1. ADD COLUMNS TO JOBS TABLE
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS redline_status TEXT DEFAULT 'not_uploaded'
    CHECK (redline_status IN ('not_uploaded', 'uploaded', 'under_review', 'approved', 'rejected'));
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS sr_number TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS sr_reference TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_redline_version_number INTEGER DEFAULT 0;

-- 2. JOB REDLINE VERSIONS TABLE
CREATE TABLE IF NOT EXISTS job_redline_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,

    -- Uploader info
    uploaded_by_user_id UUID REFERENCES auth.users(id),
    uploaded_by_name TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Notes
    internal_notes TEXT,              -- Visible to admin/specialist
    client_notes TEXT,                -- Visible to client

    -- Review status
    review_status TEXT DEFAULT 'uploaded'
        CHECK (review_status IN ('uploaded', 'under_review', 'approved', 'rejected')),

    -- Review info
    reviewed_at TIMESTAMPTZ,
    reviewed_by_user_id UUID REFERENCES auth.users(id),
    reviewed_by_name TEXT,
    reviewer_notes TEXT,              -- Required if rejected

    -- Constraints
    UNIQUE(job_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_redline_versions_job ON job_redline_versions(job_id);
CREATE INDEX IF NOT EXISTS idx_redline_versions_status ON job_redline_versions(review_status);

-- 3. JOB REDLINE FILES TABLE
CREATE TABLE IF NOT EXISTS job_redline_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    redline_version_id UUID NOT NULL REFERENCES job_redline_versions(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_redline_files_version ON job_redline_files(redline_version_id);

-- 4. JOB REDLINE REVIEW AUDIT LOG
CREATE TABLE IF NOT EXISTS job_redline_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    redline_version_id UUID NOT NULL REFERENCES job_redline_versions(id),
    reviewer_user_id UUID NOT NULL REFERENCES auth.users(id),
    reviewer_name TEXT NOT NULL,
    reviewer_role TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('approve', 'reject', 'submit_for_review')),
    sr_number TEXT,                   -- Required if action = 'approve'
    notes TEXT,                       -- Required if action = 'reject'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_redline_reviews_version ON job_redline_reviews(redline_version_id);

-- 5. HELPER FUNCTION: Get next version number
CREATE OR REPLACE FUNCTION get_next_job_redline_version(p_job_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    next_version INTEGER;
BEGIN
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO next_version
    FROM job_redline_versions
    WHERE job_id = p_job_id;

    RETURN next_version;
END;
$$;

-- 6. TRIGGER: Auto-update job status when redline is uploaded
CREATE OR REPLACE FUNCTION update_job_on_redline_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update job's redline status and version number
    UPDATE jobs
    SET
        redline_status = 'uploaded',
        status = CASE
            WHEN status = 'production_submitted' OR status = 'pending_redlines' THEN 'redline_uploaded'
            ELSE status
        END,
        last_redline_version_number = NEW.version_number,
        updated_at = NOW()
    WHERE id = NEW.job_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_job_on_redline ON job_redline_versions;
CREATE TRIGGER trg_update_job_on_redline
    AFTER INSERT ON job_redline_versions
    FOR EACH ROW
    EXECUTE FUNCTION update_job_on_redline_upload();

-- 7. TRIGGER: Auto-update job status when production is submitted
CREATE OR REPLACE FUNCTION update_job_redline_status_on_production()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- When production_data is set and no redlines exist, set to pending_redlines
    IF NEW.production_data IS NOT NULL
       AND OLD.production_data IS NULL
       AND NEW.last_redline_version_number = 0 THEN
        NEW.status := 'pending_redlines';
        NEW.redline_status := 'not_uploaded';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_pending_redlines ON jobs;
CREATE TRIGGER trg_job_pending_redlines
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_job_redline_status_on_production();

-- 8. RLS POLICIES
ALTER TABLE job_redline_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_redline_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_redline_reviews ENABLE ROW LEVEL SECURITY;

-- Everyone can view redline versions for jobs they can see
CREATE POLICY redline_versions_select ON job_redline_versions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM jobs WHERE jobs.id = job_redline_versions.job_id)
    );

-- Admin/Specialist can insert redline versions
CREATE POLICY redline_versions_insert ON job_redline_versions
    FOR INSERT WITH CHECK (
        get_user_role(auth.uid()) IN ('admin', 'supervisor', 'redline_specialist')
    );

-- Files follow same rules as versions
CREATE POLICY redline_files_select ON job_redline_files
    FOR SELECT USING (true);

CREATE POLICY redline_files_insert ON job_redline_files
    FOR INSERT WITH CHECK (
        get_user_role(auth.uid()) IN ('admin', 'supervisor', 'redline_specialist')
    );

-- Reviews can be inserted by admin/specialist/client_reviewer
CREATE POLICY redline_reviews_select ON job_redline_reviews
    FOR SELECT USING (true);

CREATE POLICY redline_reviews_insert ON job_redline_reviews
    FOR INSERT WITH CHECK (
        get_user_role(auth.uid()) IN ('admin', 'supervisor', 'redline_specialist', 'client_reviewer')
    );

-- 9. GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION get_next_job_redline_version(UUID) TO authenticated;

COMMENT ON TABLE job_redline_versions IS 'Document redline versions attached to jobs';
COMMENT ON TABLE job_redline_files IS 'Files within each redline version';
COMMENT ON TABLE job_redline_reviews IS 'Audit trail for redline approvals/rejections';
```

---

## PHASE 4: SERVICE LAYER

### New File: `/services/jobRedlineService.ts`

```typescript
/**
 * Job Redline Service
 * Handles document redlines attached to jobs (NOT rate card redlines)
 */

import { supabase } from './supabase';
import { RedlineVersion, RedlineFile, RedlineStatus, JobStatus } from '../types/project';

// Get all redline versions for a job
export async function getJobRedlines(jobId: string): Promise<RedlineVersion[]> {
  const { data, error } = await supabase
    .from('job_redline_versions')
    .select(`
      *,
      files:job_redline_files(*)
    `)
    .eq('job_id', jobId)
    .order('version_number', { ascending: false });

  if (error) {
    console.error('[jobRedlineService] Error fetching redlines:', error);
    return [];
  }

  return data.map(row => ({
    id: row.id,
    jobId: row.job_id,
    versionNumber: row.version_number,
    files: row.files || [],
    uploadedByUserId: row.uploaded_by_user_id,
    uploadedByName: row.uploaded_by_name,
    uploadedAt: row.uploaded_at,
    internalNotes: row.internal_notes,
    clientNotes: row.client_notes,
    reviewStatus: row.review_status as RedlineStatus,
    reviewedAt: row.reviewed_at,
    reviewedByUserId: row.reviewed_by_user_id,
    reviewedByName: row.reviewed_by_name,
    reviewerNotes: row.reviewer_notes
  }));
}

// Upload new redline version
export async function uploadRedlineVersion(
  jobId: string,
  files: File[],
  uploadedByUserId: string,
  uploadedByName: string,
  internalNotes?: string,
  clientNotes?: string
): Promise<RedlineVersion | null> {
  // 1. Get next version number
  const { data: versionData } = await supabase
    .rpc('get_next_job_redline_version', { p_job_id: jobId });

  const versionNumber = versionData || 1;

  // 2. Create version record
  const { data: version, error: versionError } = await supabase
    .from('job_redline_versions')
    .insert({
      job_id: jobId,
      version_number: versionNumber,
      uploaded_by_user_id: uploadedByUserId,
      uploaded_by_name: uploadedByName,
      internal_notes: internalNotes,
      client_notes: clientNotes,
      review_status: 'uploaded'
    })
    .select()
    .single();

  if (versionError) {
    console.error('[jobRedlineService] Error creating version:', versionError);
    return null;
  }

  // 3. Upload files to storage and create file records
  const uploadedFiles: RedlineFile[] = [];

  for (const file of files) {
    const filePath = `job-redlines/${jobId}/v${versionNumber}/${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error('[jobRedlineService] Error uploading file:', uploadError);
      continue;
    }

    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    const { data: fileRecord } = await supabase
      .from('job_redline_files')
      .insert({
        redline_version_id: version.id,
        file_url: urlData.publicUrl,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size
      })
      .select()
      .single();

    if (fileRecord) {
      uploadedFiles.push(fileRecord);
    }
  }

  return {
    ...version,
    files: uploadedFiles
  };
}

// Submit redline for client review
export async function submitForReview(
  versionId: string,
  submittedByUserId: string,
  submittedByName: string
): Promise<boolean> {
  const { error: versionError } = await supabase
    .from('job_redline_versions')
    .update({ review_status: 'under_review' })
    .eq('id', versionId);

  if (versionError) return false;

  // Get job_id from version
  const { data: version } = await supabase
    .from('job_redline_versions')
    .select('job_id')
    .eq('id', versionId)
    .single();

  if (!version) return false;

  // Update job status
  await supabase
    .from('jobs')
    .update({
      status: 'under_client_review',
      redline_status: 'under_review'
    })
    .eq('id', version.job_id);

  // Create audit record
  await supabase
    .from('job_redline_reviews')
    .insert({
      redline_version_id: versionId,
      reviewer_user_id: submittedByUserId,
      reviewer_name: submittedByName,
      reviewer_role: 'redline_specialist',
      action: 'submit_for_review'
    });

  return true;
}

// Approve redline (requires SR number)
export async function approveRedline(
  versionId: string,
  reviewerUserId: string,
  reviewerName: string,
  reviewerRole: string,
  srNumber: string
): Promise<boolean> {
  if (!srNumber) {
    console.error('[jobRedlineService] SR number required for approval');
    return false;
  }

  // Update version
  const { error: versionError } = await supabase
    .from('job_redline_versions')
    .update({
      review_status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by_user_id: reviewerUserId,
      reviewed_by_name: reviewerName
    })
    .eq('id', versionId);

  if (versionError) return false;

  // Get job_id
  const { data: version } = await supabase
    .from('job_redline_versions')
    .select('job_id')
    .eq('id', versionId)
    .single();

  if (!version) return false;

  // Update job
  await supabase
    .from('jobs')
    .update({
      status: 'approved',
      redline_status: 'approved',
      sr_number: srNumber
    })
    .eq('id', version.job_id);

  // Create audit record
  await supabase
    .from('job_redline_reviews')
    .insert({
      redline_version_id: versionId,
      reviewer_user_id: reviewerUserId,
      reviewer_name: reviewerName,
      reviewer_role: reviewerRole,
      action: 'approve',
      sr_number: srNumber
    });

  return true;
}

// Reject redline (requires notes)
export async function rejectRedline(
  versionId: string,
  reviewerUserId: string,
  reviewerName: string,
  reviewerRole: string,
  notes: string
): Promise<boolean> {
  if (!notes) {
    console.error('[jobRedlineService] Notes required for rejection');
    return false;
  }

  // Update version
  const { error: versionError } = await supabase
    .from('job_redline_versions')
    .update({
      review_status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by_user_id: reviewerUserId,
      reviewed_by_name: reviewerName,
      reviewer_notes: notes
    })
    .eq('id', versionId);

  if (versionError) return false;

  // Get job_id
  const { data: version } = await supabase
    .from('job_redline_versions')
    .select('job_id')
    .eq('id', versionId)
    .single();

  if (!version) return false;

  // Update job
  await supabase
    .from('jobs')
    .update({
      status: 'rejected',
      redline_status: 'rejected'
    })
    .eq('id', version.job_id);

  // Create audit record
  await supabase
    .from('job_redline_reviews')
    .insert({
      redline_version_id: versionId,
      reviewer_user_id: reviewerUserId,
      reviewer_name: reviewerName,
      reviewer_role: reviewerRole,
      action: 'reject',
      notes: notes
    });

  return true;
}
```

---

## PHASE 5: FRONTEND COMPONENTS

### 5.1 Jobs Management Table Enhancement

#### Update `/components/JobsAdmin.tsx`

Add new columns for redline status visibility:

```typescript
// Add to table header
<th>PRODUCTION</th>
<th>REDLINES</th>
<th>SR #</th>

// Add to table row
<td>
  <StatusBadge
    status={job.productionData ? 'submitted' : 'pending'}
    label={job.productionData ? 'Submitted' : 'Pending'}
  />
</td>
<td>
  <RedlineStatusBadge status={job.redlineStatus || 'not_uploaded'} />
</td>
<td className="font-mono text-sm">
  {job.srNumber || '-'}
</td>
```

#### New Component: `/components/jobs/RedlineStatusBadge.tsx`

```typescript
import React from 'react';
import { RedlineStatus } from '../../types/project';
import { AlertCircle, Upload, Clock, CheckCircle, XCircle } from 'lucide-react';

interface Props {
  status: RedlineStatus;
}

const configs: Record<RedlineStatus, { icon: any; label: string; bg: string; color: string }> = {
  not_uploaded: {
    icon: AlertCircle,
    label: 'Pending Redlines',
    bg: 'var(--alert-dim)',
    color: 'var(--alert-core)'
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

export const RedlineStatusBadge: React.FC<Props> = ({ status }) => {
  const config = configs[status];
  const Icon = config.icon;

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase"
      style={{ background: config.bg, color: config.color }}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
};
```

### 5.2 Job Details Admin View

#### New Component: `/components/jobs/JobDetailsAdmin.tsx`

This is the comprehensive job detail view for Admin/Supervisor with:
- Job info
- Map preview (embedded PDF)
- Full production data with entries table
- Redlines panel (upload, versions, review)

```typescript
/**
 * JobDetailsAdmin - Admin/Supervisor view of job with full redlines panel
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Job, RedlineVersion, User, Language } from '../../types';
import { jobRedlineService } from '../../services/jobRedlineService';
import { JobInfoCard } from './JobInfoCard';
import { MapPreviewCard } from './MapPreviewCard';
import { ProductionDataCard } from './ProductionDataCard';
import { RedlinesPanel } from './RedlinesPanel';

interface Props {
  job: Job;
  user: User;
  lang: Language;
  onBack: () => void;
  onRefresh: () => void;
}

export const JobDetailsAdmin: React.FC<Props> = ({ job, user, lang, onBack, onRefresh }) => {
  const [redlines, setRedlines] = useState<RedlineVersion[]>([]);
  const [loading, setLoading] = useState(true);

  // Load redlines
  useEffect(() => {
    loadRedlines();
  }, [job.id]);

  const loadRedlines = async () => {
    setLoading(true);
    const data = await jobRedlineService.getJobRedlines(job.id);
    setRedlines(data);
    setLoading(false);
  };

  return (
    <div className="min-h-full pb-8" style={{ background: 'var(--void)' }}>
      {/* Header with back button */}
      <header className="px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <button onClick={onBack} className="flex items-center gap-2 text-sm mb-4">
          ← Back to Jobs
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black">{job.title}</h1>
            <p className="text-sm text-gray-500">{job.jobCode} • {job.clientName}</p>
          </div>
          <JobStatusBadge status={job.status} />
        </div>
      </header>

      {/* Two-column layout */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Job info + Status */}
        <div className="space-y-6">
          <JobInfoCard job={job} lang={lang} />
          <JobStatusTimeline job={job} />
        </div>

        {/* Right columns: Map + Production + Redlines */}
        <div className="lg:col-span-2 space-y-6">
          {/* Map Preview */}
          <MapPreviewCard job={job} lang={lang} />

          {/* Production Data - FULL TABLE */}
          {job.productionData && (
            <ProductionDataCard productionData={job.productionData} lang={lang} />
          )}

          {/* Redlines Panel - THE MAIN FEATURE */}
          <RedlinesPanel
            job={job}
            redlines={redlines}
            user={user}
            lang={lang}
            onUpload={loadRedlines}
            onReview={loadRedlines}
          />
        </div>
      </div>
    </div>
  );
};
```

### 5.3 Production Data Card (Full Entries)

#### New Component: `/components/jobs/ProductionDataCard.tsx`

```typescript
/**
 * ProductionDataCard - Shows FULL production submission with entries table
 */

import React from 'react';
import { CheckCircle2, Ruler, Anchor, Circle, Snowflake } from 'lucide-react';

interface Props {
  productionData: {
    submittedAt: string;
    completedDate?: string;
    totalFootage: number;
    anchorCount: number;
    coilCount: number;
    snowshoeCount: number;
    entries: Array<{
      spanFeet: number;
      anchor: boolean;
      fiberNumber: string;
      coil: boolean;
      snowshoe: boolean;
      notes?: string;
    }>;
    comments?: string;
  };
  lang: string;
}

export const ProductionDataCard: React.FC<Props> = ({ productionData, lang }) => {
  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}
    >
      <h3 className="text-xs font-bold uppercase tracking-wider mb-6 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--online-core)' }} />
        Submitted Production Data
      </h3>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-xl" style={{ background: 'var(--elevated)' }}>
          <Ruler className="w-5 h-5 mb-2" style={{ color: 'var(--neural-core)' }} />
          <p className="text-2xl font-black">{productionData.totalFootage.toLocaleString()}</p>
          <p className="text-[9px] uppercase font-bold text-gray-500">Total Feet</p>
        </div>
        <div className="p-4 rounded-xl" style={{ background: 'var(--elevated)' }}>
          <Anchor className="w-5 h-5 mb-2" style={{ color: 'var(--energy-core)' }} />
          <p className="text-2xl font-black">{productionData.anchorCount}</p>
          <p className="text-[9px] uppercase font-bold text-gray-500">Anchors</p>
        </div>
        <div className="p-4 rounded-xl" style={{ background: 'var(--elevated)' }}>
          <Circle className="w-5 h-5 mb-2" style={{ color: 'var(--online-core)' }} />
          <p className="text-2xl font-black">{productionData.coilCount}</p>
          <p className="text-[9px] uppercase font-bold text-gray-500">Coils</p>
        </div>
        <div className="p-4 rounded-xl" style={{ background: 'var(--elevated)' }}>
          <Snowflake className="w-5 h-5 mb-2" style={{ color: 'var(--alert-core)' }} />
          <p className="text-2xl font-black">{productionData.snowshoeCount}</p>
          <p className="text-[9px] uppercase font-bold text-gray-500">Snowshoes</p>
        </div>
      </div>

      {/* Entries Table - FULL DATA */}
      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border-default)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--elevated)' }}>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase">#</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase">Span (ft)</th>
              <th className="px-4 py-3 text-center text-[10px] font-bold uppercase">Anchor</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase">Fiber #</th>
              <th className="px-4 py-3 text-center text-[10px] font-bold uppercase">Coil</th>
              <th className="px-4 py-3 text-center text-[10px] font-bold uppercase">Snowshoe</th>
              <th className="px-4 py-3 text-left text-[10px] font-bold uppercase">Notes</th>
            </tr>
          </thead>
          <tbody>
            {productionData.entries.map((entry, index) => (
              <tr
                key={index}
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
              >
                <td className="px-4 py-3 font-mono text-gray-500">{index + 1}</td>
                <td className="px-4 py-3 font-bold">{entry.spanFeet}</td>
                <td className="px-4 py-3 text-center">
                  {entry.anchor && <CheckMark />}
                </td>
                <td className="px-4 py-3 font-mono">{entry.fiberNumber || '-'}</td>
                <td className="px-4 py-3 text-center">
                  {entry.coil && <CheckMark color="var(--online-core)" />}
                </td>
                <td className="px-4 py-3 text-center">
                  {entry.snowshoe && <CheckMark color="var(--alert-core)" />}
                </td>
                <td className="px-4 py-3 text-gray-500">{entry.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: 'var(--elevated)' }}>
              <td className="px-4 py-3 font-bold">TOTAL</td>
              <td className="px-4 py-3 font-black text-lg">{productionData.totalFootage} ft</td>
              <td className="px-4 py-3 text-center font-bold">{productionData.anchorCount}</td>
              <td className="px-4 py-3"></td>
              <td className="px-4 py-3 text-center font-bold">{productionData.coilCount}</td>
              <td className="px-4 py-3 text-center font-bold">{productionData.snowshoeCount}</td>
              <td className="px-4 py-3"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Comments */}
      {productionData.comments && (
        <div className="mt-4 p-4 rounded-xl" style={{ background: 'var(--elevated)' }}>
          <p className="text-[10px] font-bold uppercase mb-2">Lineman Comments</p>
          <p className="text-sm">{productionData.comments}</p>
        </div>
      )}

      {/* Timestamps */}
      <div className="mt-4 flex gap-4 text-xs text-gray-500">
        <span>Completed: {productionData.completedDate || 'N/A'}</span>
        <span>Submitted: {new Date(productionData.submittedAt).toLocaleString()}</span>
      </div>
    </div>
  );
};

const CheckMark = ({ color = 'var(--neural-core)' }) => (
  <div
    className="w-6 h-6 rounded-full flex items-center justify-center mx-auto"
    style={{ background: color }}
  >
    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  </div>
);
```

### 5.4 Redlines Panel Component

#### New Component: `/components/jobs/RedlinesPanel.tsx`

```typescript
/**
 * RedlinesPanel - Upload, view versions, and review redlines
 * THIS IS THE CORE OF THE NEW WORKFLOW
 */

import React, { useState, useCallback } from 'react';
import { Upload, FileText, Clock, CheckCircle, XCircle, Send, Eye, Download, Plus } from 'lucide-react';
import { Job, RedlineVersion, RedlineStatus, User } from '../../types/project';
import { jobRedlineService } from '../../services/jobRedlineService';

interface Props {
  job: Job;
  redlines: RedlineVersion[];
  user: User;
  lang: string;
  onUpload: () => void;
  onReview: () => void;
}

export const RedlinesPanel: React.FC<Props> = ({ job, redlines, user, lang, onUpload, onReview }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewingVersion, setReviewingVersion] = useState<RedlineVersion | null>(null);

  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPERVISOR';
  const isRedlineSpecialist = user.role === 'REDLINE_SPECIALIST';
  const isClientReviewer = user.role === 'CLIENT_REVIEWER';
  const canUpload = isAdmin || isRedlineSpecialist;
  const canReview = isAdmin || isClientReviewer;

  // Handle file upload
  const handleUpload = useCallback(async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    const result = await jobRedlineService.uploadRedlineVersion(
      job.id,
      selectedFiles,
      user.id,
      user.name,
      notes
    );

    if (result) {
      setShowUploadModal(false);
      setSelectedFiles([]);
      setNotes('');
      onUpload();
    }
    setIsUploading(false);
  }, [job.id, selectedFiles, user, notes, onUpload]);

  // Handle submit for review
  const handleSubmitForReview = useCallback(async (version: RedlineVersion) => {
    const success = await jobRedlineService.submitForReview(
      version.id,
      user.id,
      user.name
    );
    if (success) {
      onReview();
    }
  }, [user, onReview]);

  // Get latest version
  const latestVersion = redlines[0];
  const hasPendingRedlines = job.productionData && redlines.length === 0;

  return (
    <div
      className="rounded-2xl p-6"
      style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Redlines
          {redlines.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px]" style={{ background: 'var(--neural-dim)' }}>
              v{latestVersion.versionNumber}
            </span>
          )}
        </h3>

        {canUpload && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2"
            style={{ background: 'var(--gradient-neural)', color: '#000' }}
          >
            <Plus className="w-4 h-4" />
            Upload New Version
          </button>
        )}
      </div>

      {/* Alert: Pending Redlines */}
      {hasPendingRedlines && (
        <div
          className="p-4 rounded-xl mb-4 flex items-center gap-3"
          style={{ background: 'var(--alert-dim)', border: '1px solid var(--alert-core)' }}
        >
          <Clock className="w-6 h-6" style={{ color: 'var(--alert-core)' }} />
          <div>
            <p className="font-bold" style={{ color: 'var(--alert-core)' }}>Pending Redlines</p>
            <p className="text-sm text-gray-600">
              Production submitted. Upload redline documents to proceed.
            </p>
          </div>
        </div>
      )}

      {/* Version History */}
      {redlines.length > 0 ? (
        <div className="space-y-4">
          {redlines.map((version) => (
            <RedlineVersionCard
              key={version.id}
              version={version}
              isLatest={version.id === latestVersion.id}
              canSubmitForReview={canUpload && version.reviewStatus === 'uploaded'}
              canReview={canReview && version.reviewStatus === 'under_review'}
              onSubmitForReview={() => handleSubmitForReview(version)}
              onReview={() => {
                setReviewingVersion(version);
                setShowReviewModal(true);
              }}
            />
          ))}
        </div>
      ) : !hasPendingRedlines && (
        <div className="text-center py-8 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No redlines uploaded yet</p>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <UploadRedlineModal
          onClose={() => setShowUploadModal(false)}
          onUpload={handleUpload}
          selectedFiles={selectedFiles}
          setSelectedFiles={setSelectedFiles}
          notes={notes}
          setNotes={setNotes}
          isUploading={isUploading}
        />
      )}

      {/* Review Modal */}
      {showReviewModal && reviewingVersion && (
        <ReviewRedlineModal
          version={reviewingVersion}
          user={user}
          onClose={() => {
            setShowReviewModal(false);
            setReviewingVersion(null);
          }}
          onReviewComplete={() => {
            setShowReviewModal(false);
            setReviewingVersion(null);
            onReview();
          }}
        />
      )}
    </div>
  );
};

// Sub-components would be defined here:
// - RedlineVersionCard
// - UploadRedlineModal
// - ReviewRedlineModal (with approve/reject and SR input)
```

---

## PHASE 6: TEST CHECKLIST

### Functionality Tests

| # | Test Case | Expected Result | Status |
|---|-----------|-----------------|--------|
| 1 | Login as Admin | No "Redlines" menu item in sidebar | ☐ |
| 2 | Login as Redline Specialist | Jobs menu visible, no standalone Redlines | ☐ |
| 3 | Open Job Details for submitted job | Map PDF preview loads correctly | ☐ |
| 4 | View submitted production | Full entries table visible (not just summary) | ☐ |
| 5 | Submit production (no redlines) | Job status = "Pending Redlines" badge appears | ☐ |
| 6 | Upload redline as Specialist | Version v1 created, status = "Uploaded" | ☐ |
| 7 | Submit for Review | Status = "Under Review", Job = "Under Client Review" | ☐ |
| 8 | Approve without SR number | BLOCKED - SR number required | ☐ |
| 9 | Approve with SR number | SR saved on job, status = "Approved" | ☐ |
| 10 | Reject without notes | BLOCKED - rejection notes required | ☐ |
| 11 | Reject with notes | Status = "Rejected", Job = "Rejected (Needs Fix)" | ☐ |
| 12 | Upload new version after rejection | v2 created, status reset to "Uploaded" | ☐ |
| 13 | Jobs table shows redline badges | "Pending Redlines" badge visible for relevant jobs | ☐ |
| 14 | Jobs table shows SR column | SR number displays after approval | ☐ |
| 15 | Client Reviewer can only approve/reject | No upload capability, only review | ☐ |

---

## FILE CHANGES SUMMARY

### Files to Modify
1. `/components/Layout.tsx` - Remove Redlines menu items
2. `/types.ts` - Deprecate REDLINES ViewState
3. `/types/project.ts` - Add new statuses and interfaces
4. `/App.tsx` - Update routing
5. `/components/JobsAdmin.tsx` - Add redline status columns
6. `/components/JobDetails.tsx` - Enhance production display

### Files to Create
1. `/database/migrations/008_job_redlines.sql` - New schema
2. `/services/jobRedlineService.ts` - Service layer
3. `/components/jobs/RedlineStatusBadge.tsx` - Status badge component
4. `/components/jobs/JobDetailsAdmin.tsx` - Admin job detail view
5. `/components/jobs/ProductionDataCard.tsx` - Full production display
6. `/components/jobs/RedlinesPanel.tsx` - Main redlines panel
7. `/components/jobs/MapPreviewCard.tsx` - Enhanced PDF viewer

### Files to Keep (Rate Card Redlines)
These are kept for future use but removed from navigation:
- `/components/redlines/RedlineList.tsx`
- `/components/redlines/RedlineEditor.tsx`
- `/services/redlineService.ts`
- `/types/redline.ts`
- `/database/migrations/005_redline_workflow.sql`

---

## IMPLEMENTATION ORDER

1. **Day 1**: Phase 1 (Remove menu) + Phase 2 (Types)
2. **Day 2**: Phase 3 (Database migration)
3. **Day 3**: Phase 4 (Service layer)
4. **Day 4-5**: Phase 5 (Frontend components)
5. **Day 6**: Phase 6 (Testing)

**Total Estimated Time**: 5-6 days

---

## NOTES

1. The existing "Rate Card Redlines" feature is kept intact but hidden from navigation. It can be accessed from Rate Cards page in the future if needed.

2. The Job Redlines are a completely new feature that tracks document uploads per job, NOT rate card changes.

3. The "Pending Redlines" state is critical for the Smartsheet-like workflow visibility.

4. SR Number is REQUIRED for approval - this is enforced at both service and UI level.

5. Rejection notes are REQUIRED - this ensures clear communication on what needs fixing.
