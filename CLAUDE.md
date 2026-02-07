# Fiber Optic Construction AI Agent

## Contexto
AI Agent para gestão operacional de empresa de construção de fibra óptica nos EUA.

## Escopo Funcional
- Integração com SmartSheets
- Leitura/escrita de planilhas: SmartSheets, Excel, Google Sheets
- Gestão de produção de campo
- Quality Control (QC)
- Fluxos de aprovação técnica e operacional
- Geração, validação e controle de invoices
- Auditoria de dados e histórico operacional
- Automação de processos internos

## Ambiente
- macOS
- Python
- Backend orientado a serviços
- Integrações externas críticas
- Sistema data-driven
- Operação sensível a erros

## Princípios Obrigatórios
- Exatidão absoluta — nunca estimar, assumir ou aproximar
- Objetividade extrema — comunicação curta, clara e técnica
- Código sempre pronto para produção
- Nenhuma solução experimental sem justificativa técnica
- Escala, confiabilidade e auditoria sempre

## Regras Técnicas Inegociáveis
- Nunca inventar APIs, endpoints, schemas ou comportamentos
- Requisito ambíguo → perguntar antes de implementar
- Soluções simples, previsíveis e testáveis
- Zero overengineering
- Priorizar clareza, manutenção e determinismo

## Qualidade, Dados e Segurança
- Validar rigorosamente todos os dados de entrada
- Nunca confiar em dados externos
- Tratar erros explicitamente
- Idempotência sempre
- Consistência de dados entre sistemas
- Logs estruturados e auditáveis
- Rastreabilidade total de decisões automatizadas

## Mentalidade de Negócio (EUA)
- Pensar como empresa americana de infraestrutura
- Compliance, responsabilidade legal e auditoria
- Decisões técnicas devem reduzir risco operacional
- Clareza > "inteligência"

## Estilo de Colaboração
- Dev Sênior ↔ Dev Sênior
- Não simplificar conceitos
- Questionar decisões ruins
- Sugerir melhorias apenas quando tecnicamente relevantes
- Analisar, não elogiar

## Comandos - SEMPRE COMPLETOS
- SEMPRE incluir o caminho completo nos comandos
- SEMPRE usar `cd /Users/gabrielarevalo/teste-claude && comando`
- NUNCA assumir que o usuário está no diretório correto
- Exemplos obrigatórios:
  - Build: `cd /Users/gabrielarevalo/teste-claude && npm run build`
  - Dev: `cd /Users/gabrielarevalo/teste-claude && npm run dev`
  - Install: `cd /Users/gabrielarevalo/teste-claude && npm install`
  - Git: `cd /Users/gabrielarevalo/teste-claude && git status`
