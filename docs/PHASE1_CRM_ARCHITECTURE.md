# Phase 1: CRM Base Architecture
## NextGen Fiber - Complete End-to-End Workflow

---

## 1. ASSUMPTIONS

1. **Stack**: Use existing React + Vite + TypeScript + Supabase (already in place)
2. **Auth**: Supabase Auth already configured with roles in `profiles` table
3. **Mobile**: Responsive design (mobile-first for Lineman views), not native app
4. **Multi-tenant**: NOT required - single company (NextGen Fiber)
5. **Currency**: USD, 2 decimal places
6. **Time Zone**: US Eastern (or job location based)
7. **File Storage**: Supabase Storage for photos
8. **Rate Card Scope**: Already has client_id + customer_id from recent migration
9. **Truck Assignment**: Per-job assignment (simpler than date ranges for MVP)
10. **Payout Split**: Fixed percentages per rate card item (already in schema)

---

## 2. STACK CHOICE

**Using existing stack (already implemented):**
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **State**: React hooks + localStorage fallback
- **Deployment**: Netlify (frontend) + Supabase (backend)

**Justification**:
- Already 80% built
- Supabase provides auth, RLS, storage out of the box
- No additional infrastructure needed
- Fast iteration for MVP

---

## 3. DATA MODEL

### 3.1 Existing Tables (Already Created)
```
users/profiles     - Auth users with roles
clients            - Prime contractors (MasTec, Henkels, Direct)
customers          - End operators (Brightspeed, APB, AT&T)
jobs               - Work assignments (has client_id, customer_id)
rate_card_groups   - Scoped by client + customer + region
rate_card_profiles - NEXTGEN, LINEMAN, INVESTOR rate sets
rate_card_items    - Individual rate codes with 3 rate columns
production_submissions - Submitted work
production_line_items  - Individual line items per submission
calculated_totals  - Immutable calculation snapshots
rate_card_audit_log - Audit trail
```

### 3.2 NEW Tables Needed

```sql
-- TRUCKS (vehicles assigned to jobs)
CREATE TABLE IF NOT EXISTS trucks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  truck_number TEXT NOT NULL UNIQUE,
  description TEXT,
  investor_id UUID REFERENCES investors(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- INVESTORS (truck owners who earn % of production)
CREATE TABLE IF NOT EXISTS investors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  payment_method TEXT, -- 'check', 'direct_deposit', 'other'
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PRODUCTION PHOTOS
CREATE TABLE IF NOT EXISTS production_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID REFERENCES production_submissions(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  caption TEXT,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  taken_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add truck_id to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS truck_id UUID REFERENCES trucks(id);

-- PAYOUT SUMMARY (aggregated by period for reporting)
CREATE TABLE IF NOT EXISTS payout_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  entity_type TEXT CHECK (entity_type IN ('LINEMAN', 'INVESTOR', 'COMPANY')) NOT NULL,
  entity_id UUID NOT NULL,
  entity_name TEXT NOT NULL,
  total_jobs INTEGER DEFAULT 0,
  total_footage DECIMAL(12,2) DEFAULT 0,
  total_earnings DECIMAL(12,2) DEFAULT 0,
  status TEXT CHECK (status IN ('pending', 'approved', 'paid')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trucks_investor ON trucks(investor_id);
CREATE INDEX IF NOT EXISTS idx_production_photos_submission ON production_photos(submission_id);
CREATE INDEX IF NOT EXISTS idx_payout_summaries_period ON payout_summaries(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_payout_summaries_entity ON payout_summaries(entity_type, entity_id);
```

### 3.3 Entity Relationships Diagram

