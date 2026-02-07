# Rate Cards System Design - NextGen Fiber

> **Status**: MVP Implementado ✅
> **Última atualização**: 2025-02-07
> **Versão**: 2.0

## Status de Implementação

| Feature | Status | Arquivo |
|---------|--------|---------|
| Rate Card Groups | ✅ Done | `rate_card_groups` table |
| Rate Card Profiles | ✅ Done | `rate_card_profiles` table |
| Rate Card Items (multi-column) | ✅ Done | `rate_card_items` table |
| UI Filtros (Customer/Region/Profile) | ✅ Done | `RateCardsV2.tsx` |
| Tabela Multi-Coluna | ✅ Done | `RateCardsV2.tsx` |
| Edição Inline | ✅ Done | `RateCardsV2.tsx` |
| Import Excel | ✅ Done | `excelParser.ts` |
| Audit Log | ✅ Done | `rate_card_audit_log` table |
| Job Rate Profile Assignment | 🔄 Phase 2 | - |
| Production Submission | 🔄 Phase 2 | - |
| Calculation Pipeline | 🔄 Phase 2 | - |
| Dashboard Metrics | 🔄 Phase 2 | - |

---

## Overview

Sistema completo de Rate Cards com múltiplas colunas de rate (NextGen, Lineman, Truck Investor) e múltiplos profiles por cliente/região.

---

## PRINCÍPIOS FUNDAMENTAIS (INEGOCIÁVEIS)

### 1. Determinismo Total
- O rate card usado **NUNCA** pode ser adivinhado
- Deve ser determinado de forma **explícita e rastreável**
- Escolhas salvas no Job, congeladas na submissão

### 2. Imutabilidade dos Cálculos
- `CalculationResult` é **IMUTÁVEL** após criação
- Dashboard **NÃO recalcula** - apenas consulta resultados já calculados
- Histórico **NUNCA** é recalculado retroativamente

### 3. Falha Explícita
- Se um rate não existir → **ERRO EXPLÍCITO**
- **ZERO** fallback silencioso
- Tudo rastreável como sistema financeiro real

### 4. Hierarquia de Determinação

```
RATE CARD GROUP = Job.customer + Job.region

PERFIL = Hierarquia:
  1. Perfil específico do lineman (se existir)
  2. Perfil específico do truck investor (se existir)
  3. Perfil default (fallback único permitido)
```

---

## FLUXO END-TO-END

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLUXO COMPLETO                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. ADMIN CRIA JOB                                                          │
│     ├─ Define: customer, region, mapa/run                                   │
│     ├─ Atribui: lineman, truck investor                                     │
│     └─ Sistema auto-resolve: rateCardGroupId + profileIds                   │
│                                                                             │
│  2. LINEMAN EXECUTA E SUBMETE PRODUÇÃO                                      │
│     ├─ Registra: 2.400 ft lash, 8 âncoras, 3 coils                         │
│     └─ Submissão vinculada ao Job                                           │
│                                                                             │
│  3. SISTEMA CALCULA AUTOMATICAMENTE                                         │
│     ├─ Busca: Job → customer + region + perfis                              │
│     ├─ Aplica: Rate Cards corretos                                          │
│     ├─ Gera: CalculationResult (IMUTÁVEL)                                   │
│     └─ Emite: evento production.calculated                                  │
│                                                                             │
│  4. DASHBOARD CONSOME CÁLCULOS                                              │
│     ├─ NÃO recalcula nada                                                   │
│     ├─ Apenas: soma, filtra, apresenta                                      │
│     └─ Garante: performance + auditabilidade                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Data Model

### TypeScript Interfaces

