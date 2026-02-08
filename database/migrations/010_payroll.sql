-- Migration 010: Payroll System
-- NextGen Fiber AI - CRM Completo + AI Agent Ready
--
-- Adds:
-- 1. Pay periods tracking table
-- 2. Payroll records per user per week
-- 3. Investor returns per week
-- 4. Audit functions for payroll

-- =====================================================
-- 1. PAY PERIODS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS pay_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_key TEXT UNIQUE NOT NULL, -- '2026-02-03' (Monday of the week)
  week_number INTEGER NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  pay_date DATE NOT NULL, -- 1 month after week_end
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'processing', 'paid')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE pay_periods IS 'Weekly pay periods for payroll tracking';
COMMENT ON COLUMN pay_periods.week_key IS 'ISO date string of Monday (e.g., 2026-02-03)';
COMMENT ON COLUMN pay_periods.pay_date IS 'Expected payment date (usually 1 month after week_end)';
COMMENT ON COLUMN pay_periods.status IS 'open = accepting submissions, processing = calculating, paid = completed';

-- =====================================================
-- 2. PAYROLL RECORDS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS payroll_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_period_id UUID REFERENCES pay_periods(id),
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,

  -- Calculated totals
  total_amount DECIMAL(10,2) DEFAULT 0,
  jobs_count INTEGER DEFAULT 0,
  total_footage INTEGER DEFAULT 0,

  -- Breakdown JSON for detailed view
  breakdown JSONB,
  /*
  breakdown structure:
  {
    byJob: [
      { jobId, jobCode, footage, amount, completedDate }
    ],
    byWorkType: [
      { type: 'aerial'|'underground', amount, percentage }
    ],
    foremanDetails: {  // Only for foreman role
      fullDays: number,
      halfDays: number,
      conduitFeet: number,
      conduitRate: number,
      weeklyBonus: boolean,
      dayPay: number,
      conduitPay: number,
      bonusPay: number
    }
  }
  */

  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'disputed')),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES auth.users(id),
  payment_reference TEXT, -- Check number, wire ref, etc.

  -- Dispute handling
  disputed_at TIMESTAMPTZ,
  dispute_reason TEXT,
  dispute_resolved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(pay_period_id, user_id)
);

COMMENT ON TABLE payroll_records IS 'Payroll calculations per worker per pay period';
COMMENT ON COLUMN payroll_records.breakdown IS 'JSON breakdown of earnings by job and work type';

-- =====================================================
-- 3. INVESTOR RETURNS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS investor_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_period_id UUID REFERENCES pay_periods(id),
  investor_id UUID REFERENCES auth.users(id),
  investor_name TEXT NOT NULL,
  investor_type TEXT CHECK (investor_type IN ('truck', 'drill')),

  -- Equipment tracking
  equipment_id TEXT, -- truck_id or drill_id
  equipment_label TEXT,

  -- Calculated totals
  total_returns DECIMAL(10,2) DEFAULT 0,
  jobs_count INTEGER DEFAULT 0,
  total_footage INTEGER DEFAULT 0,

  -- Breakdown JSON
  breakdown JSONB,
  /*
  breakdown structure:
  {
    byJob: [
      { jobId, jobCode, footage, rate, amount, completedDate }
    ]
  }
  */

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES auth.users(id),
  payment_reference TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(pay_period_id, investor_id, equipment_id)
);

COMMENT ON TABLE investor_returns IS 'Investment returns per investor per equipment per pay period';
COMMENT ON COLUMN investor_returns.investor_type IS 'truck = truck investor, drill = drill investor';

-- =====================================================
-- 4. INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_pay_periods_status ON pay_periods(status);
CREATE INDEX IF NOT EXISTS idx_pay_periods_week ON pay_periods(week_start, week_end);
CREATE INDEX IF NOT EXISTS idx_payroll_period ON payroll_records(pay_period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_user ON payroll_records(user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_status ON payroll_records(status);
CREATE INDEX IF NOT EXISTS idx_investor_returns_period ON investor_returns(pay_period_id);
CREATE INDEX IF NOT EXISTS idx_investor_returns_investor ON investor_returns(investor_id);
CREATE INDEX IF NOT EXISTS idx_investor_returns_equipment ON investor_returns(equipment_id);

-- =====================================================
-- 5. RLS POLICIES FOR PAY PERIODS
-- =====================================================

ALTER TABLE pay_periods ENABLE ROW LEVEL SECURITY;

-- Admin/Supervisor can manage pay periods
CREATE POLICY pay_periods_admin ON pay_periods
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'SUPERVISOR', 'BILLING')
    )
  );

-- All authenticated users can view pay periods
CREATE POLICY pay_periods_read ON pay_periods
  FOR SELECT
  TO authenticated
  USING (TRUE);