```
                    ┌──────────────┐
                    │   INVESTORS  │
                    └──────┬───────┘
                           │ 1:N
                           ▼
┌──────────┐        ┌──────────────┐
│  CLIENTS │        │    TRUCKS    │
└────┬─────┘        └──────┬───────┘
     │ 1:N                 │ assigned to
     ▼                     ▼
┌──────────────┐    ┌──────────────┐      ┌──────────────┐
│  CUSTOMERS   │    │     JOBS     │◄─────│   PROFILES   │
└──────┬───────┘    │  (client_id, │      │  (linemen)   │
       │            │  customer_id,│      └──────────────┘
       │            │  truck_id,   │
       ▼            │  lineman_id) │
┌──────────────┐    └──────┬───────┘
│ RATE_CARD_   │           │
│   GROUPS     │           │ 1:N
│(client+cust+ │           ▼
│   region)    │    ┌──────────────┐
└──────┬───────┘    │ PRODUCTION_  │
       │            │ SUBMISSIONS  │
       │ 1:N        └──────┬───────┘
       ▼                   │ 1:N
┌──────────────┐           ▼
│ RATE_CARD_   │    ┌──────────────┐    ┌──────────────┐
│   ITEMS      │    │ PRODUCTION_  │    │ PRODUCTION_  │
│(code, rates) │    │ LINE_ITEMS   │    │   PHOTOS     │
└──────────────┘    └──────┬───────┘    └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ CALCULATED_  │
                    │   TOTALS     │
                    │ (immutable)  │
                    └──────────────┘
```

---

## 4. UI PAGES & FLOW

### 4.1 Admin Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/admin/dashboard` | Totals by date, project, lineman, truck |
| Jobs List | `/admin/jobs` | All jobs with filters (client, customer, status) |
| Create Job | `/admin/jobs/new` | Form: client, customer, region, lineman, truck |
| Job Details | `/admin/jobs/:id` | View job + submissions + calculations |
| Rate Cards | `/admin/rate-cards` | Manage rate cards (already exists) |
| Linemen | `/admin/linemen` | List/manage linemen |
| Trucks | `/admin/trucks` | List/manage trucks + investors |
| Investors | `/admin/investors` | List/manage investors |
| Payouts | `/admin/payouts` | Generate payout reports |

### 4.2 Lineman Pages (Mobile-First)

| Page | Route | Description |
|------|-------|-------------|
| My Jobs | `/my-jobs` | Jobs assigned to me (already exists) |
| Job Details | `/my-jobs/:id` | View job details, map, notes |
| Submit Production | `/my-jobs/:id/submit` | Form: rate codes, quantities, photos |
| Submission History | `/my-jobs/:id/submissions` | Past submissions for this job |

### 4.3 One Example Flow (End-to-End)

```
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: Admin creates Job                                           │
│ - Select Client: MasTec                                             │
│ - Select Customer: Brightspeed                                      │
│ - Select Region: AL                                                 │
│ - Enter: Title, City, Address, OLT, Feeder ID                      │
│ - System auto-resolves Rate Card Group                              │
│ - Assign Lineman: John Doe                                          │
│ - Assign Truck: Truck #101 (owned by Investor X)                   │
│ - Status: ASSIGNED                                                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: Lineman sees Job in "My Jobs"                               │
│ - Job appears with: Title, Location, Customer, Work Type            │
│ - Status: ASSIGNED → clicks "Start Work" → IN_PROGRESS              │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: Lineman submits Production                                  │
│ - Select Rate Code: BSPD82C (Direct Aerial Place Fiber)            │
│ - Enter Quantity: 1,250 FT                                          │
│ - Add another: BSPDSTRAND - 800 FT                                 │
│ - Upload Photos: 3 photos with GPS                                  │
│ - Add Notes: "Completed spans 22-24"                                │
│ - Submit → Status: SUBMITTED                                        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 4: System calculates earnings (AUTOMATIC)                      │
│                                                                     │
│ Line 1: BSPD82C × 1,250 FT                                         │
│   NextGen:  $0.70 × 1,250 = $875.00                                │
│   Lineman:  $0.35 × 1,250 = $437.50                                │
│   Investor: $0.05 × 1,250 = $62.50                                 │
│                                                                     │
│ Line 2: BSPDSTRAND × 800 FT                                        │
│   NextGen:  $0.70 × 800 = $560.00                                  │
│   Lineman:  $0.30 × 800 = $240.00                                  │
│   Investor: $0.05 × 800 = $40.00                                   │
│                                                                     │
│ TOTALS:                                                             │
│   NextGen Revenue:  $1,435.00                                       │
│   Lineman Pay:      $677.50                                         │
│   Investor Pay:     $102.50                                         │
│   Gross Margin:     $655.00 (45.6%)                                │
│                                                                     │
│ → Saved to calculated_totals (IMMUTABLE)                           │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 5: Admin views Dashboard                                       │
│                                                                     │
│ TODAY'S TOTALS:                                                     │
│   Revenue: $12,450.00                                               │
│   Lineman Pay: $5,890.00                                            │
│   Investor Pay: $890.00                                             │
│   Margin: $5,670.00 (45.5%)                                        │
│                                                                     │
│ BY LINEMAN:               BY TRUCK/INVESTOR:                        │
│   John Doe: $677.50         Truck #101: $102.50 (Investor X)       │
│   Jane Smith: $420.00       Truck #203: $85.00 (Investor Y)        │
│                                                                     │
│ BY CUSTOMER:              BY CLIENT:                                │
│   Brightspeed: $8,200       MasTec: $10,000                        │
│   APB: $4,250               Henkels: $2,450                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. CALCULATION RULES

### 5.1 Rate Card Resolution

```typescript
function resolveRateCard(job: Job): RateCardGroup | null {
  // Find rate card group by: client_id + customer_id + region
  return db.rate_card_groups.findFirst({
    where: {
      client_id: job.client_id,
      customer_id: job.customer_id,
      region: job.location.state,
      is_active: true
    }
  });
}
```

### 5.2 Earnings Calculation

```typescript
interface CalculationResult {
  nextgen_total: number;
  lineman_total: number;
  investor_total: number;
  gross_margin: number;
  gross_margin_percent: number;
  line_items: LineItemCalculation[];
}

