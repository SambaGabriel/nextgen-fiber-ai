# NextGen Fiber - Billing System Technical Decisions

## 1. DECISÕES ARQUITETURAIS

### 1.1 Estado da Aplicação

**Decisão:** React Query + Zustand (não Redux)

**Razão:**
- React Query já gerencia estado de servidor (cache, sync, invalidation)
- Redux adiciona boilerplate sem benefício real para este caso
- Zustand é mais simples para estado de UI (filtros, seleções, panels)

**Trade-off:**
- Menos "padronizado" que Redux
- Time precisa conhecer duas bibliotecas

### 1.2 Tabelas

**Decisão:** TanStack Table v8 com virtualização

**Razão:**
- Controle total sobre renderização
- Virtualização nativa para milhares de linhas
- Server-side pagination por padrão

**Trade-off:**
- Mais setup inicial que DataGrid pronto
- Precisa implementar sorting/filtering manualmente

### 1.3 Panels vs Modais

**Decisão:** Side panels para review, modais apenas para confirmações

**Razão:**
- Panels mantêm contexto da tabela visível
- Fluxo mais natural para review sequencial
- Modais bloqueiam a visão - ruins para workflow intensivo

**Trade-off:**
- Mais espaço de tela consumido
- Complexidade de z-index

### 1.4 Audit Trail

**Decisão:** Cada mutação envia evento de auditoria junto com a request

**Razão:**
- Garante que nenhuma mudança escape do log
- Backend pode validar que audit event foi incluído
- Transacional (falhou a mudança? não loga)

**Trade-off:**
- Payload maior em cada request
- Frontend precisa construir audit event

### 1.5 Permissões

**Decisão:** RBAC no front (hide/disable) + validação obrigatória no backend

**Razão:**
- Front-end não pode ser confiável para segurança
- Hide/disable melhora UX
- Backend é autoridade final

**Trade-off:**
- Duplicação de lógica de permissão
- Manter sincronizado

---

## 2. DECISÕES DE NEGÓCIO

### 2.1 Workflow de Status

**Decisão:** Status progression linear com escape hatches

```
NEW → PENDING_REVIEW → REVIEWED → READY_TO_INVOICE → INVOICED → PAID
          ↓                ↓              ↓
     NEEDS_INFO      REJECTED        ON_HOLD
```

**Razão:**
- Progresso claro e auditável
- Estados especiais para exceções
- Não permite pular etapas sem justificativa

### 2.2 Rate Card Versioning

**Decisão:** Versão congelada no momento do submit

**Razão:**
- Evita disputas de "qual era a rate?"
- Invoice é self-contained
- Permite auditoria retroativa

**Trade-off:**
- Mais storage (snapshot de rates por invoice)
- Não pode "corrigir" rate retroativamente

### 2.3 Validação de Linhas

**Decisão:** Validação automática + bloqueio de submit se ERROR

**Razão:**
- Previne kickbacks antes que aconteçam
- Separa ERROR (bloqueante) de WARNING (alerta)
- Humano decide em warnings

**Trade-off:**
- Pode frustrar usuário se muito restritivo
- Regras precisam ser bem calibradas

### 2.4 Override de Rate

**Decisão:** Apenas BILLING/ADMIN pode override, sempre com reason

**Razão:**
- Rastreabilidade total
- Evita "desconto não autorizado"
- Facilita auditoria

**Trade-off:**
- Workflow mais lento para exceções legítimas
- Depende de billing estar disponível

---

## 3. TRADE-OFFS ACEITOS

### 3.1 Complexidade vs Velocidade

**Aceitamos:** Sistema mais complexo em troca de menos kickbacks

**Razão:**
- Cada kickback custa tempo e dinheiro
- Validação upfront economiza mais do que workflow extra
- Compliance score justifica investimento

### 3.2 Flexibilidade vs Controle

**Aceitamos:** Menos flexibilidade para field em troca de controle

**Razão:**
- Field não deveria mudar rates
- Erros de field são corrigíveis por reviewer
- Controle é mais importante que conveniência

### 3.3 Performance vs Completude

**Aceitamos:** Mais dados por request em troca de menos round-trips