```typescript
// ===== RATE CARD GROUP (Customer + Region) =====
interface RateCardGroup {
  id: string;
  customerId: string;
  customerName: string;       // "Brightspeed"
  region: string;             // "AL" (Alabama)
  defaultProfileId: string;   // Points to default profile
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ===== RATE CARD PROFILE =====
interface RateCardProfile {
  id: string;
  groupId: string;            // FK to RateCardGroup
  name: string;               // "Default", "Crew A", "Investor X"
  type: 'NEXTGEN' | 'LINEMAN' | 'INVESTOR';  // Profile type
  description?: string;
  isDefault: boolean;         // Only one default per group per type
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ===== RATE CARD ITEM (Individual Rate Line) =====
// NOTA: Cada profile tem seus próprios items com UMA rate
// O tipo de rate é determinado pelo profile.type
interface RateCardItem {
  id: string;
  groupId: string;            // FK to RateCardGroup
  profileId: string;          // FK to RateCardProfile
  code: string;               // "BSPDLASH", "BSPD82C"
  description: string;
  unit: 'FT' | 'EA' | 'HR' | 'DAY';
  rate: number;               // A rate específica deste profile

  // Metadata
  isActive: boolean;
  effectiveDate?: string;     // Phase 2: rate versioning
  expirationDate?: string;    // Phase 2
  createdAt: string;
  updatedAt: string;
}

// ALTERNATIVA: Múltiplas rates por item (mais simples para import)
interface RateCardItemMultiColumn {
  id: string;
  groupId: string;
  profileId: string;          // Profile "Default" pode ter todas as colunas
  code: string;
  description: string;
  unit: 'FT' | 'EA' | 'HR' | 'DAY';

  nextgenRate: number;        // Company revenue rate
  linemanRate: number;        // Lineman payout rate
  truckInvestorRate: number;  // Investor rate

  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ===== JOB (FONTE DE VERDADE DO CONTEXTO) =====
interface Job {
  id: string;

  // Context (determina rate card group)
  customer: string;                 // "Brightspeed"
  region: string;                   // "AL"

  // Assignments
  linemanUserId?: string;           // Lineman atribuído
  truckInvestorId?: string;         // Truck investor atribuído

  // Rate profile assignments (EXPLÍCITOS E RASTREÁVEIS)
  rateCardGroupId: string;          // Auto-resolved: customer + region
  nextgenRateProfileId: string;     // Profile para cálculo NextGen
  linemanRateProfileId: string;     // Profile para cálculo Lineman
  truckInvestorRateProfileId: string; // Profile para cálculo Investor

  // Status
  status: 'draft' | 'assigned' | 'in_progress' | 'submitted' | 'approved' | 'invoiced';

  // ... other fields ...
}

// ===== PRODUCTION SUBMISSION =====
interface ProductionSubmission {
  id: string;
  jobId: string;
  submittedBy: string;        // Lineman ID
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';

  lineItems: ProductionLineItem[];

  // Calculated totals (computed on submission/approval)
  calculatedTotals?: CalculatedTotals;
}

interface ProductionLineItem {
  id: string;
  submissionId: string;
  rateCode: string;           // "BSPDLASH"
  quantity: number;           // 1500 (feet)
  unit: 'FT' | 'EA';
  notes?: string;
}

// ===== CALCULATED TOTALS (Stored for Dashboard) =====
interface CalculatedTotals {
  id: string;
  submissionId: string;
  jobId: string;

  // Aggregate amounts
  nextgenTotal: number;       // Sum of qty * nextgenRate
  linemanTotal: number;       // Sum of qty * linemanRate
  truckInvestorTotal: number; // Sum of qty * truckInvestorRate
  grossMargin: number;        // nextgenTotal - linemanTotal - truckInvestorTotal
  grossMarginPercent: number; // (grossMargin / nextgenTotal) * 100

  // Line item breakdown for audit
  lineItemCalculations: LineItemCalculation[];

  calculatedAt: string;
  calculatedBy: string;       // System or user who approved
}

interface LineItemCalculation {
  lineItemId: string;
  rateCode: string;
  quantity: number;
  unit: string;

  nextgenRate: number;
  linemanRate: number;
  truckInvestorRate: number;

  nextgenAmount: number;      // qty * nextgenRate
  linemanAmount: number;      // qty * linemanRate
  truckInvestorAmount: number;// qty * truckInvestorRate
}

// ===== AUDIT LOG =====
interface RateCardAuditLog {
  id: string;
  action: 'IMPORT' | 'CREATE' | 'UPDATE' | 'DELETE' | 'PROFILE_CREATE';
  entityType: 'GROUP' | 'PROFILE' | 'ITEM';
  entityId: string;

  userId: string;
  userName: string;

  previousValue?: any;        // JSON of old state
  newValue?: any;             // JSON of new state

  metadata?: {
    importFileName?: string;
    rowsCreated?: number;
    rowsUpdated?: number;
    errors?: string[];
  };

  createdAt: string;
}
```

### Database Schema (PostgreSQL/Supabase)