function calculateEarnings(
  submission: ProductionSubmission,
  rateCardItems: RateCardItem[]
): CalculationResult {

  const lineItems: LineItemCalculation[] = [];
  let nextgen_total = 0;
  let lineman_total = 0;
  let investor_total = 0;

  for (const item of submission.line_items) {
    // Find matching rate
    const rate = rateCardItems.find(r => r.code === item.rate_code);

    if (!rate) {
      throw new Error(`Rate code not found: ${item.rate_code}`);
    }

    const nextgen = rate.nextgen_rate * item.quantity;
    const lineman = rate.lineman_rate * item.quantity;
    const investor = rate.truck_investor_rate * item.quantity;

    lineItems.push({
      rate_code: item.rate_code,
      quantity: item.quantity,
      unit: item.unit,
      nextgen_rate: rate.nextgen_rate,
      lineman_rate: rate.lineman_rate,
      investor_rate: rate.truck_investor_rate,
      nextgen_amount: nextgen,
      lineman_amount: lineman,
      investor_amount: investor
    });

    nextgen_total += nextgen;
    lineman_total += lineman;
    investor_total += investor;
  }

  const gross_margin = nextgen_total - lineman_total - investor_total;
  const gross_margin_percent = nextgen_total > 0
    ? (gross_margin / nextgen_total) * 100
    : 0;

  return {
    nextgen_total,
    lineman_total,
    investor_total,
    gross_margin,
    gross_margin_percent,
    line_items: lineItems
  };
}
```

### 5.3 Frozen Context (Audit Trail)

When saving calculations, freeze the context:

```typescript
const frozen_context = {
  job_id: job.id,
  job_title: job.title,
  client_id: job.client_id,
  client_name: job.clientName,
  customer_id: job.customer_id,
  customer_name: job.customerName,
  lineman_id: job.assignedToId,
  lineman_name: job.assignedToName,
  truck_id: job.truck_id,
  truck_number: truck.truck_number,
  investor_id: truck.investor_id,
  investor_name: investor.name,
  rate_card_group_id: rateCardGroup.id,
  calculated_at: new Date().toISOString(),
  rates_snapshot: rateCardItems.map(r => ({
    code: r.code,
    nextgen_rate: r.nextgen_rate,
    lineman_rate: r.lineman_rate,
    investor_rate: r.truck_investor_rate
  }))
};
```

---

## 6. API SPEC

### 6.1 Jobs API

```typescript
// GET /api/jobs
// List jobs with filters
Request: {
  params: {
    client_id?: string;
    customer_id?: string;
    status?: JobStatus;
    assigned_to_id?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number;
  }
}
Response: {
  jobs: Job[];
  total: number;
}

// POST /api/jobs
// Create job
Request: {
  body: {
    title: string;
    client_id: string;
    customer_id: string;
    work_type: 'aerial' | 'underground' | 'overlash' | 'mixed';
    location: {
      city: string;
      state: string;
      address?: string;
    };
    assigned_to_id?: string;
    truck_id?: string;
    scheduled_date?: string;
    estimated_footage?: number;
    supervisor_notes?: string;
  }
}
Response: {
  job: Job;
}

// PATCH /api/jobs/:id
// Update job (assign lineman, change status, etc.)
Request: {
  body: Partial<Job>;
}
Response: {
  job: Job;
}

