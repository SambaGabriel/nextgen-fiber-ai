-- ============================================================================
-- Migration 008: Job Redlines Workflow
-- ============================================================================
-- Implements document redlines attached to jobs (NOT rate card redlines)
-- This is the Smartsheet-like workflow: Production → Pending Redlines →
-- Redline Uploaded → Under Review → Approved/Rejected
-- ============================================================================

-- 1. ADD COLUMNS TO JOBS TABLE
-- These track the redline workflow state within the job
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS redline_status TEXT DEFAULT 'not_uploaded'
    CHECK (redline_status IN ('not_uploaded', 'uploaded', 'under_review', 'approved', 'rejected'));
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_redline_version_number INTEGER DEFAULT 0;

-- Note: sr_number already exists from previous migrations
-- ALTER TABLE jobs ADD COLUMN IF NOT EXISTS sr_number TEXT;
-- ALTER TABLE jobs ADD COLUMN IF NOT EXISTS sr_reference TEXT;

-- Update status check constraint to include new statuses
-- First drop existing constraint if it exists (may fail silently if not exists)
DO $$
BEGIN
    ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
    ALTER TABLE jobs ADD CONSTRAINT jobs_status_check CHECK (
        status IN (
            'unassigned', 'assigned', 'in_progress',
            'submitted', 'production_submitted',
            'pending_redlines', 'redline_uploaded', 'under_client_review',
            'approved', 'rejected', 'needs_revision',
            'ready_to_invoice', 'completed'
        )
    );
EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignore errors
END $$;

-- 2. JOB REDLINE VERSIONS TABLE
-- Each upload creates a new version (v1, v2, v3...)
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

    -- Review info (filled when reviewed)
    reviewed_at TIMESTAMPTZ,
    reviewed_by_user_id UUID REFERENCES auth.users(id),
    reviewed_by_name TEXT,
    reviewer_notes TEXT,              -- Required if rejected

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Each job can only have one version with a given number
    UNIQUE(job_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_redline_versions_job ON job_redline_versions(job_id);
CREATE INDEX IF NOT EXISTS idx_redline_versions_status ON job_redline_versions(review_status);

-- 3. JOB REDLINE FILES TABLE
-- Multiple files can be attached to a single version
CREATE TABLE IF NOT EXISTS job_redline_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    redline_version_id UUID NOT NULL REFERENCES job_redline_versions(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'application/pdf',
    file_size INTEGER NOT NULL DEFAULT 0,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_redline_files_version ON job_redline_files(redline_version_id);

-- 4. JOB REDLINE REVIEW AUDIT LOG
-- Append-only audit trail for all review actions
CREATE TABLE IF NOT EXISTS job_redline_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    redline_version_id UUID NOT NULL REFERENCES job_redline_versions(id),
    reviewer_user_id UUID NOT NULL REFERENCES auth.users(id),
    reviewer_name TEXT NOT NULL,
    reviewer_role TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('submit_for_review', 'approve', 'reject')),
    sr_number TEXT,                   -- Required if action = 'approve'
    notes TEXT,                       -- Required if action = 'reject'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_redline_reviews_version ON job_redline_reviews(redline_version_id);
CREATE INDEX IF NOT EXISTS idx_redline_reviews_action ON job_redline_reviews(action);

-- 5. HELPER FUNCTION: Get next version number for a job
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

-- 6. TRIGGER: Auto-update job when redline is uploaded
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
            WHEN status IN ('submitted', 'production_submitted', 'pending_redlines') THEN 'redline_uploaded'
            WHEN status = 'rejected' THEN 'redline_uploaded' -- Allow re-upload after rejection
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

-- 7. TRIGGER: Auto-update job status when production is submitted (if no redlines exist)
CREATE OR REPLACE FUNCTION update_job_redline_status_on_production()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- When production_data is set and no redlines exist, set to pending_redlines
    IF NEW.production_data IS NOT NULL
       AND (OLD.production_data IS NULL OR OLD.production_data::text = 'null')
       AND (NEW.last_redline_version_number IS NULL OR NEW.last_redline_version_number = 0) THEN
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

-- Drop existing policies if they exist
DROP POLICY IF EXISTS redline_versions_select ON job_redline_versions;
DROP POLICY IF EXISTS redline_versions_insert ON job_redline_versions;
DROP POLICY IF EXISTS redline_versions_update ON job_redline_versions;
DROP POLICY IF EXISTS redline_files_select ON job_redline_files;
DROP POLICY IF EXISTS redline_files_insert ON job_redline_files;
DROP POLICY IF EXISTS redline_reviews_select ON job_redline_reviews;
DROP POLICY IF EXISTS redline_reviews_insert ON job_redline_reviews;

-- Everyone can view redline versions (if they can see the job)
CREATE POLICY redline_versions_select ON job_redline_versions
    FOR SELECT TO authenticated
    USING (true);

-- Admin/Supervisor/Specialist can insert redline versions
CREATE POLICY redline_versions_insert ON job_redline_versions
    FOR INSERT TO authenticated
    WITH CHECK (
        LOWER(get_user_role(auth.uid())) IN ('admin', 'supervisor', 'redline_specialist')
    );

-- Admin/Supervisor/Specialist can update redline versions (for review status)
CREATE POLICY redline_versions_update ON job_redline_versions
    FOR UPDATE TO authenticated
    USING (
        LOWER(get_user_role(auth.uid())) IN ('admin', 'supervisor', 'redline_specialist', 'client_reviewer')
    );

-- Files follow same rules as versions
CREATE POLICY redline_files_select ON job_redline_files
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY redline_files_insert ON job_redline_files
    FOR INSERT TO authenticated
    WITH CHECK (
        LOWER(get_user_role(auth.uid())) IN ('admin', 'supervisor', 'redline_specialist')
    );

-- Reviews can be inserted by admin/specialist/client_reviewer
CREATE POLICY redline_reviews_select ON job_redline_reviews
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY redline_reviews_insert ON job_redline_reviews
    FOR INSERT TO authenticated
    WITH CHECK (
        LOWER(get_user_role(auth.uid())) IN ('admin', 'supervisor', 'redline_specialist', 'client_reviewer')
    );

-- 9. GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION get_next_job_redline_version(UUID) TO authenticated;

-- 10. COMMENTS
COMMENT ON TABLE job_redline_versions IS 'Document redline versions attached to jobs - each upload creates a new version';
COMMENT ON TABLE job_redline_files IS 'Files within each redline version (PDFs, images, etc.)';
COMMENT ON TABLE job_redline_reviews IS 'Append-only audit trail for redline review actions';
COMMENT ON COLUMN jobs.redline_status IS 'Current redline review status: not_uploaded, uploaded, under_review, approved, rejected';
COMMENT ON COLUMN jobs.last_redline_version_number IS 'Latest redline version number for this job';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- After running this migration:
-- 1. Job status will auto-change to "pending_redlines" when production is submitted
-- 2. Job status will auto-change to "redline_uploaded" when a redline version is created
-- 3. Use the service layer to handle review submissions and approvals
-- ============================================================================
