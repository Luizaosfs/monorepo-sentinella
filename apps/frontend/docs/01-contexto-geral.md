# Contexto Geral do Sentinela

## O que é
Sentinela é uma plataforma voltada para prefeituras para monitoramento e priorização de riscos relacionados à dengue.

## Objetivo do sistema
Organizar planejamento de inspeções, registrar levantamentos, identificar problemas de campo e priorizar ações com base em risco e SLA.

## Modos de operação
1. Drone
2. Manual

## Fluxo drone
- planejamento é criado
- voo é realizado
- imagens são capturadas
- EXIF é extraído
- IA/classificação identifica possíveis problemas
- evidências são armazenadas
- levantamento_itens são gerados
- itens seguem para priorização e tratamento

## Fluxo manual
- operador usa planejamento ativo
- cria ou reutiliza levantamento
- registra levantamento_item manualmente
- sistema aplica risco, ação, score e SLA

## Público-alvo
- administração municipal
- supervisores
- operadores de campo
- gestores de vigilância

## Stack resumida
- Python no módulo operacional de drone
- Supabase/PostgreSQL no backend de dados
- Cloudinary para imagens/evidências
- interface SaaS para prefeituras