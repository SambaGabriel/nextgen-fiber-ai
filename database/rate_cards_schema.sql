-- =============================================
-- RATE CARDS MULTI-PROFILE SCHEMA - MVP
-- NextGen Fiber AI
-- =============================================

-- 1. RATE CARD GROUPS (Customer + Region)
CREATE TABLE IF NOT EXISTS rate_card_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  region TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(customer_name, region)
);

-- 2. RATE CARD PROFILES (com TYPE)
CREATE TABLE IF NOT EXISTS rate_card_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES rate_card_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('NEXTGEN', 'LINEMAN', 'INVESTOR')) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(group_id, name, type)
);

-- 3. RATE CARD ITEMS (Multiple rate columns per item)
CREATE TABLE IF NOT EXISTS rate_card_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES rate_card_groups(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES rate_card_profiles(id) ON DELETE CASCADE,

  code TEXT NOT NULL,
  description TEXT,
  unit TEXT CHECK (unit IN ('FT', 'EA', 'HR', 'DAY')) DEFAULT 'FT',

  -- Multiple rate columns (para import simples)
  nextgen_rate DECIMAL(10,4) NOT NULL DEFAULT 0,
  lineman_rate DECIMAL(10,4) NOT NULL DEFAULT 0,
  truck_investor_rate DECIMAL(10,4) NOT NULL DEFAULT 0,

  is_active BOOLEAN DEFAULT TRUE,
  effective_date DATE,
  expiration_date DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(profile_id, code)
);

-- 4. RATE CARD AUDIT LOG
CREATE TABLE IF NOT EXISTS rate_card_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  user_id UUID,
  user_name TEXT,
  previous_value JSONB,
  new_value JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Update jobs table for rate profile assignments
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS rate_card_group_id UUID REFERENCES rate_card_groups(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS nextgen_rate_profile_id UUID REFERENCES rate_card_profiles(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS lineman_rate_profile_id UUID REFERENCES rate_card_profiles(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS truck_investor_rate_profile_id UUID REFERENCES rate_card_profiles(id);

-- 6. PRODUCTION SUBMISSIONS
CREATE TABLE IF NOT EXISTS production_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  submitted_by UUID,
  submitted_by_name TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. PRODUCTION LINE ITEMS
CREATE TABLE IF NOT EXISTS production_line_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID REFERENCES production_submissions(id) ON DELETE CASCADE,
  rate_code TEXT NOT NULL,
  quantity DECIMAL(12,2) NOT NULL,
  unit TEXT CHECK (unit IN ('FT', 'EA', 'HR', 'DAY')) DEFAULT 'FT',
  notes TEXT
);

-- 8. CALCULATED TOTALS (IMUTÁVEL - apenas INSERT)
CREATE TABLE IF NOT EXISTS calculated_totals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID REFERENCES production_submissions(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id),

  -- Contexto CONGELADO
  frozen_context JSONB NOT NULL,

  -- Totais
  nextgen_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  lineman_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  truck_investor_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  gross_margin DECIMAL(12,2) NOT NULL DEFAULT 0,
  gross_margin_percent DECIMAL(5,2) DEFAULT 0,

  -- Breakdown
  line_item_calculations JSONB NOT NULL,

  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  calculated_by TEXT DEFAULT 'SYSTEM'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rate_groups_customer ON rate_card_groups(customer_name);
CREATE INDEX IF NOT EXISTS idx_rate_profiles_group ON rate_card_profiles(group_id);
CREATE INDEX IF NOT EXISTS idx_rate_items_profile ON rate_card_items(profile_id);
CREATE INDEX IF NOT EXISTS idx_rate_items_code ON rate_card_items(code);
CREATE INDEX IF NOT EXISTS idx_calculated_totals_job ON calculated_totals(job_id);
CREATE INDEX IF NOT EXISTS idx_calculated_totals_date ON calculated_totals(calculated_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON rate_card_audit_log(entity_type, entity_id);

-- RLS
ALTER TABLE rate_card_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_card_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_card_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_card_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculated_totals ENABLE ROW LEVEL SECURITY;

-- Policies (acesso autenticado)
DO $$
BEGIN
  -- Rate Card Groups
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rate_card_groups' AND policyname = 'Rate groups accessible by authenticated') THEN
    CREATE POLICY "Rate groups accessible by authenticated" ON rate_card_groups FOR ALL TO authenticated USING (true);
  END IF;

  -- Rate Card Profiles
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rate_card_profiles' AND policyname = 'Rate profiles accessible by authenticated') THEN
    CREATE POLICY "Rate profiles accessible by authenticated" ON rate_card_profiles FOR ALL TO authenticated USING (true);
  END IF;

  -- Rate Card Items
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rate_card_items' AND policyname = 'Rate items accessible by authenticated') THEN
    CREATE POLICY "Rate items accessible by authenticated" ON rate_card_items FOR ALL TO authenticated USING (true);
  END IF;

  -- Audit Log
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rate_card_audit_log' AND policyname = 'Audit log accessible by authenticated') THEN
    CREATE POLICY "Audit log accessible by authenticated" ON rate_card_audit_log FOR ALL TO authenticated USING (true);
  END IF;

  -- Production Submissions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'production_submissions' AND policyname = 'Production submissions accessible by authenticated') THEN
    CREATE POLICY "Production submissions accessible by authenticated" ON production_submissions FOR ALL TO authenticated USING (true);
  END IF;

  -- Production Line Items
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'production_line_items' AND policyname = 'Production line items accessible by authenticated') THEN
    CREATE POLICY "Production line items accessible by authenticated" ON production_line_items FOR ALL TO authenticated USING (true);
  END IF;

  -- Calculated Totals
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'calculated_totals' AND policyname = 'Calculated totals accessible by authenticated') THEN
    CREATE POLICY "Calculated totals accessible by authenticated" ON calculated_totals FOR ALL TO authenticated USING (true);
  END IF;
