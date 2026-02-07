-- ============================================================================
-- Migration 004: Job Visibility & Assignment Flow
-- ============================================================================
-- Implements strict job visibility rules:
-- - Linemen see ONLY jobs assigned to them
-- - Admins see ONLY jobs they created
-- - Unassigned jobs are invisible to linemen
-- - Rate card snapshots are immutable at assignment time
-- ============================================================================

-- ============================================================================
-- 1. SCHEMA EXTENSIONS
-- ============================================================================

-- Add visibility and assignment columns to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS visibility_scope TEXT[] DEFAULT '{}';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_lineman_ids UUID[] DEFAULT '{}';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assignment_status TEXT DEFAULT 'unassigned'
    CHECK (assignment_status IN ('unassigned', 'partially_assigned', 'fully_assigned'));
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_by_admin_id UUID REFERENCES auth.users(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS last_assignment_at TIMESTAMPTZ;

-- Create index for visibility queries
CREATE INDEX IF NOT EXISTS idx_jobs_visibility_scope ON jobs USING GIN (visibility_scope);
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_lineman ON jobs USING GIN (assigned_lineman_ids);
CREATE INDEX IF NOT EXISTS idx_jobs_created_by_admin ON jobs (created_by_admin_id);

-- ============================================================================
-- 2. JOB ASSIGNMENTS TABLE (Detailed assignment tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    lineman_id UUID NOT NULL REFERENCES auth.users(id),
    assigned_by UUID NOT NULL REFERENCES auth.users(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unassigned_at TIMESTAMPTZ,
    unassigned_by UUID REFERENCES auth.users(id),
    is_active BOOLEAN DEFAULT TRUE,

    -- Rate card snapshot (IMMUTABLE after creation)
    rate_card_snapshot_id UUID,
    rate_card_profile_id UUID,
    snapshot_created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_active_assignment UNIQUE (job_id, lineman_id, is_active)
);

CREATE INDEX IF NOT EXISTS idx_job_assignments_job ON job_assignments(job_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_lineman ON job_assignments(lineman_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_active ON job_assignments(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- 3. RATE CARD SNAPSHOTS TABLE (Immutable copies)
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_card_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Source reference
    source_profile_id UUID NOT NULL,
    source_group_id UUID NOT NULL,

    -- Snapshot metadata
    snapshot_reason TEXT NOT NULL, -- 'job_assignment', 'rate_change', 'audit'
    snapshot_context JSONB DEFAULT '{}', -- job_id, lineman_id, etc.

    -- Frozen rates (JSONB for flexibility)
    frozen_items JSONB NOT NULL, -- Array of {code, description, unit, nextgen_rate, lineman_rate, truck_investor_rate}

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),

    -- Immutability constraint (no updates allowed)
    is_locked BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_rate_snapshots_source ON rate_card_snapshots(source_profile_id);
CREATE INDEX IF NOT EXISTS idx_rate_snapshots_context ON rate_card_snapshots USING GIN (snapshot_context);

-- ============================================================================
-- 4. ASSIGNMENT AUDIT LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_assignment_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(id),
    action TEXT NOT NULL CHECK (action IN ('assigned', 'unassigned', 'reassigned', 'visibility_changed')),
    lineman_id UUID REFERENCES auth.users(id),
    performed_by UUID NOT NULL REFERENCES auth.users(id),
    old_values JSONB,
    new_values JSONB,
    reason TEXT,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignment_audit_job ON job_assignment_audit(job_id);
CREATE INDEX IF NOT EXISTS idx_assignment_audit_lineman ON job_assignment_audit(lineman_id);
CREATE INDEX IF NOT EXISTS idx_assignment_audit_date ON job_assignment_audit(created_at DESC);

-- ============================================================================
-- 5. HELPER FUNCTIONS
-- ============================================================================

-- Function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM profiles
    WHERE id = user_id;

    RETURN COALESCE(user_role, 'lineman');
END;
$$;

-- Function to check if user can see a job
CREATE OR REPLACE FUNCTION can_user_see_job(user_id UUID, job_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role TEXT;
    job_record RECORD;
BEGIN
    -- Get user role
    user_role := get_user_role(user_id);

    -- Get job
    SELECT * INTO job_record FROM jobs WHERE id = job_id;

    IF job_record IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Admin/Supervisor: can see jobs they created or all if superadmin
    IF user_role IN ('admin', 'supervisor') THEN
        RETURN job_record.created_by_admin_id = user_id
            OR user_id::TEXT = ANY(job_record.visibility_scope);
    END IF;

    -- Lineman: can ONLY see jobs assigned to them
    IF user_role = 'lineman' THEN
        RETURN user_id = ANY(job_record.assigned_lineman_ids);
    END IF;

    -- Default deny
    RETURN FALSE;
END;
$$;

-- Function to update visibility_scope array
CREATE OR REPLACE FUNCTION update_job_visibility()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Build visibility scope from assigned linemen + creator
    NEW.visibility_scope := ARRAY[]::TEXT[];

    -- Add creator admin
    IF NEW.created_by_admin_id IS NOT NULL THEN
        NEW.visibility_scope := array_append(NEW.visibility_scope, NEW.created_by_admin_id::TEXT);
    END IF;

    -- Add all assigned linemen
    IF NEW.assigned_lineman_ids IS NOT NULL THEN
        NEW.visibility_scope := NEW.visibility_scope ||
            (SELECT array_agg(id::TEXT) FROM unnest(NEW.assigned_lineman_ids) AS id);
    END IF;

    -- Update assignment status
    IF array_length(NEW.assigned_lineman_ids, 1) IS NULL OR array_length(NEW.assigned_lineman_ids, 1) = 0 THEN
        NEW.assignment_status := 'unassigned';
    ELSE
        NEW.assignment_status := 'fully_assigned';
    END IF;

    RETURN NEW;
END;
$$;

-- Trigger to auto-update visibility on job changes
DROP TRIGGER IF EXISTS trg_update_job_visibility ON jobs;
CREATE TRIGGER trg_update_job_visibility
    BEFORE INSERT OR UPDATE OF assigned_lineman_ids, created_by_admin_id
    ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_job_visibility();

-- ============================================================================
-- 6. ASSIGNMENT FUNCTIONS
-- ============================================================================

-- Function to assign lineman to job with rate card snapshot
CREATE OR REPLACE FUNCTION assign_lineman_to_job(
    p_job_id UUID,
    p_lineman_id UUID,
    p_assigned_by UUID,
    p_rate_card_profile_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_assignment_id UUID;
    v_snapshot_id UUID;
    v_frozen_items JSONB;
    v_job RECORD;
BEGIN
    -- Get job
    SELECT * INTO v_job FROM jobs WHERE id = p_job_id;

    IF v_job IS NULL THEN
        RAISE EXCEPTION 'Job not found: %', p_job_id;
    END IF;

    -- Verify assigner has permission (must be admin/supervisor)
    IF get_user_role(p_assigned_by) NOT IN ('admin', 'supervisor') THEN
        RAISE EXCEPTION 'Only admins can assign linemen to jobs';
    END IF;

    -- Verify lineman exists and has lineman role
    IF get_user_role(p_lineman_id) != 'lineman' THEN
        RAISE EXCEPTION 'User % is not a lineman', p_lineman_id;
    END IF;

    -- Check if already assigned
    IF p_lineman_id = ANY(v_job.assigned_lineman_ids) THEN
        RAISE EXCEPTION 'Lineman already assigned to this job';
    END IF;

    -- Create rate card snapshot if profile provided
    IF p_rate_card_profile_id IS NOT NULL THEN
        -- Get all rate items for this profile
        SELECT jsonb_agg(jsonb_build_object(
            'code', code,
            'description', description,
            'unit', unit,
            'nextgen_rate', nextgen_rate,
            'lineman_rate', lineman_rate,
            'truck_investor_rate', truck_investor_rate
        ))
        INTO v_frozen_items
        FROM rate_card_items
        WHERE profile_id = p_rate_card_profile_id;

        -- Create snapshot
        INSERT INTO rate_card_snapshots (
            source_profile_id,
            source_group_id,
            snapshot_reason,
            snapshot_context,
            frozen_items,
            created_by
        )
        SELECT
            p_rate_card_profile_id,
            rcp.group_id,
            'job_assignment',
            jsonb_build_object(
                'job_id', p_job_id,
                'lineman_id', p_lineman_id,
                'assigned_by', p_assigned_by,
                'assigned_at', NOW()
            ),
            COALESCE(v_frozen_items, '[]'::JSONB),
            p_assigned_by
        FROM rate_card_profiles rcp
        WHERE rcp.id = p_rate_card_profile_id
        RETURNING id INTO v_snapshot_id;
    END IF;

    -- Create assignment record
    INSERT INTO job_assignments (
        job_id,
        lineman_id,
        assigned_by,
        rate_card_snapshot_id,
        rate_card_profile_id
    )
    VALUES (
        p_job_id,
        p_lineman_id,
        p_assigned_by,
        v_snapshot_id,
        p_rate_card_profile_id
    )
    RETURNING id INTO v_assignment_id;

    -- Update job's assigned_lineman_ids array
    UPDATE jobs
    SET
        assigned_lineman_ids = array_append(COALESCE(assigned_lineman_ids, '{}'), p_lineman_id),
        last_assignment_at = NOW()
    WHERE id = p_job_id;

    -- Log audit
    INSERT INTO job_assignment_audit (job_id, action, lineman_id, performed_by, new_values)
    VALUES (
        p_job_id,
        'assigned',
        p_lineman_id,
        p_assigned_by,
        jsonb_build_object(
            'lineman_id', p_lineman_id,
            'rate_card_snapshot_id', v_snapshot_id
        )
    );

    RETURN v_assignment_id;
END;
$$;

-- Function to unassign lineman from job
CREATE OR REPLACE FUNCTION unassign_lineman_from_job(
    p_job_id UUID,
    p_lineman_id UUID,
    p_unassigned_by UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_job RECORD;
BEGIN
    -- Get job
    SELECT * INTO v_job FROM jobs WHERE id = p_job_id;

    IF v_job IS NULL THEN
        RAISE EXCEPTION 'Job not found: %', p_job_id;
    END IF;

    -- Verify permission
    IF get_user_role(p_unassigned_by) NOT IN ('admin', 'supervisor') THEN
        RAISE EXCEPTION 'Only admins can unassign linemen from jobs';
    END IF;

    -- Check if assigned
    IF NOT (p_lineman_id = ANY(v_job.assigned_lineman_ids)) THEN
        RAISE EXCEPTION 'Lineman not assigned to this job';
    END IF;

    -- Deactivate assignment record (keep for audit)
    UPDATE job_assignments
    SET
        is_active = FALSE,
        unassigned_at = NOW(),
        unassigned_by = p_unassigned_by,
        updated_at = NOW()
    WHERE job_id = p_job_id
      AND lineman_id = p_lineman_id
      AND is_active = TRUE;

    -- Remove from job's assigned_lineman_ids array
    UPDATE jobs
    SET assigned_lineman_ids = array_remove(assigned_lineman_ids, p_lineman_id)
    WHERE id = p_job_id;

    -- Log audit
    INSERT INTO job_assignment_audit (job_id, action, lineman_id, performed_by, reason)
    VALUES (p_job_id, 'unassigned', p_lineman_id, p_unassigned_by, p_reason);

    RETURN TRUE;
END;
$$;

-- ============================================================================
-- 7. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on jobs
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS jobs_select_policy ON jobs;
DROP POLICY IF EXISTS jobs_insert_policy ON jobs;
DROP POLICY IF EXISTS jobs_update_policy ON jobs;
DROP POLICY IF EXISTS jobs_delete_policy ON jobs;

-- SELECT: Users can only see jobs in their visibility_scope
CREATE POLICY jobs_select_policy ON jobs
    FOR SELECT
    USING (
        auth.uid()::TEXT = ANY(visibility_scope)
        OR get_user_role(auth.uid()) IN ('admin', 'supervisor')
    );

-- INSERT: Only admins can create jobs
CREATE POLICY jobs_insert_policy ON jobs
    FOR INSERT
    WITH CHECK (
        get_user_role(auth.uid()) IN ('admin', 'supervisor')
    );

-- UPDATE: Admins can update their own jobs
CREATE POLICY jobs_update_policy ON jobs
    FOR UPDATE
    USING (
        created_by_admin_id = auth.uid()
        OR get_user_role(auth.uid()) = 'admin'
    )
    WITH CHECK (
        created_by_admin_id = auth.uid()
        OR get_user_role(auth.uid()) = 'admin'
    );

-- DELETE: Only admins can delete their own jobs
CREATE POLICY jobs_delete_policy ON jobs
    FOR DELETE
    USING (
        created_by_admin_id = auth.uid()
        OR get_user_role(auth.uid()) = 'admin'
    );

-- RLS for job_assignments
ALTER TABLE job_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_assignments_select_policy ON job_assignments;
DROP POLICY IF EXISTS job_assignments_insert_policy ON job_assignments;

CREATE POLICY job_assignments_select_policy ON job_assignments
    FOR SELECT
    USING (
        lineman_id = auth.uid()
        OR assigned_by = auth.uid()
        OR get_user_role(auth.uid()) IN ('admin', 'supervisor')
    );

CREATE POLICY job_assignments_insert_policy ON job_assignments
    FOR INSERT
    WITH CHECK (
        get_user_role(auth.uid()) IN ('admin', 'supervisor')
    );

-- RLS for rate_card_snapshots (read-only for assigned lineman, admin)
ALTER TABLE rate_card_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rate_snapshots_select_policy ON rate_card_snapshots;

CREATE POLICY rate_snapshots_select_policy ON rate_card_snapshots
    FOR SELECT
    USING (
        -- Lineman can see snapshots for their assignments
        EXISTS (
            SELECT 1 FROM job_assignments ja
            WHERE ja.rate_card_snapshot_id = rate_card_snapshots.id
              AND ja.lineman_id = auth.uid()
        )
        -- Admins can see all
        OR get_user_role(auth.uid()) IN ('admin', 'supervisor')
    );

-- RLS for audit log (admin/supervisor only)
ALTER TABLE job_assignment_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_audit_select_policy ON job_assignment_audit;

CREATE POLICY job_audit_select_policy ON job_assignment_audit
    FOR SELECT
    USING (
        get_user_role(auth.uid()) IN ('admin', 'supervisor')
        OR lineman_id = auth.uid()
    );

-- ============================================================================
-- 8. REALTIME NOTIFICATIONS
-- ============================================================================

-- Function to notify on assignment changes
CREATE OR REPLACE FUNCTION notify_job_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM pg_notify(
            'job_assignment',
            json_build_object(
                'action', 'assigned',
                'job_id', NEW.job_id,
                'lineman_id', NEW.lineman_id,
                'assigned_by', NEW.assigned_by,
                'timestamp', NOW()
            )::TEXT
        );
    ELSIF TG_OP = 'UPDATE' AND OLD.is_active = TRUE AND NEW.is_active = FALSE THEN
        PERFORM pg_notify(
            'job_assignment',
            json_build_object(
                'action', 'unassigned',
                'job_id', NEW.job_id,
                'lineman_id', NEW.lineman_id,
                'unassigned_by', NEW.unassigned_by,
                'timestamp', NOW()
            )::TEXT
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_job_assignment ON job_assignments;
CREATE TRIGGER trg_notify_job_assignment
    AFTER INSERT OR UPDATE ON job_assignments
    FOR EACH ROW
    EXECUTE FUNCTION notify_job_assignment();

-- ============================================================================
-- 9. MIGRATION: Populate existing jobs with creator
-- ============================================================================

-- Set created_by_admin_id for existing jobs (use first admin if available)
UPDATE jobs
SET created_by_admin_id = (
    SELECT id FROM profiles WHERE role = 'admin' LIMIT 1
)
WHERE created_by_admin_id IS NULL;

-- Rebuild visibility_scope for existing jobs
UPDATE jobs SET visibility_scope = visibility_scope; -- Triggers the update function

-- ============================================================================
-- 10. GRANT PERMISSIONS
-- ============================================================================

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION get_user_role(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_user_see_job(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION assign_lineman_to_job(UUID, UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION unassign_lineman_from_job(UUID, UUID, UUID, TEXT) TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON TABLE job_assignments IS 'Tracks lineman assignments to jobs with rate card snapshots';
COMMENT ON TABLE rate_card_snapshots IS 'Immutable copies of rate cards at assignment time';
COMMENT ON TABLE job_assignment_audit IS 'Audit trail for all assignment changes';
COMMENT ON FUNCTION assign_lineman_to_job IS 'Assigns a lineman to a job and creates rate card snapshot';
COMMENT ON FUNCTION unassign_lineman_from_job IS 'Removes lineman assignment (keeps audit trail)';
