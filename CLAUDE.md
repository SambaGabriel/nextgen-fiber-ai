# NextGen Fiber AI - Sistema Operacional

## Quick Reference
```
DEV:     http://localhost:5174
PROD:    https://legendary-crumble-fdecee.netlify.app
GITHUB:  https://github.com/SambaGabriel/nextgen-fiber-ai
SUPA:    https://supabase.com/dashboard
```

## Contexto do Projeto
Sistema de gestão operacional para empresa de construção de fibra óptica nos EUA.
- **Cliente principal**: Brightspeed (Alabama)
- **Usuários**: Admin, Supervisor, Lineman
- **Core**: Jobs, Rate Cards, Production, Dashboard

---

## Arquitetura Atual

### Frontend (React + Vite + TypeScript)
```
components/
├── Dashboard.tsx        # Métricas e overview
├── JobsAdmin.tsx        # Gestão de jobs (admin)
├── RateCardsV2.tsx      # Rate cards multi-coluna
├── MyJobs.tsx           # Jobs do lineman
├── JobDetails.tsx       # Detalhes + produção
└── AuthPage.tsx         # Login/registro
```

### Services
```
services/
├── supabase.ts          # Cliente Supabase + auth
├── rateCardService.ts   # CRUD rate cards
├── excelParser.ts       # Parser Excel (xlsx)
├── jobStorage.ts        # Jobs localStorage
└── claudeService.ts     # Claude AI integration
```

### Database (Supabase)
```
Tables principais:
├── profiles             # Usuários
├── jobs                 # Jobs/runs
├── job_assignments      # Atribuições de lineman
├── rate_card_groups     # Customer + Region
├── rate_card_profiles   # Profiles (NEXTGEN/LINEMAN/INVESTOR)
├── rate_card_items      # Rate items multi-coluna
├── rate_card_snapshots  # Snapshots imutáveis
├── production_submissions
├── calculated_totals    # Cálculos IMUTÁVEIS
├── job_assignment_audit # Audit de atribuições
└── rate_card_audit_log  # Auditoria
```

### Migrations
```
database/migrations/
├── 001_client_customer.sql
├── 003_settings.sql
└── 004_job_visibility_flow.sql
```

---

## Comandos Rápidos

### Development
```bash
# Servidor dev (já rodando em background)
PATH=/opt/homebrew/Cellar/node/25.5.0/bin:$PATH npm run dev

# Instalar pacote
PATH=/opt/homebrew/Cellar/node/25.5.0/bin:$PATH npm install <pacote>

# Build local
PATH=/opt/homebrew/Cellar/node/25.5.0/bin:$PATH npm run build
```

### Deploy (Automático)
```bash
# Commit + Push = Deploy automático no Netlify
git add . && git commit -m "descrição" && git push origin main
```

### Git
```bash
git status                    # Ver mudanças
git diff                      # Ver diferenças
git log --oneline -5          # Últimos commits
```

---

## Workflows Automatizados

### 1. Nova Feature
```
1. Criar/editar componente
2. Testar em localhost:5174
3. git add + commit + push
4. Netlify faz deploy automático (~2min)
```

### 2. Mudança no Banco
```
1. Criar SQL em database/migrations/*.sql
2. SEMPRE enviar o SQL COMPLETO para o usuário colar no Supabase
3. Atualizar types se necessário
4. Atualizar services
```

**REGRA**: Sempre que criar ou modificar arquivos SQL, enviar o conteúdo COMPLETO para o usuário copiar e colar no Supabase SQL Editor. Nunca resumir ou omitir partes do SQL.

### 3. Bug Fix
```
1. Identificar arquivo
2. Corrigir
3. Testar local
4. Deploy
```

---

## Padrões de Código

### Componentes React
```typescript
// Sempre usar interfaces tipadas
interface Props {
  user: User;
  lang: Language;
}

// Sempre usar useCallback para funções passadas como props
const handleAction = useCallback(async () => {
  // ...
}, [dependencies]);

// Sempre tratar erros explicitamente
try {
  await action();
} catch (error) {
  console.error('[CONTEXT] Error:', error);
  // Mostrar erro ao usuário
}
```

### Services
```typescript
// Sempre retornar tipos explícitos
export async function getData(): Promise<DataType[]> {
  // ...
}

// Sempre ter fallback para localStorage
const cached = localStorage.getItem('key');
if (cached) return JSON.parse(cached);
```

### CSS (Tailwind + CSS Variables)
```css
/* Usar variáveis do tema */
style={{
  background: 'var(--surface)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-default)'
}}
```

---

## Variáveis de Ambiente

### Netlify (Produção)
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

### Local (.env)
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_ANTHROPIC_API_KEY=...
```

---

## Rate Cards - Modelo de Dados

### Hierarquia
```
RateCardGroup (Customer + Region)
  └── RateCardProfile (Default, Crew A, Investor X)
       └── RateCardItem (Code + 3 rates)
            ├── nextgen_rate (company revenue)
            ├── lineman_rate (lineman payout)
            └── truck_investor_rate (investor payout)
```

### Cálculo de Produção
```
Job → profiles atribuídos
  └── Lineman submete produção
       └── Sistema calcula:
            ├── nextgen_total = Σ(qty × nextgen_rate)
            ├── lineman_total = Σ(qty × lineman_rate)
            ├── investor_total = Σ(qty × investor_rate)
            └── gross_margin = nextgen - lineman - investor
```

### Regras Críticas
1. **Determinismo**: Rate card NUNCA adivinhado
2. **Imutabilidade**: CalculationResult é IMUTÁVEL
3. **Falha Explícita**: Rate não existe = ERRO
4. **Histórico Sagrado**: NUNCA recalcular retroativamente

---

## Troubleshooting

### Build falha
```bash
# Limpar cache
rm -rf node_modules/.vite
PATH=/opt/homebrew/Cellar/node/25.5.0/bin:$PATH npm run build
```

### Supabase erro 404/400
- Tabela não existe → Rodar SQL no Supabase
- RLS bloqueando → Verificar policies

### Netlify não atualiza
- Verificar se push foi feito: `git log --oneline -1`
- Ver status no Netlify dashboard

### npm não encontrado
```bash
# Usar PATH completo
PATH=/opt/homebrew/Cellar/node/25.5.0/bin:$PATH npm <comando>
```

---

## Próximos Passos (Roadmap)

### MVP Atual ✅
- [x] Rate Cards multi-coluna
- [x] Import Excel
- [x] Profiles (NEXTGEN/LINEMAN/INVESTOR)
- [x] Edição inline
- [x] Deploy automático

### Phase 2 (Em andamento)
- [ ] Atribuição de profiles no Job
- [ ] Submissão de produção pelo lineman
- [ ] Pipeline de cálculo
- [ ] Dashboard com métricas financeiras

### Phase 3 (Futuro)
- [ ] Effective dates / versionamento
- [ ] Aprovação de rate changes
- [ ] Geração de invoices
- [ ] Relatórios avançados

---

## Contatos & Links

- **Repo**: https://github.com/SambaGabriel/nextgen-fiber-ai
- **Prod**: https://legendary-crumble-fdecee.netlify.app
- **Supabase**: Dashboard do projeto
- **Netlify**: Dashboard do site
