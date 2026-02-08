-- Migration 012: Notifications & Job Updates
-- NextGen Fiber AI - Real-time Notifications System

-- =====================================================
-- 1. NOTIFICATIONS TABLE
-- =====================================================

DROP TABLE IF EXISTS notifications CASCADE;

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('JOB_ASSIGNED', 'STATUS_CHANGED', 'MESSAGE_RECEIVED', 'PAYROLL_READY', 'REDLINE_APPROVED', 'SYSTEM')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE notifications IS 'User notifications for real-time updates';
COMMENT ON COLUMN notifications.type IS 'Notification type for filtering and display';
COMMENT ON COLUMN notifications.data IS 'Additional JSON data (jobId, amount, etc.)';

-- =====================================================
-- 2. JOB UPDATES TABLE (for activity feed)
-- =====================================================

DROP TABLE IF EXISTS job_updates CASCADE;

CREATE TABLE job_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('message', 'status_change', 'assignment', 'production', 'redline', 'system')),
  content TEXT NOT NULL,
  sender_id UUID REFERENCES auth.users(id),
  sender_name TEXT,
  previous_status TEXT,
  new_status TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE job_updates IS 'Activity feed for job changes and messages';

-- =====================================================
-- 3. INDEXES
-- =====================================================

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, read);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX idx_job_updates_job ON job_updates(job_id);
CREATE INDEX idx_job_updates_type ON job_updates(type);
CREATE INDEX idx_job_updates_created ON job_updates(created_at DESC);

-- =====================================================
-- 4. RLS POLICIES FOR NOTIFICATIONS
-- =====================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_own ON notifications;
CREATE POLICY notifications_own ON notifications
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_admin_read ON notifications;
CREATE POLICY notifications_admin_read ON notifications
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
-- 5. RLS POLICIES FOR JOB UPDATES
-- =====================================================

ALTER TABLE job_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS job_updates_read ON job_updates;
CREATE POLICY job_updates_read ON job_updates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = job_updates.job_id
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

DROP POLICY IF EXISTS job_updates_insert ON job_updates;
CREATE POLICY job_updates_insert ON job_updates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = job_updates.job_id
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

-- =====================================================
-- 6. ENABLE REALTIME
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND tablename = 'job_updates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE job_updates;
  END IF;
END $$;

-- =====================================================
-- 7. TRIGGER: AUTO-CREATE NOTIFICATION ON JOB ASSIGNMENT
-- =====================================================

CREATE OR REPLACE FUNCTION notify_job_assigned()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_to_id IS NOT NULL AND (OLD.assigned_to_id IS NULL OR OLD.assigned_to_id != NEW.assigned_to_id) THEN
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      NEW.assigned_to_id,
      'JOB_ASSIGNED',
      'New Job Assigned',
      'You have been assigned to job ' || COALESCE(NEW.job_code, NEW.title),
      jsonb_build_object('jobId', NEW.id, 'jobCode', NEW.job_code)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS job_assigned_notification ON jobs;
CREATE TRIGGER job_assigned_notification
  AFTER INSERT OR UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION notify_job_assigned();

-- =====================================================
-- 8. TRIGGER: AUTO-CREATE NOTIFICATION ON STATUS CHANGE
-- =====================================================

CREATE OR REPLACE FUNCTION notify_status_changed()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.assigned_to_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      NEW.assigned_to_id,
      'STATUS_CHANGED',
      'Job Status Updated',
      'Job ' || COALESCE(NEW.job_code, NEW.title) || ' is now ' || NEW.status,
      jsonb_build_object('jobId', NEW.id, 'jobCode', NEW.job_code, 'oldStatus', OLD.status, 'newStatus', NEW.status)
    );

    -- Also insert into job_updates
    INSERT INTO job_updates (job_id, type, content, previous_status, new_status)
    VALUES (
      NEW.id,
      'status_change',
      'Status changed from ' || COALESCE(OLD.status, 'new') || ' to ' || NEW.status,
      OLD.status,
      NEW.status
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS job_status_notification ON jobs;
CREATE TRIGGER job_status_notification
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION notify_status_changed();

-- =====================================================
-- 9. FUNCTION: MARK ALL NOTIFICATIONS AS READ
-- =====================================================

CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE notifications
  SET read = TRUE
  WHERE user_id = p_user_id AND read = FALSE;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION mark_all_notifications_read IS 'Mark all unread notifications as read for a user';

-- =====================================================
-- 10. FUNCTION: GET UNREAD NOTIFICATION COUNT
-- =====================================================

CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM notifications
    WHERE user_id = p_user_id AND read = FALSE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_unread_notification_count IS 'Get count of unread notifications for a user';
