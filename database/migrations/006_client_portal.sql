-- ============================================
-- Migration 006: Client Viewer Portal
-- Scoped access for Prime Contractors
-- ============================================

-- Client Viewer Scope (Permission Table)
CREATE TABLE IF NOT EXISTS client_viewer_scope (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,

  -- Granular permissions
  can_view_jobs BOOLEAN DEFAULT TRUE,
  can_view_production BOOLEAN DEFAULT TRUE,
  can_view_rate_cards BOOLEAN DEFAULT FALSE,
  can_review_redlines BOOLEAN DEFAULT FALSE,
  can_export_reports BOOLEAN DEFAULT FALSE,

  -- Metadata
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,  -- NULL means no expiration
  is_active BOOLEAN DEFAULT TRUE,

  -- Unique constraint: one scope per user-client pair
  CONSTRAINT unique_user_client_scope UNIQUE (user_id, client_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_client_scope_user ON client_viewer_scope(user_id);
CREATE INDEX IF NOT EXISTS idx_client_scope_client ON client_viewer_scope(client_id);
CREATE INDEX IF NOT EXISTS idx_client_scope_active ON client_viewer_scope(is_active);

-- ============================================
-- RLS Policies for Client Portal
-- ============================================

ALTER TABLE client_viewer_scope ENABLE ROW LEVEL SECURITY;

-- Client scope: viewable by the user themselves or admin
CREATE POLICY "Client scope viewable by user or admin"
ON client_viewer_scope FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'ADMIN', 'supervisor', 'SUPERVISOR')
  )
);

-- Client scope: manageable by admin only
CREATE POLICY "Client scope manageable by admin"
ON client_viewer_scope FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'ADMIN')
  )
);

-- ============================================
-- Extended RLS on jobs for client viewers
-- ============================================

-- Additional policy: Client viewers can see their scoped jobs
CREATE POLICY "Client viewers see scoped jobs"
ON jobs FOR SELECT
TO authenticated
USING (
  -- Allow if user has active scope for this client
  EXISTS (
    SELECT 1 FROM client_viewer_scope cvs
    WHERE cvs.user_id = auth.uid()
    AND cvs.client_id = jobs.client_id::UUID
    AND cvs.is_active = TRUE
    AND cvs.can_view_jobs = TRUE
    AND (cvs.expires_at IS NULL OR cvs.expires_at > NOW())
  )
);

-- ============================================
-- Extended RLS on production_submissions for client viewers
-- ============================================

-- Client viewers can see production for their scoped jobs
CREATE POLICY "Client viewers see scoped production"
ON production_submissions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM jobs j
    INNER JOIN client_viewer_scope cvs ON cvs.client_id = j.client_id::UUID
    WHERE j.id = production_submissions.job_id
    AND cvs.user_id = auth.uid()
    AND cvs.is_active = TRUE
    AND cvs.can_view_production = TRUE
    AND (cvs.expires_at IS NULL OR cvs.expires_at > NOW())
  )
);

-- ============================================
-- Extended RLS on rate_card_redlines for client viewers
-- ============================================

-- Client viewers can see redlines for their scoped clients
CREATE POLICY "Client viewers see scoped redlines"
ON rate_card_redlines FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM rate_card_groups rcg
    INNER JOIN client_viewer_scope cvs ON cvs.client_id = rcg.client_id
    WHERE rcg.id = rate_card_redlines.source_group_id
    AND cvs.user_id = auth.uid()
    AND cvs.is_active = TRUE
    AND cvs.can_review_redlines = TRUE
    AND (cvs.expires_at IS NULL OR cvs.expires_at > NOW())
  )
);

-- ============================================
-- Helper Functions
-- ============================================

-- Function to check if user can access a specific client's data
CREATE OR REPLACE FUNCTION can_user_access_client(user_id UUID, target_client_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  has_scope BOOLEAN;
BEGIN
  -- Get user role
  SELECT role INTO user_role FROM profiles WHERE id = user_id;

  -- Admins and supervisors can access all clients
  IF user_role IN ('admin', 'ADMIN', 'supervisor', 'SUPERVISOR') THEN
    RETURN TRUE;
  END IF;

  -- Check client viewer scope
  SELECT EXISTS (
    SELECT 1 FROM client_viewer_scope
    WHERE client_viewer_scope.user_id = can_user_access_client.user_id
    AND client_id = target_client_id
    AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW())
  ) INTO has_scope;

  RETURN has_scope;
END;
$$ LANGUAGE plpgsql;

-- Function to get clients accessible by a user
CREATE OR REPLACE FUNCTION get_accessible_clients(user_id UUID)
RETURNS TABLE (client_id UUID, client_name TEXT, permissions JSONB) AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- Get user role
  SELECT role INTO user_role FROM profiles WHERE id = user_id;

  -- Admins see all clients
  IF user_role IN ('admin', 'ADMIN', 'supervisor', 'SUPERVISOR') THEN
    RETURN QUERY
    SELECT
      c.id,
      c.name,
      jsonb_build_object(
        'can_view_jobs', TRUE,
        'can_view_production', TRUE,
        'can_view_rate_cards', TRUE,
        'can_review_redlines', TRUE,
        'can_export_reports', TRUE
      )
    FROM clients c
    WHERE c.is_active = TRUE;
  ELSE
    -- Client viewers see only their scoped clients
    RETURN QUERY
    SELECT
      c.id,
      c.name,
      jsonb_build_object(
        'can_view_jobs', cvs.can_view_jobs,
        'can_view_production', cvs.can_view_production,
        'can_view_rate_cards', cvs.can_view_rate_cards,
        'can_review_redlines', cvs.can_review_redlines,
        'can_export_reports', cvs.can_export_reports
      )
    FROM clients c
    INNER JOIN client_viewer_scope cvs ON cvs.client_id = c.id
    WHERE cvs.user_id = get_accessible_clients.user_id
    AND cvs.is_active = TRUE
    AND c.is_active = TRUE
    AND (cvs.expires_at IS NULL OR cvs.expires_at > NOW());
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Client Portal Activity Log
-- ============================================

CREATE TABLE IF NOT EXISTS client_portal_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  action TEXT NOT NULL,  -- 'view_job', 'view_production', 'export_report', 'review_redline'
  entity_type TEXT,      -- 'job', 'production', 'redline'
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for activity queries
CREATE INDEX IF NOT EXISTS idx_portal_activity_user ON client_portal_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_portal_activity_client ON client_portal_activity(client_id);
CREATE INDEX IF NOT EXISTS idx_portal_activity_date ON client_portal_activity(created_at);

-- RLS for activity log
ALTER TABLE client_portal_activity ENABLE ROW LEVEL SECURITY;

-- Activity viewable by admins or the user themselves
CREATE POLICY "Activity viewable by admin or self"
ON client_portal_activity FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'ADMIN')
  )
);

-- Activity insertable by authenticated
CREATE POLICY "Activity insertable by authenticated"
ON client_portal_activity FOR INSERT
TO authenticated
WITH CHECK (true);

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE client_viewer_scope IS 'Defines which clients a CLIENT_REVIEWER user can access and with what permissions';
COMMENT ON TABLE client_portal_activity IS 'Audit log for client portal access - append only';
