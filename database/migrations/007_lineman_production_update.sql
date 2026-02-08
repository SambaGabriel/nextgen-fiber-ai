-- ============================================================================
-- Migration 007: Allow Lineman to Update Production Data
-- ============================================================================
-- Problem: Current RLS policy only allows ADMIN to UPDATE jobs
-- Solution: Add policy allowing lineman to UPDATE production_data on assigned jobs
-- ============================================================================

-- Drop the existing restrictive update policy
DROP POLICY IF EXISTS jobs_update_policy ON jobs;

-- Recreate update policy with lineman support for production data
-- Note: In PostgreSQL RLS, we can't restrict by column, so we use USING/WITH CHECK
-- The lineman can update ANY column that passes the policy, but we rely on the
-- application layer (jobStorageSupabase) to only send production_data updates

CREATE POLICY jobs_update_policy ON jobs
    FOR UPDATE
    USING (
        -- Admin can update any job they created or as superadmin
        created_by_admin_id = auth.uid()
        OR get_user_role(auth.uid()) = 'admin'
        -- Lineman can update jobs assigned to them (for production data submission)
        OR (
            get_user_role(auth.uid()) = 'lineman'
            AND assigned_to_id = auth.uid()
        )
    )
    WITH CHECK (
        -- Same conditions for the new values
        created_by_admin_id = auth.uid()
        OR get_user_role(auth.uid()) = 'admin'
        -- Lineman can only update their assigned jobs
        OR (
            get_user_role(auth.uid()) = 'lineman'
            AND assigned_to_id = auth.uid()
        )
    );

-- Also check if user role is stored in lowercase (common issue)
-- Update the get_user_role function to handle case insensitivity
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT LOWER(role) INTO user_role
    FROM profiles
    WHERE id = user_id;

    RETURN COALESCE(user_role, 'lineman');
END;
$$;

-- Grant execute on function
GRANT EXECUTE ON FUNCTION get_user_role(UUID) TO authenticated;

-- ============================================================================
-- VERIFICATION QUERIES (run these to check if policy works)
-- ============================================================================
--
-- Check current user's role:
-- SELECT auth.uid(), get_user_role(auth.uid());
--
-- Check if lineman can see their assigned jobs:
-- SELECT id, job_code, assigned_to_id FROM jobs WHERE assigned_to_id = auth.uid();
--
-- Test update (should work for lineman on their assigned job):
-- UPDATE jobs SET production_data = '{"test": true}'::jsonb WHERE assigned_to_id = auth.uid() LIMIT 1;
--
-- ============================================================================

COMMENT ON POLICY jobs_update_policy ON jobs IS
'Allows admins to update any job, linemen to update production data on their assigned jobs';