-- =====================================================
-- 6. RLS POLICIES FOR PAYROLL RECORDS
-- =====================================================

ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;

-- Admin/Supervisor/Billing can manage all records
CREATE POLICY payroll_admin ON payroll_records
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'SUPERVISOR', 'BILLING')
    )
  );

-- Workers can view their own records
CREATE POLICY payroll_own_read ON payroll_records
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- =====================================================
-- 7. RLS POLICIES FOR INVESTOR RETURNS
-- =====================================================

ALTER TABLE investor_returns ENABLE ROW LEVEL SECURITY;

-- Admin/Supervisor/Billing can manage all returns
CREATE POLICY investor_returns_admin ON investor_returns
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'SUPERVISOR', 'BILLING')
    )
  );

-- Investors can view their own returns
CREATE POLICY investor_returns_own_read ON investor_returns
  FOR SELECT
  TO authenticated
  USING (investor_id = auth.uid());

-- =====================================================
-- 8. UPDATE TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION update_pay_periods_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pay_periods_updated_at ON pay_periods;
CREATE TRIGGER pay_periods_updated_at
  BEFORE UPDATE ON pay_periods
  FOR EACH ROW
  EXECUTE FUNCTION update_pay_periods_updated_at();

CREATE OR REPLACE FUNCTION update_payroll_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payroll_records_updated_at ON payroll_records;
CREATE TRIGGER payroll_records_updated_at
  BEFORE UPDATE ON payroll_records
  FOR EACH ROW
  EXECUTE FUNCTION update_payroll_records_updated_at();

CREATE OR REPLACE FUNCTION update_investor_returns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS investor_returns_updated_at ON investor_returns;
CREATE TRIGGER investor_returns_updated_at
  BEFORE UPDATE ON investor_returns
  FOR EACH ROW
  EXECUTE FUNCTION update_investor_returns_updated_at();

-- =====================================================
-- 9. HELPER FUNCTION: GET OR CREATE PAY PERIOD
-- =====================================================

CREATE OR REPLACE FUNCTION get_or_create_pay_period(target_date DATE)
RETURNS UUID AS $$
DECLARE
  monday_date DATE;
  sunday_date DATE;
  payment_date DATE;
  week_num INTEGER;
  period_id UUID;
BEGIN
  -- Calculate Monday of the week
  monday_date := target_date - EXTRACT(DOW FROM target_date)::INTEGER + 1;
  IF EXTRACT(DOW FROM target_date) = 0 THEN
    monday_date := target_date - 6; -- Sunday belongs to previous week
  END IF;

  sunday_date := monday_date + 6;
  payment_date := sunday_date + 30; -- Pay 1 month after week ends
  week_num := EXTRACT(WEEK FROM monday_date)::INTEGER;

  -- Try to find existing period
  SELECT id INTO period_id
  FROM pay_periods
  WHERE week_key = monday_date::TEXT;

  -- Create if not exists
  IF period_id IS NULL THEN
    INSERT INTO pay_periods (week_key, week_number, week_start, week_end, pay_date)
    VALUES (monday_date::TEXT, week_num, monday_date, sunday_date, payment_date)
    RETURNING id INTO period_id;
  END IF;

  RETURN period_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_or_create_pay_period IS 'Get or create a pay period for a given date';

-- =====================================================
-- 10. HELPER FUNCTION: GET PAYABLE WEEKS
-- =====================================================

CREATE OR REPLACE FUNCTION get_payable_weeks(num_weeks INTEGER DEFAULT 8)
RETURNS TABLE (
  period_id UUID,
  week_key TEXT,
  week_number INTEGER,
  week_start DATE,
  week_end DATE,
  pay_date DATE,
  status TEXT,
  is_payable BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH weeks AS (
    SELECT generate_series(
      date_trunc('week', CURRENT_DATE)::DATE - (num_weeks * 7),
      date_trunc('week', CURRENT_DATE)::DATE,
      '7 days'::INTERVAL
    )::DATE AS monday
  )
  SELECT
    COALESCE(pp.id, get_or_create_pay_period(w.monday)) AS period_id,
    w.monday::TEXT AS week_key,
    EXTRACT(WEEK FROM w.monday)::INTEGER AS week_number,
    w.monday AS week_start,
    w.monday + 6 AS week_end,
    w.monday + 36 AS pay_date, -- ~1 month after
    COALESCE(pp.status, 'open') AS status,
    (w.monday + 36) <= CURRENT_DATE AS is_payable
  FROM weeks w
  LEFT JOIN pay_periods pp ON pp.week_key = w.monday::TEXT
  ORDER BY w.monday DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_payable_weeks IS 'Get recent weeks with payroll status';