// GET /api/jobs/:id
// Get job with submissions and calculations
Response: {
  job: Job;
  submissions: ProductionSubmission[];
  calculations: CalculatedTotal[];
  rate_card: RateCardGroup;
}
```

### 6.2 Production API

```typescript
// POST /api/jobs/:id/submissions
// Submit production
Request: {
  body: {
    line_items: {
      rate_code: string;
      quantity: number;
      unit: 'FT' | 'EA' | 'HR' | 'DAY';
      notes?: string;
    }[];
    photos?: {
      file_url: string;
      caption?: string;
      latitude?: number;
      longitude?: number;
    }[];
    notes?: string;
  }
}
Response: {
  submission: ProductionSubmission;
  calculation: CalculatedTotal;
}

// GET /api/jobs/:id/submissions
// List submissions for job
Response: {
  submissions: ProductionSubmission[];
}

// POST /api/submissions/:id/approve
// Approve submission
Response: {
  submission: ProductionSubmission;
}

// POST /api/submissions/:id/reject
// Reject submission
Request: {
  body: {
    reason: string;
  }
}
Response: {
  submission: ProductionSubmission;
}
```

### 6.3 Dashboard API

```typescript
// GET /api/dashboard/summary
// Get dashboard totals
Request: {
  params: {
    date_from: string;
    date_to: string;
    group_by?: 'day' | 'week' | 'month';
  }
}
Response: {
  totals: {
    revenue: number;
    lineman_pay: number;
    investor_pay: number;
    margin: number;
    margin_percent: number;
    total_jobs: number;
    total_footage: number;
  };
  by_lineman: {
    id: string;
    name: string;
    jobs: number;
    footage: number;
    earnings: number;
  }[];
  by_truck: {
    id: string;
    truck_number: string;
    investor_name: string;
    jobs: number;
    footage: number;
    earnings: number;
  }[];
  by_customer: {
    id: string;
    name: string;
    jobs: number;
    revenue: number;
  }[];
  by_client: {
    id: string;
    name: string;
    jobs: number;
    revenue: number;
  }[];
}

// GET /api/dashboard/timeline
// Get timeline data for charts
Response: {
  data: {
    date: string;
    revenue: number;
    lineman_pay: number;
    investor_pay: number;
    margin: number;
  }[];
}
```

### 6.4 Trucks & Investors API

```typescript
// GET /api/trucks
Response: { trucks: Truck[]; }

// POST /api/trucks
Request: {
  body: {
    truck_number: string;
    description?: string;
    investor_id?: string;
  }
}

// GET /api/investors
Response: { investors: Investor[]; }

// POST /api/investors
Request: {
  body: {
    name: string;
    email?: string;
    phone?: string;
  }
}
```

---

## 7. MILESTONE PLAN

### Day 1: Foundation
- [ ] Create migration SQL for new tables (trucks, investors, production_photos)
- [ ] Create services: `truckService.ts`, `investorService.ts`
- [ ] Update `jobStorageSupabase.ts` to include truck_id
- [ ] Create Admin Trucks page (list/create)
- [ ] Create Admin Investors page (list/create)

### Day 2: Job Flow Enhancement
- [ ] Update Create Job form to include Truck dropdown
- [ ] Add truck column to Jobs table
- [ ] Create job rate card auto-resolution logic
- [ ] Update Job Details to show truck/investor info

### Day 3: Production Submission
- [ ] Create/update Submit Production page for Lineman
- [ ] Rate code picker with autocomplete
- [ ] Photo upload with GPS metadata
- [ ] Integrate with calculation engine
- [ ] Save to production_submissions + production_line_items
- [ ] Auto-calculate and save to calculated_totals

### Day 4: Dashboard & Reports
- [ ] Create Dashboard page with summary cards
- [ ] Add charts (revenue by day, by lineman, by customer)
- [ ] Add filtering by date range
- [ ] Add export to CSV functionality
- [ ] Polish UI, fix bugs

---

## 8. CODE SCAFFOLDING

### 8.1 Project Structure (Additions)

```
services/
  ├── truckService.ts        # NEW
  ├── investorService.ts     # NEW
  ├── productionService.ts   # UPDATE (add calculation)
  ├── dashboardService.ts    # NEW

