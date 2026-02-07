# Refactor: Client vs Customer vs Region

## O Problema Atual

O sistema mistura "Client" e "Customer":
- Rate Cards usam "customer_name" quando deveria ser a combinação Client + Customer
- Jobs mostram apenas "Client" sem distinguir quem é o Customer final

## Definições Corretas

| Termo | Significado | Exemplo |
|-------|-------------|---------|
| **Client** | Prime / Quem nos paga | MasTec, Henkels |
| **Customer** | Operadora final / Projeto | Brightspeed, All Points Broadband |
| **Region** | Estado / Mercado | AL, GA, NC |

## Nova Hierarquia

```
Client (MasTec)
  └── Customer (Brightspeed)
       └── Region (AL)
            └── Rate Card Group
                 └── Rate Card Items
```

## Identificação de Rate Card

```
Rate Card = f(clientId, customerId, regionId)
```

Exemplo:
- MasTec + Brightspeed + AL = Rate Card #1
- MasTec + All Points Broadband + GA = Rate Card #2
- Henkels + Brightspeed + NC = Rate Card #3

---

## Modelo de Dados

### Novas Tabelas

```sql
-- Clients (Prime contractors)
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers (End operators)
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Alterações em Tabelas Existentes

```sql
-- Rate Card Groups: adicionar client_id
ALTER TABLE rate_card_groups
  ADD COLUMN client_id UUID REFERENCES clients(id),
  ADD COLUMN customer_id UUID REFERENCES customers(id);

-- Jobs: adicionar customer_id (já tem client_name, adicionar referências)
ALTER TABLE jobs
  ADD COLUMN client_id UUID REFERENCES clients(id),
  ADD COLUMN customer_id UUID REFERENCES customers(id);
```

### Migração de Dados

```sql
-- 1. Criar clients default
INSERT INTO clients (name, code) VALUES
  ('MasTec', 'MASTEC'),
  ('Henkels', 'HENKELS'),
  ('Direct', 'DIRECT');

-- 2. Criar customers conhecidos
INSERT INTO customers (name, code) VALUES
  ('Brightspeed', 'BSPD'),
  ('All Points Broadband', 'APB'),
  ('AT&T', 'ATT'),
  ('Spectrum', 'SPEC');

-- 3. Backfill rate_card_groups
-- Mapear customer_name atual para customer_id
UPDATE rate_card_groups rcg
SET customer_id = c.id
FROM customers c
WHERE rcg.customer_name = c.name;

-- 4. Backfill jobs
-- client_name -> client_id
UPDATE jobs j
SET client_id = c.id
FROM clients c
WHERE j.client_name = c.name;
```

---

## UI Changes

### Rate Cards Page

**Antes:**
```
[Customer ▼] [Region ▼]
Brightspeed - AL
```

**Depois:**
```
[Client ▼] [Customer ▼] [Region ▼]
MasTec → Brightspeed → AL
```

Header mostra contexto completo:
```
Rate Cards — MasTec / Brightspeed / AL
```

### Jobs Management Page

**Tabela - Novas Colunas:**
| Client | Customer | Location | Type | Assigned | Status |
|--------|----------|----------|------|----------|--------|
| MasTec | Brightspeed | Montgomery, AL | Aerial | John Doe | Active |

**Filtros:**
```
[Client ▼] [Customer ▼] [Region ▼] [Status ▼] [Search...]
```

**Create/Edit Job:**
- Client (obrigatório)
- Customer (obrigatório)
- Region/State (obrigatório)

---

## API Contracts

### GET /api/clients
```json
{
  "clients": [
    { "id": "uuid-1", "name": "MasTec", "code": "MASTEC" },
    { "id": "uuid-2", "name": "Henkels", "code": "HENKELS" }
  ]
}
```

### GET /api/customers
```json
{
  "customers": [
    { "id": "uuid-1", "name": "Brightspeed", "code": "BSPD" },
    { "id": "uuid-2", "name": "All Points Broadband", "code": "APB" }
  ]
}
```

### GET /api/rate-card-groups?clientId=X&customerId=Y&regionId=Z
```json
{
  "group": {
    "id": "uuid-group",
    "clientId": "uuid-1",
    "clientName": "MasTec",
    "customerId": "uuid-2",
    "customerName": "Brightspeed",
    "region": "AL",
    "profileCount": 3,
    "itemCount": 27
  }
}
```

### POST /api/jobs
```json
{
  "title": "BSPD001.04h",
  "clientId": "uuid-client",
  "customerId": "uuid-customer",
  "region": "AL",
  "locationCity": "Montgomery",
  "workType": "aerial",
  "assignedToId": "uuid-lineman"
}
```

---

## Arquivos Alterados

### Database
- [x] `database/migrations/001_client_customer.sql` - migration criada

### Services
- [x] `services/rateCardService.ts` - adicionado client_id, getGroupsFiltered(), resolveRateCardGroup()
- [x] `services/clientService.ts` - NOVO (CRUD para PrimeClient)
- [x] `services/customerService.ts` - NOVO (CRUD para EndCustomer)

### Components
- [x] `components/RateCardsV2.tsx` - adicionado filtro Client → Customer → Region

### Types
- [x] `types/project.ts` - adicionado PrimeClient, EndCustomer interfaces

### Pendente
- [ ] `components/JobsAdmin.tsx` - adicionar coluna/filtro Customer

---

## Checklist de Testes

### Rate Cards
- [ ] **Rodar migration SQL no Supabase** (database/migrations/001_client_customer.sql)
- [ ] Verificar clients criados (MasTec, Henkels, Direct)
- [ ] Verificar customers criados (Brightspeed, APB, AT&T, etc.)
- [ ] Criar Rate Card Group para MasTec + Brightspeed + AL
- [ ] Importar Excel com rates
- [ ] Verificar filtros funcionando

### Jobs
- [ ] Criar Job com Client + Customer + Region
- [ ] Verificar tabela mostra ambas colunas
- [ ] Filtrar por Client
- [ ] Filtrar por Customer

### Integração
- [ ] Job aponta para Rate Card correto
- [ ] Erro explícito se Rate Card não existir

---

## Rollout Strategy

### Phase 1: Schema + Migration ✅ PRONTO
1. ✅ Criar tables clients/customers
2. ✅ Adicionar colunas client_id/customer_id
3. ✅ Backfill dados existentes
4. ⏳ **Rodar migration no Supabase**

### Phase 2: UI Updates ✅ PARCIALMENTE PRONTO
1. ✅ Atualizar Rate Cards com filtro Client
2. ⏳ Atualizar Jobs com coluna Customer
3. ⏳ Atualizar Create/Edit forms
4. ⏳ Deploy

### Phase 3: Validation
1. Forçar client_id/customer_id obrigatórios
2. Bloquear jobs sem customer
3. Bloquear cálculos sem rate card match
