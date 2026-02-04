# NextGen Fiber Mobile - Arquitetura e Decisões Técnicas

## Visão Geral

Aplicativo React Native para linemen de campo gerenciarem jobs de fibra óptica, com suporte completo offline-first.

## Estrutura de Diretórios

```
mobile/src/
├── api/            # Contratos de API REST
├── components/     # Componentes UI reutilizáveis
├── hooks/          # Custom hooks React
├── navigation/     # Navegação (React Navigation)
├── screens/        # Telas principais
├── services/       # Serviços (offline queue, telemetria)
└── types/          # Definições TypeScript
```

## Decisões-Chave

### 1. Offline-First com Fila de Retry

**Decisão:** Todas as ações de escrita (enviar produção, comentários, iniciar job) passam por uma fila local que persiste em AsyncStorage.

**Justificativa:**
- Linemen trabalham frequentemente em áreas rurais sem sinal
- Perda de dados em campo é inaceitável para produção
- Retry automático com backoff exponencial (1s, 5s, 15s, 1m, 5m)
- UUID como chave de idempotência previne duplicatas

**Trade-offs:**
- (+) 100% resiliente a quedas de conexão
- (+) UX fluida - nunca bloqueia o usuário
- (-) Complexidade na sincronização de estados
- (-) Possíveis conflitos se servidor rejeitar dados antigos

### 2. Formulário de Produção Dinâmico

**Decisão:** O schema do formulário vem do servidor via `FormSchema`, permitindo que o escritório configure campos sem deploy.

**Justificativa:**
- Diferentes clientes (Brightspeed, Spectrum) têm requisitos diferentes
- Novos campos podem ser adicionados sem atualização do app
- Validação client-side baseada no schema

**Trade-offs:**
- (+) Flexibilidade total para o escritório
- (+) Sem necessidade de releases para mudar formulários
- (-) Mais complexo que forms hard-coded
- (-) Depende da qualidade do schema do backend

### 3. Cache com TTL de 5 Minutos

**Decisão:** Dados de jobs são cacheados localmente com TTL de 5 minutos. Dados stale são mostrados imediatamente enquanto busca novos.

**Justificativa:**
- Startup rápido mesmo com conexão lenta
- Lineman pode ver seus jobs mesmo offline
- Pull-to-refresh força atualização

**Trade-offs:**
- (+) App parece muito mais rápido
- (+) Funciona 100% offline (com dados cacheados)
- (-) Dados podem estar 5 min desatualizados
- (-) Mais memória e storage usados

### 4. Tabs na Tela de Detalhe

**Decisão:** Info/Mapa, Produção, e Chat são tabs separadas na mesma tela em vez de múltiplas telas.

**Justificativa:**
- Reduz navegação - tudo em um lugar
- Mantém contexto do job sempre visível
- Badge no tab de Chat mostra mensagens não lidas

**Trade-offs:**
- (+) UX mais fluida e contextual
- (+) Menos taps para acessar funcionalidades
- (-) Tela mais complexa de implementar
- (-) Pode ser lenta em devices antigos se não otimizada

### 5. AsyncStorage vs SQLite

**Decisão:** Usar AsyncStorage para queue e cache, não SQLite.

**Justificativa:**
- Volume de dados é pequeno (< 1000 jobs por lineman)
- AsyncStorage é nativo do React Native
- Simplicidade > performance para este caso

**Trade-offs:**
- (+) Setup zero, sem dependencies nativas
- (+) Serialização JSON é suficiente
- (-) Não suporta queries complexas
- (-) Pode ser lento com > 10MB de dados

### 6. Telemetria em Batch

**Decisão:** Eventos de telemetria são acumulados localmente e enviados em batch a cada 1 minuto ou quando há 50 eventos.

**Justificativa:**
- Reduz número de requests de rede
- Não impacta UX do app
- Persiste eventos se app fechar

**Trade-offs:**
- (+) Eficiente em bateria e dados
- (+) Não perde eventos
- (-) Delay de até 1 min nos dashboards
- (-) Debugging em tempo real mais difícil

## Fluxo UX

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Jobs List   │ ──▶ │ Job Detail  │ ──▶ │ Enviar      │
│ (filtros)   │     │ (tabs)      │     │ Produção    │
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                    │
      │                   │                    ▼
      │                   │           ┌─────────────┐
      │                   │           │ Fila        │
      │                   │           │ Offline     │
      │                   │           └─────────────┘
      │                   │                    │
      │                   ▼                    │
      │            ┌─────────────┐             │
      │            │ Chat/       │◀────────────┘
      │            │ Comentários │
      │            └─────────────┘
      │
      ▼
┌─────────────┐
│ Pull to     │
│ Refresh     │
└─────────────┘
```

## Status dos Jobs

```
AVAILABLE ──▶ IN_PROGRESS ──▶ SUBMITTED ──▶ APPROVED ──▶ CLOSED
                   │              │
                   │              ▼
                   │         NEEDS_INFO
                   │              │
                   └──────────────┘
```

## Dependências Externas

- `@react-native-async-storage/async-storage` - Persistência local
- `@react-native-community/netinfo` - Detecção de conectividade
- `@react-navigation/native` - Navegação
- `@openspacelabs/react-native-zoomable-view` - Zoom no mapa
- `@react-native-community/datetimepicker` - Seleção de data
- `@react-native-picker/picker` - Dropdowns

## Próximos Passos

1. [ ] Implementar upload de fotos no formulário
2. [ ] Adicionar push notifications para novos comentários
3. [ ] Implementar download de mapas para offline
4. [ ] Adicionar biometria para autenticação
5. [ ] Implementar modo dark