components/
  ├── AdminTrucks.tsx        # NEW
  ├── AdminInvestors.tsx     # NEW
  ├── AdminDashboard.tsx     # NEW (or update existing)
  ├── SubmitProduction.tsx   # UPDATE
  ├── JobsAdmin.tsx          # UPDATE (add truck dropdown)

database/
  migrations/
    ├── 002_trucks_investors.sql  # NEW
```

### 8.2 Migration SQL

```sql
-- 002_trucks_investors.sql

-- Investors
CREATE TABLE IF NOT EXISTS investors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  payment_method TEXT DEFAULT 'check',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trucks
CREATE TABLE IF NOT EXISTS trucks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  truck_number TEXT NOT NULL UNIQUE,
  description TEXT,
  investor_id UUID REFERENCES investors(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Production Photos
CREATE TABLE IF NOT EXISTS production_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID REFERENCES production_submissions(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  caption TEXT,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  taken_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add truck_id to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS truck_id UUID REFERENCES trucks(id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trucks_investor ON trucks(investor_id);
CREATE INDEX IF NOT EXISTS idx_trucks_number ON trucks(truck_number);
CREATE INDEX IF NOT EXISTS idx_jobs_truck ON jobs(truck_id);
CREATE INDEX IF NOT EXISTS idx_production_photos_submission ON production_photos(submission_id);

-- RLS
ALTER TABLE investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE trucks ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_photos ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Investors accessible by authenticated" ON investors FOR ALL TO authenticated USING (true);
CREATE POLICY "Trucks accessible by authenticated" ON trucks FOR ALL TO authenticated USING (true);
CREATE POLICY "Photos accessible by authenticated" ON production_photos FOR ALL TO authenticated USING (true);

-- Seed data
INSERT INTO investors (id, name, email) VALUES
  ('30000000-0000-0000-0000-000000000001', 'Investor Alpha', 'alpha@example.com'),
  ('30000000-0000-0000-0000-000000000002', 'Investor Beta', 'beta@example.com')
ON CONFLICT DO NOTHING;

INSERT INTO trucks (id, truck_number, description, investor_id) VALUES
  ('40000000-0000-0000-0000-000000000001', 'TRUCK-101', 'Ford F-350 Bucket', '30000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000002', 'TRUCK-102', 'Ford F-450 Digger', '30000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000003', 'TRUCK-203', 'Chevy 3500 Bucket', '30000000-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;
```

### 8.3 Truck Service

```typescript
// services/truckService.ts
import { supabase } from './supabase';

export interface Truck {
  id: string;
  truck_number: string;
  description?: string;
  investor_id?: string;
  investor_name?: string;
  is_active: boolean;
  created_at: string;
}

export interface Investor {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  payment_method?: string;
  is_active: boolean;
  created_at: string;
}

export async function getTrucks(): Promise<Truck[]> {
  const { data, error } = await supabase
    .from('trucks')
    .select(`
      *,
      investors:investor_id (name)
    `)
    .eq('is_active', true)
    .order('truck_number');

  if (error) {
    console.error('Error fetching trucks:', error);
    return [];
  }

  return (data || []).map(t => ({
    ...t,
    investor_name: t.investors?.name || null
  }));
}

export async function createTruck(
  truck_number: string,
  description?: string,
  investor_id?: string
): Promise<Truck | null> {
  const { data, error } = await supabase
    .from('trucks')
    .insert({ truck_number, description, investor_id })
    .select()
    .single();

  if (error) {
    console.error('Error creating truck:', error);
    throw new Error(error.message);
  }

  return data;
}

export async function getInvestors(): Promise<Investor[]> {
  const { data, error } = await supabase
    .from('investors')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('Error fetching investors:', error);
    return [];
  }

  return data || [];
}

export async function createInvestor(
  name: string,
  email?: string,
  phone?: string
): Promise<Investor | null> {
  const { data, error } = await supabase
    .from('investors')
    .insert({ name, email, phone })
    .select()
    .single();

  if (error) {
    console.error('Error creating investor:', error);
    throw new Error(error.message);
  }

  return data;
}
```

### 8.4 Calculation Service

```typescript
// services/calculationService.ts
import { supabase } from './supabase';

export interface LineItemCalculation {
  rate_code: string;
  description: string;
  quantity: number;
  unit: string;
  nextgen_rate: number;
  lineman_rate: number;
  investor_rate: number;
  nextgen_amount: number;
  lineman_amount: number;
  investor_amount: number;
}

export interface CalculationResult {
  nextgen_total: number;
  lineman_total: number;
  investor_total: number;
  gross_margin: number;
  gross_margin_percent: number;
  line_items: LineItemCalculation[];
}

export async function calculateProduction(
  jobId: string,
  lineItems: { rate_code: string; quantity: number; unit: string }[]
): Promise<CalculationResult> {
  // Get job to find rate card group
  const { data: job } = await supabase
    .from('jobs')
    .select('client_id, customer_id, location')
    .eq('id', jobId)
    .single();

  if (!job) throw new Error('Job not found');

  // Find rate card group
  const { data: rateGroup } = await supabase
    .from('rate_card_groups')
    .select('id')
    .eq('client_id', job.client_id)
    .eq('customer_id', job.customer_id)
    .eq('region', job.location?.state)
    .eq('is_active', true)
    .single();

  if (!rateGroup) {
    throw new Error(`No rate card found for client=${job.client_id}, customer=${job.customer_id}, region=${job.location?.state}`);
  }

  // Get rate items
  const codes = lineItems.map(i => i.rate_code);
  const { data: rateItems } = await supabase
    .from('rate_card_items')
    .select('*')
    .eq('group_id', rateGroup.id)
    .in('code', codes);

  if (!rateItems || rateItems.length === 0) {
    throw new Error('No rate items found');
  }

  // Calculate
  const calculations: LineItemCalculation[] = [];
  let nextgen_total = 0;
  let lineman_total = 0;
  let investor_total = 0;

  for (const item of lineItems) {
    const rate = rateItems.find(r => r.code === item.rate_code);
    if (!rate) {
      throw new Error(`Rate code not found: ${item.rate_code}`);
    }

    const nextgen_amount = Number(rate.nextgen_rate) * item.quantity;
    const lineman_amount = Number(rate.lineman_rate) * item.quantity;
    const investor_amount = Number(rate.truck_investor_rate) * item.quantity;

    calculations.push({
      rate_code: item.rate_code,
      description: rate.description || '',
      quantity: item.quantity,
      unit: item.unit,
      nextgen_rate: Number(rate.nextgen_rate),
      lineman_rate: Number(rate.lineman_rate),
      investor_rate: Number(rate.truck_investor_rate),
      nextgen_amount,
      lineman_amount,
      investor_amount
    });

    nextgen_total += nextgen_amount;
    lineman_total += lineman_amount;
    investor_total += investor_amount;
  }

  const gross_margin = nextgen_total - lineman_total - investor_total;
  const gross_margin_percent = nextgen_total > 0
    ? (gross_margin / nextgen_total) * 100
    : 0;

  return {
    nextgen_total,
    lineman_total,
    investor_total,
    gross_margin,
    gross_margin_percent: Math.round(gross_margin_percent * 100) / 100,
    line_items: calculations
  };
}

export async function saveCalculation(
  submissionId: string,
  jobId: string,
  result: CalculationResult,
  frozenContext: object
): Promise<void> {
  await supabase.from('calculated_totals').insert({
    submission_id: submissionId,
    job_id: jobId,
    frozen_context: frozenContext,
    nextgen_total: result.nextgen_total,
    lineman_total: result.lineman_total,
    truck_investor_total: result.investor_total,
    gross_margin: result.gross_margin,
    gross_margin_percent: result.gross_margin_percent,
    line_item_calculations: result.line_items
  });
}
```

---

## 9. NEXT STEPS

1. **Run migration** `002_trucks_investors.sql` in Supabase
2. **Create truck/investor services** and pages
3. **Update JobsAdmin** to include truck dropdown
4. **Build Submit Production** page with calculation integration
5. **Build Dashboard** with aggregations
6. **Test end-to-end flow**

---

## 10. PHASE 2 PREPARATION

The data model is designed so Phase 2 (AI) can:

1. **Parse scope PDFs** and extract:
   - Feeder IDs → Job titles
   - Map pages → Individual jobs
   - Footage estimates → `estimated_footage` field

2. **Auto-create jobs** via existing API:
   - `POST /api/jobs` with extracted data
   - Jobs appear in Jobs Management immediately

3. **Map extraction** to populate:
   - `job.olt`, `job.feeder_id`, `job.supervisor_notes`
   - Attach map files to jobs

The Phase 1 CRM is the "container" that Phase 2 AI will populate.
