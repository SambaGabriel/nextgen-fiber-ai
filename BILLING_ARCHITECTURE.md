# NextGen Fiber - Billing System Architecture

## 1. ARQUITETURA DE PÁGINAS E COMPONENTES

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BILLING APPLICATION                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │  SIDEBAR    │  │   HEADER    │  │  MAIN VIEW  │  │ SIDE PANEL  │       │
│  │             │  │             │  │             │  │ (contextual)│       │
│  │ - Nav Items │  │ - Breadcrumb│  │ - Content   │  │ - Details   │       │
│  │ - Metrics   │  │ - Actions   │  │ - Tables    │  │ - Evidence  │       │
│  │ - Filters   │  │ - User      │  │ - Forms     │  │ - History   │       │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

ROTAS E PÁGINAS:
================

/billing
├── /inbox                    # Production Inbox (Tela 1)
│   └── ?filters=...          # Query params for filters
├── /review/:lineId           # Line Detail Review (Tela 2 - pode ser modal/panel)
├── /rate-cards               # Rate Card Manager (Tela 3)
│   ├── /new
│   └── /:cardId/versions
├── /batches                  # Invoice Batches List
│   ├── /new                  # Invoice Batch Builder (Tela 4)
│   └── /:batchId
│       ├── /edit
│       └── /package
├── /tracker                  # AR Tracker (Tela 5)
│   └── /:invoiceId
├── /reports                  # Reports & Analytics
│   ├── /aging
│   ├── /rejections
│   └── /forecast
└── /settings
    ├── /users
    ├── /permissions
    └── /audit-log


COMPONENTES CORE:
=================

┌─────────────────────────────────────────────────────────────────┐
│                    SHARED COMPONENTS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  DataTable<T>           - Tabela universal com sort/filter/page │
│  ├── ColumnDefinition   - Config de colunas                     │
│  ├── FilterBar          - Filtros dinâmicos                     │
│  ├── BulkActions        - Ações em lote                         │
│  └── RowExpander        - Detalhes inline                       │
│                                                                 │
│  SidePanel              - Panel deslizante lateral              │
│  ├── PanelHeader        - Título + ações                        │
│  ├── PanelContent       - Conteúdo scrollável                   │
│  └── PanelFooter        - Ações fixas                           │
│                                                                 │
│  EvidenceViewer         - Galeria de fotos/docs                 │
│  ├── ImageCarousel      - Carrossel de imagens                  │
│  ├── GeotagDisplay      - Mapa com localização                  │
│  └── MetadataPanel      - Metadados do arquivo                  │
│                                                                 │
│  StatusBadge            - Badge de status com cor               │
│  ComplianceScore        - Score visual (gauge/bar)              │
│  AuditTrail             - Timeline de mudanças                  │
│  AmountDisplay          - Formatação monetária                  │
│  ReasonModal            - Modal para justificativa              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    DOMAIN COMPONENTS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ProductionInbox/                                               │
│  ├── InboxFilters       - Filtros específicos de produção       │
│  ├── ProductionTable    - Tabela de linhas de produção          │
│  ├── LineQuickView      - Preview rápido de linha               │
│  └── BulkBatchCreator   - Criador de batch em lote              │
│                                                                 │
│  LineReview/                                                    │
│  ├── LineHeader         - Info principal da linha               │
│  ├── ProductionData     - Dados originais                       │
│  ├── BillingMapping     - Mapeamento para faturamento           │
│  ├── RateSelector       - Seletor de rate card                  │
│  ├── ValidationList     - Lista de validações                   │
│  └── ActionButtons      - Aprovar/Rejeitar/Rework               │
│                                                                 │
│  RateCardManager/                                               │
│  ├── RateCardList       - Lista de rate cards                   │
│  ├── RateCardEditor     - Editor de rate card                   │
│  ├── MappingRules       - Regras de mapeamento                  │
│  └── VersionHistory     - Histórico de versões                  │
│                                                                 │
│  BatchBuilder/                                                  │
│  ├── BatchHeader        - Info do batch (cliente, período)      │
│  ├── LineItemsTable     - Itens agrupados                       │
│  ├── PackageChecklist   - Checklist de completude               │
│  ├── AttachmentsManager - Gerenciador de anexos                 │
│  └── TotalsCalculator   - Calculadora de totais                 │
│                                                                 │
│  ARTracker/                                                     │
│  ├── PipelineBoard      - Kanban de status                      │
│  ├── AgingChart         - Gráfico de aging                      │
│  ├── InvoiceTimeline    - Timeline do invoice                   │
│  └── PaymentRecorder    - Registro de pagamento                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘


FLUXO DE ESTADO (State Flow):
=============================

┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  SMARTSHEET  │───▶│  PRODUCTION  │───▶│   INVOICE    │
│   (source)   │    │    INBOX     │    │    BATCH     │
└──────────────┘    └──────────────┘    └──────────────┘
                           │                    │
                           ▼                    ▼
                    ┌──────────────┐    ┌──────────────┐
                    │    LINE      │    │   PACKAGE    │
                    │   REVIEW     │    │  GENERATION  │
                    └──────────────┘    └──────────────┘
                                               │
                                               ▼
                                        ┌──────────────┐
                                        │  SUBMISSION  │
                                        │   TRACKER    │
                                        └──────────────┘

Estados de ProductionLine:
- NEW → PENDING_REVIEW → REVIEWED → READY_TO_INVOICE → INVOICED → PAID
- Podem ir para: NEEDS_INFO, REJECTED, ON_HOLD

Estados de InvoiceBatch:
- DRAFT → READY → SUBMITTED → APPROVED → PARTIALLY_APPROVED → REJECTED → PAID
- Podem ir para: CANCELLED, DISPUTED


DECISÕES TÉCNICAS:
==================

1. Estado Global vs Local:
   - Usar React Query para server state (cache, sync, invalidation)
   - Zustand para UI state (filters, selections, panels)
   - Evitar Redux - overhead desnecessário para este caso

2. Tabelas:
   - TanStack Table (react-table v8) para controle total
   - Virtualização para >1000 linhas
   - Server-side pagination/sort por padrão

3. Side Panels vs Modais:
   - Panels para review detalhado (mantém contexto)
   - Modais apenas para ações destrutivas ou confirmações

4. Audit Trail:
   - Cada mutação envia evento de auditoria junto
   - Otimistic updates com rollback em caso de falha

5. Permissões:
   - RBAC no front (hide/disable)
   - Sempre validado no backend (nunca confiar no front)

6. Offline/Resilience:
   - Queue local para ações quando offline
   - Sync quando reconectar
   - Indicador visual de status de conexão