```sql
-- =============================================
-- RATE CARDS MULTI-PROFILE SCHEMA
-- =============================================

-- 1. RATE CARD GROUPS (Customer + Region)
CREATE TABLE rate_card_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  region TEXT NOT NULL,
  default_profile_id UUID,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(customer_name, region)
);

-- 2. RATE CARD PROFILES
CREATE TABLE rate_card_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES rate_card_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('NEXTGEN', 'LINEMAN', 'INVESTOR')) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,  -- Only one default per group+type
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(group_id, name, type)
);

-- 3. RATE CARD ITEMS (Individual Rates)
CREATE TABLE rate_card_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES rate_card_groups(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES rate_card_profiles(id) ON DELETE CASCADE,

  code TEXT NOT NULL,
  description TEXT,
  unit TEXT CHECK (unit IN ('FT', 'EA', 'HR', 'DAY')) DEFAULT 'FT',

  -- Multiple rate columns
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

-- 4. Update jobs table to include rate profile assignments
-- Estes campos são OBRIGATÓRIOS para cálculo determinístico
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS rate_card_group_id UUID REFERENCES rate_card_groups(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS nextgen_rate_profile_id UUID REFERENCES rate_card_profiles(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS lineman_rate_profile_id UUID REFERENCES rate_card_profiles(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS truck_investor_rate_profile_id UUID REFERENCES rate_card_profiles(id);

COMMENT ON COLUMN jobs.rate_card_group_id IS 'Auto-resolved from customer + region';
COMMENT ON COLUMN jobs.nextgen_rate_profile_id IS 'Profile para cálculo NextGen (company revenue)';
COMMENT ON COLUMN jobs.lineman_rate_profile_id IS 'Profile para cálculo payout lineman';
COMMENT ON COLUMN jobs.truck_investor_rate_profile_id IS 'Profile para cálculo payout investor';

-- 5. PRODUCTION SUBMISSIONS
CREATE TABLE production_submissions (
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

-- 6. PRODUCTION LINE ITEMS
CREATE TABLE production_line_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID REFERENCES production_submissions(id) ON DELETE CASCADE,
  rate_code TEXT NOT NULL,
  quantity DECIMAL(12,2) NOT NULL,
  unit TEXT CHECK (unit IN ('FT', 'EA', 'HR', 'DAY')) DEFAULT 'FT',
  notes TEXT
);

-- 7. CALCULATED TOTALS (Pre-computed for Dashboard) - IMUTÁVEL
CREATE TABLE calculated_totals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID REFERENCES production_submissions(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id),

  -- Contexto CONGELADO (snapshot para auditoria)
  frozen_context JSONB NOT NULL,  -- { customer, region, profileIds... }

  -- Totais calculados
  nextgen_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  lineman_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  truck_investor_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  gross_margin DECIMAL(12,2) NOT NULL DEFAULT 0,
  gross_margin_percent DECIMAL(5,2) DEFAULT 0,

  -- Breakdown por line item (para drill-down)
  line_item_calculations JSONB NOT NULL,

  -- Metadata
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  calculated_by TEXT DEFAULT 'SYSTEM'
);

-- IMPORTANTE: Esta tabela é APPEND-ONLY
-- Nunca atualizar ou deletar registros após criação
COMMENT ON TABLE calculated_totals IS 'IMUTÁVEL - Apenas INSERT, nunca UPDATE/DELETE';

-- 8. RATE CARD AUDIT LOG
CREATE TABLE rate_card_audit_log (
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

-- Indexes for performance
CREATE INDEX idx_rate_items_profile ON rate_card_items(profile_id);
CREATE INDEX idx_rate_items_code ON rate_card_items(code);
CREATE INDEX idx_calculated_totals_job ON calculated_totals(job_id);
CREATE INDEX idx_production_submissions_job ON production_submissions(job_id);
CREATE INDEX idx_audit_log_entity ON rate_card_audit_log(entity_type, entity_id);

-- RLS Policies
ALTER TABLE rate_card_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_card_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_card_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculated_totals ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_card_audit_log ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Rate cards readable by authenticated" ON rate_card_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Rate profiles readable by authenticated" ON rate_card_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Rate items readable by authenticated" ON rate_card_items FOR SELECT TO authenticated USING (true);

-- Admin/Supervisor can manage (implement role check in app layer)
CREATE POLICY "Rate cards manageable by authenticated" ON rate_card_groups FOR ALL TO authenticated USING (true);
CREATE POLICY "Rate profiles manageable by authenticated" ON rate_card_profiles FOR ALL TO authenticated USING (true);
CREATE POLICY "Rate items manageable by authenticated" ON rate_card_items FOR ALL TO authenticated USING (true);
```

---

## 2. Excel Import Specification

### Supported Import Formats

#### Option A: Single Sheet with Profile Column

| Customer | Region | Profile | Code | Description | Unit | NextGen Rate | Lineman Rate | Truck Investor Rate |
|----------|--------|---------|------|-------------|------|--------------|--------------|---------------------|
| Brightspeed | AL | Default | BSPD82C | Direct Aerial Place Fiber | FT | 0.70 | 0.35 | 0.05 |
| Brightspeed | AL | Default | BSPDLASH | Overlash Fiber | FT | 0.90 | 0.35 | 0.05 |
| Brightspeed | AL | Crew A | BSPD82C | Direct Aerial Place Fiber | FT | 0.70 | 0.40 | 0.05 |

#### Option B: Multiple Sheets (Recommended)

Each sheet name = Profile name

**Sheet: "Default"**
| Code | Description | Unit | NextGen Rate | Lineman Rate | Truck Investor Rate |
|------|-------------|------|--------------|--------------|---------------------|
| BSPD82C | Direct Aerial Place Fiber | FT | 0.70 | 0.35 | 0.05 |
| BSPDLASH | Overlash Fiber | FT | 0.90 | 0.35 | 0.05 |

**Sheet: "Crew A"**
| Code | Description | Unit | NextGen Rate | Lineman Rate | Truck Investor Rate |
|------|-------------|------|--------------|--------------|---------------------|
| BSPD82C | Direct Aerial Place Fiber | FT | 0.70 | 0.40 | 0.05 |

### Column Mapping Rules

| Column Name (Flexible) | Maps To | Required |
|------------------------|---------|----------|
| Code, Item Code, Item Number, Rate Code | code | YES |
| Description, Item Description, Desc | description | NO |
| Unit, UOM, Unit of Measure | unit | YES (default: FT) |
| NextGen Rate, NextGen, Company Rate, Revenue Rate | nextgenRate | YES |
| Lineman Rate, Lineman, Linemen Rate, Crew Rate | linemanRate | YES |
| Truck Investor Rate, Investor Rate, Truck Rate | truckInvestorRate | NO (default: 0) |
| Profile, Profile Name | profileName | NO (default: "Default") |