**Razão:**
- Operadores trabalham com muitas linhas
- Melhor trazer tudo de uma vez
- Cache agressivo no front

### 3.4 Simplicidade vs Features

**Aceitamos:** MVP sem todas as features em troca de entrega rápida

**Fase 1 inclui:**
- Production Inbox ✓
- Line Review ✓
- Batch Builder ✓
- AR Tracker básico ✓

**Fase 2 adiciona:**
- Rate Card versioning completo
- Compliance score avançado
- Relatórios de aging

**Fase 3 adiciona:**
- Previsão de recebíveis
- Detecção de anomalias
- Captura nativa (substituir Smartsheet)

---

## 4. RISCOS IDENTIFICADOS

### 4.1 Smartsheet como Fonte

**Risco:** Dependência de sync externo

**Mitigação:**
- Polling frequente (5 min)
- Indicador visual de última sync
- Plano para captura nativa na Fase 3

### 4.2 Volume de Dados

**Risco:** Performance com milhares de linhas

**Mitigação:**
- Server-side pagination
- Virtualização de tabela
- Índices no banco

### 4.3 Adoção por Usuários

**Risco:** Resistência a novo sistema

**Mitigação:**
- UI familiar (tabela + filtros)
- Treinamento com billing team
- Feedback loop rápido

### 4.4 Integração de Evidências

**Risco:** Fotos em storage externo com links quebrados

**Mitigação:**
- URLs assinadas com expiração longa
- Verificação periódica de links
- Cópia local se necessário

---

## 5. MÉTRICAS DE SUCESSO

### 5.1 Operacionais

| Métrica | Baseline | Target |
|---------|----------|--------|
| Tempo médio para criar invoice | 4 horas | 30 min |
| Taxa de kickback | 15% | <5% |
| Linhas processadas/dia | 50 | 200 |
| Tempo médio para resolver kickback | 3 dias | 1 dia |

### 5.2 Técnicas

| Métrica | Target |
|---------|--------|
| Tempo de load inicial | <2s |
| Tempo de filtro | <500ms |
| Disponibilidade | 99.5% |
| Audit coverage | 100% |

### 5.3 Negócio

| Métrica | Target |
|---------|--------|
| DSO (Days Sales Outstanding) | Reduzir 10% |
| Aging >60 dias | <10% do AR |
| Disputas/mês | Reduzir 50% |

---

## 6. PRÓXIMOS PASSOS

### Semana 1-2: Foundation
- [ ] Setup do projeto (Next.js, TanStack Table, React Query)
- [ ] Componentes base (DataTable, SidePanel, StatusBadge)
- [ ] Mock API com dados realistas
- [ ] Production Inbox funcional

### Semana 3-4: Core Workflow
- [ ] Line Review Panel completo
- [ ] Batch Builder com cálculos
- [ ] Submit flow básico
- [ ] AR Tracker inicial

### Semana 5-6: Polish & Integration
- [ ] Integração com Smartsheet real
- [ ] Rate Card Manager
- [ ] Validações automáticas
- [ ] Testes E2E

### Semana 7-8: Deploy & Iterate
- [ ] Deploy em staging
- [ ] Treinamento com usuários
- [ ] Feedback loop
- [ ] Ajustes baseados em uso real

---

## 7. DEPENDÊNCIAS EXTERNAS

| Serviço | Propósito | Fallback |
|---------|-----------|----------|
| Smartsheet API | Fonte de produção | CSV import manual |
| S3/GCS | Storage de evidências | Local upload |
| Auth provider | Autenticação | Session básica |
| PDF generator | Package export | HTML export |

---

## 8. GLOSSÁRIO

| Termo | Definição |
|-------|-----------|
| Production Line | Linha de trabalho realizado em campo |
| Prime Contractor | Cliente final (Spectrum, BrightSpeed, etc) |
| Rate Card | Tabela de preços por tipo de serviço |
| Invoice Batch | Agrupamento de linhas para faturamento |
| Kickback | Rejeição de invoice pelo cliente |
| Retainage | Valor retido até conclusão do projeto |
| Compliance Score | Índice de completude e qualidade da linha |
| AR (Accounts Receivable) | Contas a receber |
| DSO | Days Sales Outstanding - tempo médio para receber |
