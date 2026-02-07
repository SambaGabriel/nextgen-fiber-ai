# Quick Reference - NextGen Fiber AI

## URLs
| Ambiente | URL |
|----------|-----|
| Local Dev | http://localhost:5174 |
| Produção | https://legendary-crumble-fdecee.netlify.app |
| GitHub | https://github.com/SambaGabriel/nextgen-fiber-ai |
| Supabase | https://supabase.com/dashboard |
| Netlify | https://app.netlify.com |

---

## Comandos Mais Usados

```bash
# Deploy rápido
./scripts/deploy.sh

# Ou manualmente
git add . && git commit -m "msg" && git push origin main

# Build local
PATH=/opt/homebrew/Cellar/node/25.5.0/bin:$PATH npm run build

# Instalar pacote
PATH=/opt/homebrew/Cellar/node/25.5.0/bin:$PATH npm install <pacote>
```

---

## Estrutura de Pastas

```
/
├── components/          # React components
├── services/            # API services
├── database/            # SQL schemas
├── docs/                # Documentação
├── scripts/             # Scripts de automação
├── types/               # TypeScript types
└── public/              # Assets estáticos
```

---

## Rate Card Codes (Brightspeed AL)

| Code | Descrição | NextGen | Lineman | Investor |
|------|-----------|---------|---------|----------|
| BSPD82C | Direct Aerial Place Fiber | $0.70 | $0.35 | $0.05 |
| BSPDSTRAND | Place Strand 6.6M | $0.70 | $0.30 | $0.05 |
| BSPDLASH | Overlash Fiber | $0.90 | $0.35 | $0.05 |
| BSPD85C | Fiber in Conduit | $0.78 | $0.36 | $0.05 |
| BSPDDBI | Directional Boring initial | $7.80 | - | - |
| BSPDDBIA | Directional Boring additional | $2.00 | - | - |
| BSPDDBIAR | Directional Boring Rock add | $15.00 | - | - |
| BSPDDBIC | Directional Boring Cobble | $13.00 | - | - |
| BSPDDBIR | Directional Boring Rock init | $58.00 | - | - |

---

## Fluxo de Trabalho

```
ADMIN cria Job
    ↓
Define Customer + Region + Map
    ↓
Sistema auto-resolve Rate Card Group
    ↓
Atribui Lineman + Profiles
    ↓
LINEMAN executa trabalho
    ↓
Submete produção (codes + qty)
    ↓
SISTEMA calcula automaticamente
    ↓
DASHBOARD mostra métricas
```

---

## Checklist de Deploy

- [ ] Código testado localmente
- [ ] Build sem erros
- [ ] Commit com mensagem clara
- [ ] Push para main
- [ ] Verificar deploy no Netlify

---

## Erros Comuns

| Erro | Solução |
|------|---------|
| npm not found | Usar PATH completo |
| Supabase 404 | Rodar SQL no Supabase |
| Build TS error | Verificar tipos |
| Netlify falha | Verificar env vars |