### Import Validation Rules

1. **Required columns**: Code, Unit, at least one rate column
2. **Code format**: Non-empty string, will be uppercased
3. **Unit values**: Must be FT, EA, HR, or DAY (case insensitive)
4. **Rate values**: Must be numeric, >= 0
5. **Duplicate codes**: Within same profile, last row wins (with warning)

### Import Preview Response

```typescript
interface ImportPreview {
  fileName: string;
  sheets: SheetPreview[];
  summary: {
    totalRows: number;
    validRows: number;
    errorRows: number;
    profilesToCreate: string[];
    itemsToCreate: number;
    itemsToUpdate: number;
  };
  errors: ImportError[];
  warnings: ImportWarning[];
}

interface SheetPreview {
  sheetName: string;
  profileName: string;
  rows: PreviewRow[];
}

interface PreviewRow {
  rowNumber: number;
  code: string;
  description: string;
  unit: string;
  nextgenRate: number;
  linemanRate: number;
  truckInvestorRate: number;
  action: 'CREATE' | 'UPDATE' | 'SKIP';
  errors?: string[];
}

interface ImportError {
  sheet: string;
  row: number;
  column: string;
  message: string;
}
```

---

## 3. UI/UX Design

### Rate Cards Page Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ RATE CARDS                                           [Upload Excel] [+] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐                │
│ │ Customer ▼  │ │ Region ▼   │ │ Profile ▼  [+ New]  │    [Search...] │
│ │ Brightspeed │ │ AL         │ │ Default             │                │
│ └─────────────┘ └─────────────┘ └─────────────────────┘                │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ Code      │ Description          │ Unit │ NextGen │ Lineman │ Truck │ │
│ ├───────────┼──────────────────────┼──────┼─────────┼─────────┼───────┤ │
│ │ BSPD82C   │ Direct Aerial Fiber  │ FT   │ $0.70   │ $0.35   │ $0.05 │ │
│ │ BSPDSTRAND│ Place Strand 6.6M    │ FT   │ $0.70   │ $0.30   │ $0.05 │ │
│ │ BSPDLASH  │ Overlash Fiber       │ FT   │ $0.90   │ $0.35   │ $0.05 │ │
│ │ BSPD85C   │ Fiber in Conduit     │ FT   │ $0.78   │ $0.36   │ $0.05 │ │
│ │ BSPDDBI   │ Directional Boring   │ FT   │ $7.80   │ N/A     │ N/A   │ │
│ └───────────┴──────────────────────┴──────┴─────────┴─────────┴───────┘ │
│                                                                         │
│ Showing 9 of 9 items                              [Duplicate Profile]  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Upload Excel Modal Flow

```
Step 1: Select File
┌──────────────────────────────────────────────────────┐
│ Upload Rate Card Excel                          [X]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │     📄 Drop Excel file here or click to browse │  │
│  │         Supports .xlsx, .xls                   │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  Customer: [Brightspeed ▼]   Region: [AL ▼]         │
│                                                      │
│                              [Cancel] [Next →]       │
└──────────────────────────────────────────────────────┘

Step 2: Preview & Validate
┌──────────────────────────────────────────────────────┐
│ Import Preview                                  [X]  │
├──────────────────────────────────────────────────────┤
│ File: BRIGHTSPEED_AL_RATES.xlsx                      │
│ Profiles found: Default, Crew A                      │
│                                                      │
│ ┌──────────────────────────────────────────────────┐ │
│ │ ✓ 18 items to create                             │ │
│ │ ↻ 0 items to update                              │ │
│ │ ⚠ 2 warnings                                     │ │
│ │ ✗ 0 errors                                       │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ Sheet: Default (9 items)                             │
│ ┌────────┬──────────────────┬────┬───────┬───────┐  │
│ │ Code   │ Description      │Unit│NextGen│Lineman│  │
│ ├────────┼──────────────────┼────┼───────┼───────┤  │
│ │✓BSPD82C│ Direct Aerial... │ FT │ $0.70 │ $0.35 │  │
│ │✓BSPDLA │ Overlash Fiber   │ FT │ $0.90 │ $0.35 │  │
│ └────────┴──────────────────┴────┴───────┴───────┘  │
│                                                      │
│ Warnings:                                            │
│ ⚠ Row 5: Lineman Rate is N/A, defaulting to 0       │
│                                                      │
│                         [← Back] [Cancel] [Import]   │
└──────────────────────────────────────────────────────┘

Step 3: Success
┌──────────────────────────────────────────────────────┐
│ Import Complete                                 [X]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│                    ✓                                 │
│              Import Successful                       │
│                                                      │
│         18 rate items imported                       │
│         2 profiles created                           │
│                                                      │
│                                    [View Rate Cards] │
└──────────────────────────────────────────────────────┘
```

### Component Structure

