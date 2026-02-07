#!/bin/bash
# Deploy automático para Netlify via GitHub

set -e

echo "🚀 NextGen Fiber AI - Deploy"
echo "=============================="

# Verificar se há mudanças
if [[ -z $(git status --porcelain) ]]; then
    echo "✅ Nenhuma mudança para deploy"
    exit 0
fi

# Mostrar mudanças
echo ""
echo "📝 Arquivos modificados:"
git status --short

# Pedir mensagem de commit
echo ""
read -p "💬 Mensagem do commit: " message

if [[ -z "$message" ]]; then
    message="Update $(date +%Y-%m-%d_%H:%M)"
fi

# Build para verificar erros
echo ""
echo "🔨 Verificando build..."
PATH=/opt/homebrew/Cellar/node/25.5.0/bin:$PATH npm run build

# Commit e Push
echo ""
echo "📤 Fazendo deploy..."
git add .
git commit -m "$message

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
git push origin main

echo ""
echo "✅ Deploy iniciado!"
echo "🌐 https://legendary-crumble-fdecee.netlify.app"
echo "⏱️  Aguarde ~2 minutos para o Netlify processar"
