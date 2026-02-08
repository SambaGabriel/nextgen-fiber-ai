-- Migration 009: Departments & Equipment
-- NextGen Fiber AI - CRM Completo + AI Agent Ready
--
-- Adds:
-- 1. Department column to jobs (aerial/underground)
-- 2. Enhanced trucks table with owner_type
-- 3. Drills table for underground equipment
-- 4. Underground-specific job fields
-- 5. Underground daily entries table

-- =====================================================
-- 1. ADD DEPARTMENT TO JOBS
-- =====================================================

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS department TEXT DEFAULT 'aerial'
  CHECK (department IN ('aerial', 'underground'));

COMMENT ON COLUMN jobs.department IS 'Work department: aerial (pole work) or underground (boring/trenching)';

-- =====================================================
-- 2. ENHANCED TRUCKS TABLE
-- =====================================================

-- If trucks table exists, add new columns
DO $$
BEGIN
  -- Add owner_type if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trucks' AND column_name = 'owner_type') THEN
    ALTER TABLE trucks ADD COLUMN owner_type TEXT DEFAULT 'company'
      CHECK (owner_type IN ('company', 'investor'));
  END IF;

  -- Add vehicle_description if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trucks' AND column_name = 'vehicle_description') THEN
    ALTER TABLE trucks ADD COLUMN vehicle_description TEXT;
  END IF;

  -- Add updated_at if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trucks' AND column_name = 'updated_at') THEN
    ALTER TABLE trucks ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- =====================================================
-- 3. DRILLS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS drills (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  equipment_description TEXT,
  owner_type TEXT DEFAULT 'company' CHECK (owner_type IN ('company', 'investor')),
  investor_id UUID REFERENCES auth.users(id),
  investor_name TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE drills IS 'Underground drilling/boring equipment';
COMMENT ON COLUMN drills.owner_type IS 'company = NextGen owned, investor = external investor owned';

-- =====================================================
-- 4. ADD EQUIPMENT REFERENCES TO JOBS
-- =====================================================

-- Truck assignment (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'assigned_truck_id') THEN
    ALTER TABLE jobs ADD COLUMN assigned_truck_id TEXT REFERENCES trucks(id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'truck_investor_name') THEN
    ALTER TABLE jobs ADD COLUMN truck_investor_name TEXT;
  END IF;
END $$;

-- Drill assignment
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_drill_id TEXT REFERENCES drills(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS drill_investor_name TEXT;

-- =====================================================
-- 5. UNDERGROUND-SPECIFIC JOB FIELDS
-- =====================================================

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS ground_type TEXT DEFAULT 'Normal'
  CHECK (ground_type IN ('Normal', 'Cobble', 'Rock'));

COMMENT ON COLUMN jobs.ground_type IS 'Ground type for underground jobs: Normal, Cobble, or Rock (affects rates)';

-- =====================================================
-- 6. UNDERGROUND DAILY ENTRIES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS underground_daily_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  is_full_day BOOLEAN DEFAULT TRUE,
  is_half_day BOOLEAN DEFAULT FALSE,
  conduit_feet INTEGER DEFAULT 0,
  ground_type TEXT DEFAULT 'Normal' CHECK (ground_type IN ('Normal', 'Cobble', 'Rock')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE underground_daily_entries IS 'Daily production entries for underground foreman work';
COMMENT ON COLUMN underground_daily_entries.is_full_day IS 'Full day worked (300 day rate)';
COMMENT ON COLUMN underground_daily_entries.is_half_day IS 'Half day worked (150 day rate)';
COMMENT ON COLUMN underground_daily_entries.conduit_feet IS 'Feet of conduit installed';

-- =====================================================
-- 7. INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_trucks_investor ON trucks(investor_id);
CREATE INDEX IF NOT EXISTS idx_drills_investor ON drills(investor_id);
CREATE INDEX IF NOT EXISTS idx_jobs_department ON jobs(department);
CREATE INDEX IF NOT EXISTS idx_jobs_truck ON jobs(assigned_truck_id);
CREATE INDEX IF NOT EXISTS idx_jobs_drill ON jobs(assigned_drill_id);
CREATE INDEX IF NOT EXISTS idx_daily_entries_job ON underground_daily_entries(job_id);
CREATE INDEX IF NOT EXISTS idx_daily_entries_date ON underground_daily_entries(entry_date);

-- =====================================================
-- 8. RLS POLICIES FOR DRILLS
-- =====================================================

ALTER TABLE drills ENABLE ROW LEVEL SECURITY;

-- Admin/Supervisor can do everything
CREATE POLICY drills_admin_all ON drills
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'SUPERVISOR')
    )
  );

-- Investors can view their own drills
CREATE POLICY drills_investor_select ON drills
  FOR SELECT
  TO authenticated
  USING (
    investor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'SUPERVISOR')
    )
  );

-- =====================================================
-- 9. RLS POLICIES FOR UNDERGROUND DAILY ENTRIES
-- =====================================================

ALTER TABLE underground_daily_entries ENABLE ROW LEVEL SECURITY;

-- Admin/Supervisor can do everything
CREATE POLICY daily_entries_admin_all ON underground_daily_entries
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'SUPERVISOR')
    )
  );

-- Foreman can create/view their own entries
CREATE POLICY daily_entries_foreman ON underground_daily_entries
  FOR ALL
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'SUPERVISOR')
    )
  );

-- =====================================================
-- 10. UPDATE TRIGGER FOR DRILLS
-- =====================================================

CREATE OR REPLACE FUNCTION update_drills_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS drills_updated_at ON drills;
CREATE TRIGGER drills_updated_at
  BEFORE UPDATE ON drills
  FOR EACH ROW
  EXECUTE FUNCTION update_drills_updated_at();

-- =====================================================
-- 11. UPDATE TRIGGER FOR DAILY ENTRIES
-- =====================================================

CREATE OR REPLACE FUNCTION update_daily_entries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS daily_entries_updated_at ON underground_daily_entries;
CREATE TRIGGER daily_entries_updated_at
  BEFORE UPDATE ON underground_daily_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_entries_updated_at();