```
components/
├── RateCards/
│   ├── RateCardsPage.tsx           # Main page container
│   ├── RateCardFilters.tsx         # Customer/Region/Profile dropdowns
│   ├── RateCardTable.tsx           # Editable table with multi-column rates
│   ├── RateCardRow.tsx             # Single row with inline edit
│   ├── ProfileSelector.tsx         # Profile dropdown + create new
│   ├── CreateProfileModal.tsx      # Create/duplicate profile
│   ├── ImportExcelModal.tsx        # Multi-step import wizard
│   ├── ImportPreview.tsx           # Preview table with validation
│   └── ImportSummary.tsx           # Success/error summary
├── hooks/
│   ├── useRateCardGroups.ts        # Fetch groups
│   ├── useRateCardProfiles.ts      # Fetch profiles for group
│   ├── useRateCardItems.ts         # Fetch items for profile
│   └── useExcelImport.ts           # Parse and import Excel
└── services/
    ├── rateCardService.ts          # API calls
    └── excelParser.ts              # Excel parsing logic
```

---

## 4. API Contracts

### GET /api/rate-cards/groups

List all customer+region groups.

**Response:**
```json
{
  "groups": [
    {
      "id": "uuid-1",
      "customerId": "brightspeed",
      "customerName": "Brightspeed",
      "region": "AL",
      "defaultProfileId": "uuid-profile-1",
      "profileCount": 3,
      "itemCount": 27,
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### GET /api/rate-cards/groups/:groupId/profiles

List profiles for a group.

**Response:**
```json
{
  "groupId": "uuid-1",
  "profiles": [
    {
      "id": "uuid-profile-1",
      "name": "Default",
      "isDefault": true,
      "itemCount": 9,
      "updatedAt": "2024-01-15T10:30:00Z"
    },
    {
      "id": "uuid-profile-2",
      "name": "Crew A",
      "isDefault": false,
      "itemCount": 9,
      "updatedAt": "2024-01-15T11:00:00Z"
    }
  ]
}
```

### POST /api/rate-cards/groups/:groupId/profiles

Create new profile (optionally duplicate from existing).

**Request:**
```json
{
  "name": "Crew B",
  "description": "Higher lineman rates for Crew B",
  "duplicateFromProfileId": "uuid-profile-1"  // Optional
}
```

### GET /api/rate-cards/items?groupId=X&profileId=Y

Get rate items for a specific profile.

**Response:**
```json
{
  "groupId": "uuid-1",
  "profileId": "uuid-profile-1",
  "profileName": "Default",
  "items": [
    {
      "id": "uuid-item-1",
      "code": "BSPD82C",
      "description": "Direct Aerial Place Fiber",
      "unit": "FT",
      "nextgenRate": 0.70,
      "linemanRate": 0.35,
      "truckInvestorRate": 0.05,
      "isActive": true,
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### PATCH /api/rate-cards/items/:itemId

Update a single rate item (inline edit).

**Request:**
```json
{
  "linemanRate": 0.40,
  "truckInvestorRate": 0.06
}
```

### POST /api/rate-cards/import

Upload Excel and get preview (does not commit).

**Request:** multipart/form-data
- file: Excel file
- customerId: string
- customerName: string
- region: string

**Response:**
```json
{
  "previewId": "preview-uuid",
  "fileName": "BRIGHTSPEED_AL.xlsx",
  "sheets": [
    {
      "sheetName": "Default",
      "profileName": "Default",
      "rows": [
        {
          "rowNumber": 2,
          "code": "BSPD82C",
          "description": "Direct Aerial...",
          "unit": "FT",
          "nextgenRate": 0.70,
          "linemanRate": 0.35,
          "truckInvestorRate": 0.05,
          "action": "CREATE",
          "errors": []
        }
      ]
    }
  ],
  "summary": {
    "totalRows": 18,
    "validRows": 18,
    "errorRows": 0,
    "profilesToCreate": ["Default", "Crew A"],
    "itemsToCreate": 18,
    "itemsToUpdate": 0
  },
  "errors": [],
  "warnings": [
    {
      "sheet": "Default",
      "row": 5,
      "column": "Lineman Rate",
      "message": "Value 'N/A' converted to 0"
    }
  ]
}
```

### POST /api/rate-cards/import/confirm

Commit the previewed import.

**Request:**
```json
{
  "previewId": "preview-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "groupId": "uuid-1",
  "profilesCreated": 2,
  "itemsCreated": 18,
  "itemsUpdated": 0,
  "auditLogId": "audit-uuid"
}
```

### GET /api/dashboard/metrics

Get calculated metrics for dashboard.

**Query params:**
- startDate, endDate
- customerId
- region
- linemanId
- investorId

**Response:**
```json
{
  "period": {
    "start": "2024-01-01",
    "end": "2024-01-31"
  },
  "totals": {
    "nextgenTotal": 125000.00,
    "linemanTotal": 62500.00,
    "truckInvestorTotal": 8750.00,
    "grossMargin": 53750.00,
    "grossMarginPercent": 43.0,
    "submissionsCount": 45,
    "totalFootage": 178500
  },
  "byCustomer": [
    {
      "customerName": "Brightspeed",
      "nextgenTotal": 100000.00,
      "linemanTotal": 50000.00,
      "truckInvestorTotal": 7000.00,
      "grossMargin": 43000.00
    }
  ],
  "byLineman": [
    {
      "linemanId": "uuid",
      "linemanName": "John Doe",
      "linemanTotal": 32000.00,
      "submissionsCount": 22,
      "totalFootage": 91000
    }
  ]
}
```

---

## 5. Calculation Pipeline

### Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    LINEMAN      │     │     SYSTEM      │     │   DASHBOARD     │
│                 │     │                 │     │                 │
│ Submit          │────▶│ 1. Validate     │     │                 │
│ Production      │     │    submission   │     │                 │
│                 │     │                 │     │                 │
│                 │     │ 2. Get Job      │     │                 │
│                 │     │    - groupId    │     │                 │
│                 │     │    - profileIds │     │                 │
│                 │     │                 │     │                 │
│                 │     │ 3. For each     │     │                 │
│                 │     │    line item:   │     │                 │
│                 │     │    - lookup rate│     │                 │
│                 │     │    - calculate  │     │                 │
│                 │     │                 │     │                 │
│                 │     │ 4. Store        │────▶│ Query           │
│                 │     │    calculated   │     │ calculated_     │
│                 │     │    totals       │     │ totals          │
│                 │     │                 │     │                 │
│                 │     │ 5. Update       │     │ Aggregate       │
│                 │     │    job status   │     │ by filters      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Calculation Logic (TypeScript)

```typescript
/**
 * PIPELINE DE CÁLCULO - REGRAS CRÍTICAS:
 * 1. ZERO fallback silencioso - rate não existe = ERRO
 * 2. Resultado é IMUTÁVEL após criação
 * 3. Rates são CONGELADOS no momento do cálculo
 */
async function calculateProductionTotals(
  submission: ProductionSubmission,
  job: Job
): Promise<CalculatedTotals> {

  // ========================================
  // STEP 1: Validação Explícita
  // ========================================
  if (!job.rateCardGroupId) {
    throw new CalculationError('JOB_NO_RATE_GROUP', `Job ${job.id} has no rate card group assigned`);
  }
  if (!job.nextgenRateProfileId) {
    throw new CalculationError('JOB_NO_NEXTGEN_PROFILE', `Job ${job.id} has no NextGen profile assigned`);
  }
  if (!job.linemanRateProfileId) {
    throw new CalculationError('JOB_NO_LINEMAN_PROFILE', `Job ${job.id} has no Lineman profile assigned`);
  }
  if (!job.truckInvestorRateProfileId) {
    throw new CalculationError('JOB_NO_INVESTOR_PROFILE', `Job ${job.id} has no Investor profile assigned`);
  }

  // ========================================
  // STEP 2: Buscar Rate Cards (por profile)
  // ========================================
  const nextgenRates = await getRatesByProfile(job.nextgenRateProfileId);
  const linemanRates = await getRatesByProfile(job.linemanRateProfileId);
  const investorRates = await getRatesByProfile(job.truckInvestorRateProfileId);

  // ========================================
  // STEP 3: Calcular cada Line Item
  // ========================================
  const lineItemCalculations: LineItemCalculation[] = [];
  const errors: string[] = [];

  for (const lineItem of submission.lineItems) {
    const code = lineItem.rateCode;

    // BUSCAR RATES - FALHA EXPLÍCITA SE NÃO EXISTIR
    const nextgenRate = nextgenRates.get(code);
    const linemanRate = linemanRates.get(code);
    const investorRate = investorRates.get(code);

    if (nextgenRate === undefined) {
      errors.push(`Rate code "${code}" not found in NextGen profile`);
    }
    if (linemanRate === undefined) {
      errors.push(`Rate code "${code}" not found in Lineman profile`);
    }
    if (investorRate === undefined) {
      errors.push(`Rate code "${code}" not found in Investor profile`);
    }

    // Se houver erros, não continua
    if (errors.length > 0) continue;

    lineItemCalculations.push({
      lineItemId: lineItem.id,
      rateCode: code,
      quantity: lineItem.quantity,
      unit: lineItem.unit,

      // Rates CONGELADOS (snapshot)
      nextgenRate: nextgenRate!.rate,
      linemanRate: linemanRate!.rate,
      truckInvestorRate: investorRate!.rate,

      // Amounts calculados
      nextgenAmount: lineItem.quantity * nextgenRate!.rate,
      linemanAmount: lineItem.quantity * linemanRate!.rate,
      truckInvestorAmount: lineItem.quantity * investorRate!.rate,
    });
  }

  // ========================================
  // STEP 4: Falha Explícita se erros
  // ========================================
  if (errors.length > 0) {
    throw new CalculationError('MISSING_RATES', errors.join('; '));
  }

  // ========================================
  // STEP 5: Agregar Totais
  // ========================================
  const nextgenTotal = lineItemCalculations.reduce((sum, li) => sum + li.nextgenAmount, 0);
  const linemanTotal = lineItemCalculations.reduce((sum, li) => sum + li.linemanAmount, 0);
  const truckInvestorTotal = lineItemCalculations.reduce((sum, li) => sum + li.truckInvestorAmount, 0);
  const grossMargin = nextgenTotal - linemanTotal - truckInvestorTotal;
  const grossMarginPercent = nextgenTotal > 0 ? (grossMargin / nextgenTotal) * 100 : 0;

  // ========================================
  // STEP 6: Criar Resultado IMUTÁVEL
  // ========================================
  const calculatedTotals: CalculatedTotals = {
    id: generateUUID(),
    submissionId: submission.id,
    jobId: job.id,

    // Contexto congelado (para auditoria)
    frozenContext: {
      customer: job.customer,
      region: job.region,
      rateCardGroupId: job.rateCardGroupId,
      nextgenProfileId: job.nextgenRateProfileId,
      linemanProfileId: job.linemanRateProfileId,
      investorProfileId: job.truckInvestorRateProfileId,
    },

    // Totais
    nextgenTotal,
    linemanTotal,
    truckInvestorTotal,
    grossMargin,
    grossMarginPercent,

    // Breakdown completo
    lineItemCalculations,

    // Metadata
    calculatedAt: new Date().toISOString(),
    calculatedBy: 'SYSTEM',
  };

  // ========================================
  // STEP 7: Persistir (IMUTÁVEL)
  // ========================================
  await saveCalculatedTotals(calculatedTotals);

  // ========================================
  // STEP 8: Emitir Evento
  // ========================================
  await eventBus.emit('production.calculated', {
    jobId: job.id,
    submissionId: submission.id,
    calculationId: calculatedTotals.id,
  });

  return calculatedTotals;
}

// Erro tipado para cálculos
class CalculationError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'CalculationError';
  }
}
```

### When to Calculate

1. **On Submission** (status = pending): Pre-calculate for preview
2. **On Approval** (status = approved): Final calculation, locked
3. **On Rate Change**: ⚠️ **NUNCA recalcular histórico** - apenas submissões futuras usam novas rates

---

## DASHBOARD (COMPORTAMENTO CORRETO)

### Regra de Ouro
```
Dashboard NÃO recalcula NADA.
Dashboard APENAS consulta CalculationResult.
```

### O que o Dashboard FAZ:
- ✅ Soma totais de CalculationResult
- ✅ Filtra por cliente, região, período, lineman, investor
- ✅ Apresenta métricas agregadas
- ✅ Drill-down em jobs/submissions específicos

### O que o Dashboard NÃO FAZ:
- ❌ Ler rate cards diretamente
- ❌ Recalcular valores
- ❌ Modificar CalculationResult
- ❌ Aplicar rates diferentes do que foi calculado

### Métricas Principais
| Métrica | Fonte |
|---------|-------|
| Total Faturado (NextGen) | SUM(calculation_results.nextgen_total) |
| Total a Pagar (Linemen) | SUM(calculation_results.lineman_total) |
| Total a Pagar (Investors) | SUM(calculation_results.truck_investor_total) |
| Margem Bruta ($) | SUM(calculation_results.gross_margin) |
| Margem Bruta (%) | AVG(calculation_results.gross_margin_percent) |

### Filtros Disponíveis
- Cliente
- Região
- Período (data início/fim)
- Lineman específico
- Truck Investor específico
- Job específico
- Status da submissão

### Query Pattern (Exemplo)
```sql
SELECT
  SUM(nextgen_total) as total_revenue,
  SUM(lineman_total) as total_lineman_payout,
  SUM(truck_investor_total) as total_investor_payout,
  SUM(gross_margin) as total_margin,
  COUNT(DISTINCT job_id) as jobs_count,
  COUNT(*) as submissions_count
FROM calculated_totals ct
JOIN jobs j ON ct.job_id = j.id
WHERE j.customer = 'Brightspeed'
  AND j.region = 'AL'
  AND ct.calculated_at BETWEEN '2024-01-01' AND '2024-01-31';
```

---

## 6. Implementation Plan

### MVP (Week 1-2)

**Goal:** Basic multi-column rates working with Excel import.

| Day | Task |
|-----|------|
| 1 | Create DB schema (groups, profiles, items) |
| 2 | Build RateCardService + API endpoints (CRUD) |
| 3 | Build RateCardsPage with filters + table |
| 4 | Add inline editing for rates |
| 5 | Build Excel parser (client-side with SheetJS) |
| 6 | Build ImportExcelModal with preview |
| 7 | Add profile selector + create profile |
| 8 | Connect import to API + audit log |
| 9 | Testing + bug fixes |
| 10 | Deploy MVP |

**MVP Features:**
- ✅ View rate cards with 3 rate columns
- ✅ Filter by customer/region/profile
- ✅ Import Excel with preview
- ✅ Inline edit rates
- ✅ Create/duplicate profiles
- ✅ Basic audit log

### Phase 2 (Week 3-4)

**Goal:** Production submission + calculation pipeline.

| Task |
|------|
| Add rateCardGroupId + profileIds to Job |
| Build ProductionSubmission UI for lineman |
| Build calculation pipeline |
| Store calculated_totals |
| Update Dashboard with new metrics |
| Add margin breakdown views |

**Phase 2 Features:**
- ✅ Assign rate profiles to jobs
- ✅ Lineman submits production
- ✅ Auto-calculate payouts
- ✅ Dashboard shows NextGen/Lineman/Investor totals
- ✅ Gross margin tracking

### Phase 3 (Week 5+)

**Goal:** Advanced features.

| Feature |
|---------|
| Effective dates / rate versioning |
| Approval workflow for rate changes |
| Bulk rate adjustments (% increase) |
| Export to Excel |
| Invoice generation from totals |
| Rate comparison reports |
| Historical rate lookups |

---

## 7. Key Design Decisions Summary

### A) Profile Selection at Runtime

**Decision:** Store profile IDs on the Job record.

```typescript
job.rateCardGroupId        // Which rate card group (customer+region)
job.linemanRateProfileId   // Profile for lineman payout calculation
job.truckInvestorProfileId // Profile for investor calculation
// NextGen always uses default profile (company standard revenue)
```

**Why:**
- Deterministic: Same job always calculates same way
- Auditable: Can see exactly which profiles were used
- Flexible: Different linemen/investors can have different profiles per job

### B) Excel Import Structure

**Decision:** Support both single-sheet with Profile column AND multi-sheet.

**Why:**
- Single-sheet is simpler for small rate cards
- Multi-sheet is cleaner for multiple profiles
- Auto-detect based on presence of "Profile" column

### C) Multi-Column Rates

**Decision:** Store all rates in same row, not separate tables.

```sql
rate_card_items (
  nextgen_rate,
  lineman_rate,
  truck_investor_rate
)
```

**Why:**
- Simpler queries (one row = one rate)
- Easier Excel import/export
- Future columns easy to add

### D) Auditability

**Decision:** Dedicated audit log table + JSONB for change tracking.

**Why:**
- Full history of all changes
- Who, when, what changed
- Import metadata (filename, row counts)
- Can reconstruct state at any point

---

## 8. Security Notes

- Only ADMIN and SUPERVISOR roles can access Rate Cards module
- All rate changes logged with user ID
- Import requires confirmation step (no accidental overwrites)
- Calculated totals are immutable once submission is approved
- API validates role before any write operation

---

## 9. UX ESSENCIAL (Regras de Design)

### Rate Cards UI
```
┌─────────────────────────────────────────────────────────────────┐
│  [Customer ▼]  →  [Region ▼]  →  [Profile ▼]                   │
│  Brightspeed      Alabama        Default                        │
└─────────────────────────────────────────────────────────────────┘
                          ↓
       Hierarquia clara e visual de seleção
```

### Jobs UI
- Mostrar CLARAMENTE quais perfis estão associados
- Indicador visual se perfis estão incompletos
- Não permitir submissão sem perfis definidos

### Dashboard UI
- Números GRANDES e simples
- Confiança total no dado (tooltip: "calculado em X")
- Sem spinners infinitos
- Sem estados confusos

### O que EVITAR:
- ❌ Loaders feios
- ❌ Estados confusos
- ❌ Cálculos "mágicos" sem explicação
- ❌ Fallbacks silenciosos
- ❌ Dados que "parecem" corretos mas não são

---

## 10. Estratégia de Congelamento de Rates

### Por que Congelar?
Quando uma submissão é calculada, os valores devem ser **imutáveis**.
Se rates mudarem depois, submissões antigas NÃO podem ser afetadas.

### Como Funciona

```
1. Lineman submete produção (lineItems[])

2. Sistema busca rates ATUAIS dos perfis do job

3. Sistema CONGELA no CalculationResult:
   - frozen_context: { customer, region, profileIds }
   - line_item_calculations: [
       { code, qty, rate_usado, amount_calculado }
     ]

4. Rates podem mudar depois, mas:
   - Submissões passadas = intocadas
   - Novas submissões = usam rates atuais
```

### Regra de Ouro
```
Histórico é SAGRADO.
Nunca recalcular retroativamente.
```

---

## 11. Checklist de Implementação

### MVP (Semana 1-2)
- [ ] Schema DB: groups, profiles (com type), items
- [ ] API: CRUD rate cards
- [ ] UI: Filtros cliente/região/perfil
- [ ] UI: Tabela multi-coluna editável
- [ ] Import Excel com preview
- [ ] Audit log básico

### Phase 2 (Semana 3-4)
- [ ] Atribuição de perfis no Job
- [ ] Submissão de produção (lineman)
- [ ] Pipeline de cálculo com falha explícita
- [ ] CalculationResult imutável
- [ ] Dashboard consumindo calculation_results

### Phase 3 (Semana 5+)
- [ ] Effective dates / versionamento
- [ ] Workflow de aprovação de rate changes
- [ ] Export Excel
- [ ] Geração de invoices
- [ ] Relatórios de comparação

---

## Next Steps

1. Review and approve this design
2. Create database tables in Supabase
3. Start MVP implementation

Questions?