END $$;

-- Insert default data: Brightspeed Alabama
INSERT INTO rate_card_groups (id, customer_id, customer_name, region)
VALUES ('00000000-0000-0000-0000-000000000001', 'brightspeed', 'Brightspeed', 'AL')
ON CONFLICT (customer_name, region) DO NOTHING;

-- Insert default profile
INSERT INTO rate_card_profiles (id, group_id, name, type, is_default)
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Default', 'NEXTGEN', true)
ON CONFLICT (group_id, name, type) DO NOTHING;

-- Insert master rate items for Brightspeed Alabama
INSERT INTO rate_card_items (group_id, profile_id, code, description, unit, nextgen_rate, lineman_rate, truck_investor_rate)
VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'BSPD82C', 'Direct Aerial Place Fiber includes lashing to newly installed strand', 'FT', 0.70, 0.35, 0.05),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'BSPDSTRAND', 'Place Strand 6.6M - install strand with pole attachment hardware and bonding', 'FT', 0.70, 0.30, 0.05),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'BSPDLASH', 'Overlash Fiber to customer existing strand', 'FT', 0.90, 0.35, 0.05),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'BSPD85C', 'Fiber Placed in Conduit - place fiber in new or existing conduit', 'FT', 0.78, 0.36, 0.05),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'BSPDDBI', 'Directional Boring Composite - initial', 'FT', 7.80, 0, 0),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'BSPDDBIA', 'Directional Boring - additional cable/HDPE', 'FT', 2.00, 0, 0),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'BSPDDBIAR', 'Directional Boring - additional - Rock', 'FT', 15.00, 0, 0),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'BSPDDBIC', 'Directional Boring composite - initial - Cobble', 'FT', 13.00, 0, 0),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'BSPDDBIR', 'Directional Boring Composite - initial - Rock', 'FT', 58.00, 0, 0)
ON CONFLICT (profile_id, code) DO UPDATE SET
  description = EXCLUDED.description,
  nextgen_rate = EXCLUDED.nextgen_rate,
  lineman_rate = EXCLUDED.lineman_rate,
  truck_investor_rate = EXCLUDED.truck_investor_rate,
  updated_at = NOW();
