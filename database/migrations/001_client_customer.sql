-- =============================================
-- MIGRATION: Client vs Customer Separation
-- NextGen Fiber AI
-- =============================================

-- 1. CLIENTS TABLE (Prime contractors - quem nos paga)
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CUSTOMERS TABLE (End operators - projeto final)
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add columns to rate_card_groups
ALTER TABLE rate_card_groups
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);

-- Rename customer_name to be clearer (keep for backward compat)
-- customer_id will be the proper reference
ALTER TABLE rate_card_groups
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);

-- 4. Add columns to jobs
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id);

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);

-- 5. RLS for new tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'clients' AND policyname = 'Clients open access') THEN
    CREATE POLICY "Clients open access" ON clients FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customers' AND policyname = 'Customers open access') THEN
    CREATE POLICY "Customers open access" ON customers FOR ALL USING (true);
  END IF;
END $$;

-- 6. Insert default clients
INSERT INTO clients (id, name, code) VALUES
  ('10000000-0000-0000-0000-000000000001', 'MasTec', 'MASTEC'),
  ('10000000-0000-0000-0000-000000000002', 'Henkels', 'HENKELS'),
  ('10000000-0000-0000-0000-000000000003', 'Direct', 'DIRECT')
ON CONFLICT (name) DO NOTHING;

-- 7. Insert default customers
INSERT INTO customers (id, name, code) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Brightspeed', 'BSPD'),
  ('20000000-0000-0000-0000-000000000002', 'All Points Broadband', 'APB'),
  ('20000000-0000-0000-0000-000000000003', 'AT&T', 'ATT'),
  ('20000000-0000-0000-0000-000000000004', 'Spectrum', 'SPEC'),
  ('20000000-0000-0000-0000-000000000005', 'Verizon', 'VZ'),
  ('20000000-0000-0000-0000-000000000006', 'Lumen', 'LUMEN'),
  ('20000000-0000-0000-0000-000000000007', 'Frontier', 'FRON')
ON CONFLICT (name) DO NOTHING;

-- 8. Backfill rate_card_groups with customer_id
-- Map existing customer_name to customer_id
UPDATE rate_card_groups rcg
SET customer_id = c.id
FROM customers c
WHERE rcg.customer_name = c.name
  AND rcg.customer_id IS NULL;

-- Set default client for existing rate cards (MasTec as default)
UPDATE rate_card_groups
SET client_id = '10000000-0000-0000-0000-000000000001'
WHERE client_id IS NULL;

-- 9. Backfill jobs with client_id
-- Map client_name to client_id
UPDATE jobs j
SET client_id = c.id
FROM clients c
WHERE j.client_name = c.name
  AND j.client_id IS NULL;

-- 10. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rate_groups_client ON rate_card_groups(client_id);
CREATE INDEX IF NOT EXISTS idx_rate_groups_customer ON rate_card_groups(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_client ON jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_customer ON jobs(customer_id);

-- 11. Update unique constraint on rate_card_groups
-- Rate card group is now unique by (client, customer, region)
-- First drop old constraint if exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rate_card_groups_customer_name_region_key'
  ) THEN
    ALTER TABLE rate_card_groups DROP CONSTRAINT rate_card_groups_customer_name_region_key;
  END IF;
END $$;

-- Add new unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'rate_card_groups_client_customer_region_key'
  ) THEN
    ALTER TABLE rate_card_groups
      ADD CONSTRAINT rate_card_groups_client_customer_region_key
      UNIQUE (client_id, customer_id, region);
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Ignore if constraint already exists or data conflicts
  NULL;
END $$;
