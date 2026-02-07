-- ============================================
-- Migration 005: Redline Workflow
-- Rate Card versioning, approval, and audit
-- ============================================

-- Rate Card Redlines (Proposed Changes)
CREATE TABLE IF NOT EXISTS rate_card_redlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_profile_id UUID REFERENCES rate_card_profiles(id) ON DELETE SET NULL,
  source_group_id UUID REFERENCES rate_card_groups(id) ON DELETE SET NULL,

  -- Version tracking
  version_number INTEGER NOT NULL DEFAULT 1,
  version_label TEXT,  -- 'v2.1', 'Q1 2024 Update'

  -- Changes
  proposed_changes JSONB NOT NULL DEFAULT '[]',  -- Array of {code, field, oldValue, newValue}
  change_summary TEXT,

  -- Workflow status
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft',           -- Being edited
    'pending_review',  -- Submitted for review
    'approved',        -- Approved, ready to apply
    'rejected',        -- Rejected by reviewer
    'applied'          -- Changes applied to rate card
  )),

  -- Creator
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Submission
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Review
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by_name TEXT,
  review_notes TEXT,

  -- Application
  applied_at TIMESTAMPTZ,
  applied_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- SR Number (Customer Reference)
  sr_number TEXT,  -- e.g., 'SR-2024-0042'
  sr_reference TEXT,  -- External system link

  -- Audit
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'
);

-- Indexes for redlines
CREATE INDEX IF NOT EXISTS idx_redlines_profile ON rate_card_redlines(source_profile_id);
CREATE INDEX IF NOT EXISTS idx_redlines_group ON rate_card_redlines(source_group_id);
CREATE INDEX IF NOT EXISTS idx_redlines_status ON rate_card_redlines(status);
CREATE INDEX IF NOT EXISTS idx_redlines_created_by ON rate_card_redlines(created_by);
CREATE INDEX IF NOT EXISTS idx_redlines_sr_number ON rate_card_redlines(sr_number);

-- Redline Review History (append-only audit trail)
CREATE TABLE IF NOT EXISTS redline_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  redline_id UUID REFERENCES rate_card_redlines(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_name TEXT,
  reviewer_role TEXT,  -- 'ADMIN', 'REDLINE_SPECIALIST', 'CLIENT_REVIEWER'

  action TEXT CHECK (action IN ('approve', 'reject', 'request_changes', 'comment')),
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for review history
CREATE INDEX IF NOT EXISTS idx_reviews_redline ON redline_reviews(redline_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON redline_reviews(reviewer_id);

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE rate_card_redlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE redline_reviews ENABLE ROW LEVEL SECURITY;

-- Redlines: viewable by authenticated users
CREATE POLICY "Redlines viewable by authenticated"
ON rate_card_redlines FOR SELECT
TO authenticated
USING (true);

-- Redlines: insertable by ADMIN, SUPERVISOR, REDLINE_SPECIALIST
CREATE POLICY "Redlines insertable by authorized roles"
ON rate_card_redlines FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'supervisor', 'ADMIN', 'SUPERVISOR', 'redline_specialist', 'REDLINE_SPECIALIST')
  )
);

-- Redlines: updatable by creator or admin
CREATE POLICY "Redlines updatable by creator or admin"
ON rate_card_redlines FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'ADMIN')
  )
);

-- Reviews: viewable by authenticated
CREATE POLICY "Reviews viewable by authenticated"
ON redline_reviews FOR SELECT
TO authenticated
USING (true);

-- Reviews: insertable by authorized reviewers
CREATE POLICY "Reviews insertable by reviewers"
ON redline_reviews FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'supervisor', 'ADMIN', 'SUPERVISOR', 'redline_specialist', 'REDLINE_SPECIALIST', 'client_reviewer', 'CLIENT_REVIEWER')
  )
);

-- ============================================
-- SR Number support on jobs table
-- ============================================

-- Add SR Number columns to jobs if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'sr_number'
  ) THEN
    ALTER TABLE jobs ADD COLUMN sr_number TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'sr_reference'
  ) THEN
    ALTER TABLE jobs ADD COLUMN sr_reference TEXT;
  END IF;
END $$;

-- Index for SR number lookup
CREATE INDEX IF NOT EXISTS idx_jobs_sr_number ON jobs(sr_number);

-- ============================================
-- Helper Functions
-- ============================================

-- Function to get next version number for a profile
CREATE OR REPLACE FUNCTION get_next_redline_version(profile_id UUID)
RETURNS INTEGER AS $$
DECLARE
  max_version INTEGER;
BEGIN
  SELECT COALESCE(MAX(version_number), 0) INTO max_version
  FROM rate_card_redlines
  WHERE source_profile_id = profile_id;
  RETURN max_version + 1;
END;
$$ LANGUAGE plpgsql;

-- Function to apply redline changes
CREATE OR REPLACE FUNCTION apply_redline_changes(redline_id UUID, applied_by_user UUID)
RETURNS BOOLEAN AS $$
DECLARE
  redline_record rate_card_redlines%ROWTYPE;
  change_item JSONB;
  rate_code TEXT;
  old_value NUMERIC;
  new_value NUMERIC;
  field_name TEXT;
BEGIN
  -- Get the redline
  SELECT * INTO redline_record FROM rate_card_redlines WHERE id = redline_id;

  IF redline_record IS NULL THEN
    RAISE EXCEPTION 'Redline not found';
  END IF;

  IF redline_record.status != 'approved' THEN
    RAISE EXCEPTION 'Redline must be approved before applying';
  END IF;

  -- Apply each change
  FOR change_item IN SELECT * FROM jsonb_array_elements(redline_record.proposed_changes)
  LOOP
    rate_code := change_item->>'code';
    field_name := change_item->>'field';
    new_value := (change_item->>'newValue')::NUMERIC;

    -- Update the rate card item
    IF field_name = 'nextgen_rate' THEN
      UPDATE rate_card_items
      SET nextgen_rate = new_value, updated_at = NOW()
      WHERE profile_id = redline_record.source_profile_id AND code = rate_code;
    ELSIF field_name = 'lineman_rate' THEN
      UPDATE rate_card_items
      SET lineman_rate = new_value, updated_at = NOW()
      WHERE profile_id = redline_record.source_profile_id AND code = rate_code;
    ELSIF field_name = 'truck_investor_rate' THEN
      UPDATE rate_card_items
      SET truck_investor_rate = new_value, updated_at = NOW()
      WHERE profile_id = redline_record.source_profile_id AND code = rate_code;
    END IF;
  END LOOP;

  -- Mark redline as applied
  UPDATE rate_card_redlines
  SET status = 'applied',
      applied_at = NOW(),
      applied_by = applied_by_user
  WHERE id = redline_id;

  -- Log to audit
  INSERT INTO rate_card_audit_log (id, action, entity_type, entity_id, user_id, metadata, created_at)
  VALUES (
    gen_random_uuid(),
    'REDLINE_APPLIED',
    'REDLINE',
    redline_id,
    applied_by_user,
    jsonb_build_object(
      'version_number', redline_record.version_number,
      'change_count', jsonb_array_length(redline_record.proposed_changes)
    ),
    NOW()
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- IMPORTANT: This migration is APPEND-ONLY
-- redline_reviews should NEVER be updated/deleted
-- ============================================

COMMENT ON TABLE redline_reviews IS 'Append-only audit trail for redline reviews. Never update or delete records.';
