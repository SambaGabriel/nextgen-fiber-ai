-- Migration 011: Chat System
-- NextGen Fiber AI - CRM Completo + AI Agent Ready
--
-- Adds:
-- 1. Job messages table for real-time chat
-- 2. Message read receipts
-- 3. Realtime subscriptions support

-- =====================================================
-- 1. JOB MESSAGES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS job_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT NOT NULL,
  user_role TEXT,
  message TEXT NOT NULL,

  -- Message metadata
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'file', 'image')),
  file_url TEXT,
  file_name TEXT,

  -- For offline sync
  client_message_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE job_messages IS 'Real-time chat messages for job collaboration';
COMMENT ON COLUMN job_messages.message_type IS 'text = regular message, system = automated, file/image = attachment';
COMMENT ON COLUMN job_messages.client_message_id IS 'Client-generated ID for offline deduplication';

-- =====================================================
-- 2. MESSAGE READ RECEIPTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS message_read_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  last_read_message_id UUID REFERENCES job_messages(id),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(job_id, user_id)
);

COMMENT ON TABLE message_read_receipts IS 'Tracks which messages each user has read';

-- =====================================================
-- 3. INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_job_messages_job ON job_messages(job_id);
CREATE INDEX IF NOT EXISTS idx_job_messages_created ON job_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_messages_user ON job_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_job_messages_client_id ON job_messages(client_message_id);
CREATE INDEX IF NOT EXISTS idx_read_receipts_job ON message_read_receipts(job_id);
CREATE INDEX IF NOT EXISTS idx_read_receipts_user ON message_read_receipts(user_id);

-- =====================================================
-- 4. RLS POLICIES FOR JOB MESSAGES
-- =====================================================

ALTER TABLE job_messages ENABLE ROW LEVEL SECURITY;

-- Admin/Supervisor can see all messages
CREATE POLICY messages_admin_all ON job_messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'SUPERVISOR')
    )
  );

-- Users can see messages for jobs they're assigned to
CREATE POLICY messages_assigned_read ON job_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = job_messages.job_id
      AND (
        jobs.assigned_to_id = auth.uid()
        OR jobs.assigned_by_id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'SUPERVISOR')
    )
  );

-- Users can send messages to jobs they're assigned to
CREATE POLICY messages_assigned_insert ON job_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM jobs
        WHERE jobs.id = job_messages.job_id
        AND (
          jobs.assigned_to_id = auth.uid()
          OR jobs.assigned_by_id = auth.uid()
        )
      )
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ADMIN', 'SUPERVISOR')
      )
    )
  );

-- Users can only delete their own messages (soft delete)
CREATE POLICY messages_own_delete ON job_messages
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- 5. RLS POLICIES FOR READ RECEIPTS
-- =====================================================

ALTER TABLE message_read_receipts ENABLE ROW LEVEL SECURITY;

-- Users can manage their own read receipts
CREATE POLICY receipts_own ON message_read_receipts
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin can see all read receipts
CREATE POLICY receipts_admin_read ON message_read_receipts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'SUPERVISOR')
    )
  );

-- =====================================================
-- 6. FUNCTION: GET UNREAD COUNT
-- =====================================================

CREATE OR REPLACE FUNCTION get_unread_message_count(p_job_id UUID, p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  last_read_id UUID;
  unread_count INTEGER;
BEGIN
  -- Get last read message ID
  SELECT last_read_message_id INTO last_read_id
  FROM message_read_receipts
  WHERE job_id = p_job_id AND user_id = p_user_id;

  -- Count messages after last read
  IF last_read_id IS NULL THEN
    -- User has never read, count all messages
    SELECT COUNT(*) INTO unread_count
    FROM job_messages
    WHERE job_id = p_job_id
    AND user_id != p_user_id
    AND deleted_at IS NULL;
  ELSE
    SELECT COUNT(*) INTO unread_count
    FROM job_messages
    WHERE job_id = p_job_id
    AND user_id != p_user_id
    AND deleted_at IS NULL
    AND created_at > (
      SELECT created_at FROM job_messages WHERE id = last_read_id
    );
  END IF;

  RETURN COALESCE(unread_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_unread_message_count IS 'Get count of unread messages for a user in a job';

-- =====================================================
-- 7. FUNCTION: MARK MESSAGES AS READ
-- =====================================================

CREATE OR REPLACE FUNCTION mark_messages_read(p_job_id UUID, p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  latest_message_id UUID;
BEGIN
  -- Get the latest message ID
  SELECT id INTO latest_message_id
  FROM job_messages
  WHERE job_id = p_job_id
  AND deleted_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF latest_message_id IS NOT NULL THEN
    -- Upsert read receipt
    INSERT INTO message_read_receipts (job_id, user_id, last_read_message_id, last_read_at)
    VALUES (p_job_id, p_user_id, latest_message_id, NOW())
    ON CONFLICT (job_id, user_id)
    DO UPDATE SET
      last_read_message_id = latest_message_id,
      last_read_at = NOW();
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION mark_messages_read IS 'Mark all messages in a job as read for a user';

-- =====================================================
-- 8. ENABLE REALTIME FOR MESSAGES
-- =====================================================

-- Enable realtime for job_messages table
ALTER PUBLICATION supabase_realtime ADD TABLE job_messages;

-- =====================================================
-- 9. SYSTEM MESSAGE HELPER
-- =====================================================

CREATE OR REPLACE FUNCTION create_system_message(
  p_job_id UUID,
  p_message TEXT,
  p_user_id UUID DEFAULT NULL,
  p_user_name TEXT DEFAULT 'System'
)
RETURNS UUID AS $$
DECLARE
  new_message_id UUID;
BEGIN
  INSERT INTO job_messages (job_id, user_id, user_name, user_role, message, message_type)
  VALUES (p_job_id, p_user_id, p_user_name, 'SYSTEM', p_message, 'system')
  RETURNING id INTO new_message_id;

  RETURN new_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_system_message IS 'Create a system-generated message in a job chat';

-- =====================================================
-- 10. TRIGGER: AUTO-CREATE SYSTEM MESSAGE ON JOB STATUS CHANGE
-- =====================================================

CREATE OR REPLACE FUNCTION job_status_message_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger on status change
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM create_system_message(
      NEW.id,
      'Job status changed from ' || COALESCE(OLD.status, 'new') || ' to ' || NEW.status
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS job_status_message ON jobs;
CREATE TRIGGER job_status_message
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION job_status_message_trigger();
