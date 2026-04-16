# Resumo Executivo — Análise do Sentinella Web

**Data da análise:** 2026-03-26
**Escopo:** Frontend, Backend, Banco de Dados, RLS, Regras de Negócio, Fluxos Operacionais, Segurança, Dívida Técnica

---

## Visão geral do estado atual

O Sentinella Web é uma plataforma SaaS **funcionalmente completa e operacionalmente madura** para seu estágio de desenvolvimento. O sistema cobre o ciclo completo de vigilância epidemiológica de dengue: planejamento → identificação (drone/manual) → priorização → atendimento → auditoria.

**O que foi construído é sólido nos fundamentos:**
- Multitenancy correto com RLS em todas as tabelas
- SLA inteligente com triggers automáticos e redutores climáticos
- Rastreabilidade completa de ponta a ponta
- Modo offline real com fila IndexedDB
- Pipeline de IA (YOLO + Claude Haiku) integrado
- 35+ migrations bem estruturadas
- 40+ regras de negócio catalogadas

**O sistema está em uso real e funcionando.** O que se identifica não é um produto quebrado, mas os sinais naturais de um produto que cresceu rapidamente e agora precisa de consolidação antes de escalar.

---

## Principais pontos fortes

1. **Arquitetura de segurança em profundidade** — RLS + filtros na api.ts + sem credenciais no frontend
2. **Triggers de banco como guardiões de invariantes** — SLA, recorrência, cruzamentos não dependem do frontend
3. **Cache React Query granular e inteligente** — estratégia STALE diferenciada por tipo de dado
4. **Offline-first real** — agentes operam sem rede com fila de operações pendentes
5. **Separação clara de serviço** — api.ts como único ponto de acesso ao Supabase
6. **Documentação de regras** — 40+ regras catalogadas em `business-rules.md`
7. **Integração epidemiológica** — casos, CNES, e-SUS, canal cidadão formam ecossistema completo

---

## Principais falhas identificadas

### 1. Bug de dados — payload JSONB sobrescrito (URGENTE)
No trigger de cruzamento caso↔foco, múltiplos casos próximos ao mesmo foco sobrescrevem o `payload`, preservando apenas o último `caso_id`. **Em situações de surto (múltiplos casos em área), isso perde dados.**

### 2. Credenciais do pipeline Python não auditadas (URGENTE)
Não está documentado se o pipeline externo usa `service_role` key. Se usar, bypassa completamente o RLS e tem acesso irrestrito a dados de todas as prefeituras.

### 3. api.ts com 2.831 linhas (ALTO)
Arquivo único crescendo sem divisão por domínio. Conflitos de merge, dificuldade de onboarding e risco de duplicações.

### 4. Regras de negócio duplicadas entre frontend e banco (ALTO)
Cálculo de SLA implementado em `sla.ts` (TypeScript) e em `sla_aplicar_fatores()` (PL/pgSQL). Mudança em um não replica no outro.

### 5. Ausência de testes automatizados (ALTO)
Sem suíte de testes cobrindo triggers críticos, multitenancy, SLA e fluxos de campo. Cada deploy é um risco de regressão.

---

## Principais riscos

| Risco | Severidade | Probabilidade |
|-------|-----------|--------------|
| Pipeline Python com service_role key | CRÍTICO | Média |
| Sem testes para triggers críticos | CRÍTICO | Certa |
| Payload JSONB sobrescrito em surtos | ALTO | Alta |
| Sem proteção de rota por papel | ALTO | Baixa |
| Haversine sem PostGIS (escala) | MÉDIO | Alta (longo prazo) |
| Web Push sem suporte iOS | MÉDIO | Alta |

---

## Quick wins (implementáveis em < 1 semana)

| Ação | Impacto | Esforço |
|------|---------|---------|
| **Corrigir trigger payload JSONB** — acumular array em vez de sobrescrever | Alto | P (1 migration) |
| **Atualizar schema.sql** | Médio | P (1 comando) |
| **CHECK constraint em vistoria_depositos** | Médio | P (1 migration) |
| **RoleGuard nas rotas admin** | Alto | P (3-4 horas) |
| **Centralizar normalizeScore** em scoreUtils.ts | Médio | P (2-3 horas) |
| **Janela temporal na regra de 3 tentativas** | Baixo | P (1 migration) |

---

## Melhorias estruturais (1-3 meses)

| Melhoria | Impacto | Esforço |
|----------|---------|---------|
| Dividir api.ts em módulos por domínio | Alto (manutenção) | Grande |
| Criar suíte de testes (Vitest + Playwright) | Crítico (confiança) | Grande |
| Status de processamento do pipeline | Alto (visibilidade) | Médio |
| Habilitar PostGIS para cruzamento geoespacial | Médio (escala) | Médio |
| RPC dashboard_summary (reduz N queries) | Médio (performance) | Médio |
| Auditar e limitar credenciais do pipeline Python | Crítico (segurança) | Médio |

---

## Plano de execução por etapas

```
ETAPA 0 (Sem 1-2): Estabilização
  → Auditar credenciais Python
  → Corrigir bug payload JSONB
  → Atualizar schema.sql
  → Verificar RLS em tabelas recentes

ETAPA 1 (Sem 2-3): Quick wins de segurança
  → RoleGuard nas rotas
  → CHECK constraint depósitos
  → Centralizar normalizeScore
  → Janela temporal 3 tentativas

ETAPA 2 (Sem 3-5): Visibilidade operacional
  → Status de processamento do pipeline
  → Rate limiting no canal cidadão
  → Notificação de falha CNES sync

ETAPA 3 (Sem 5-7): Qualidade do banco
  → PostGIS para cruzamento geoespacial
  → RPC dashboard_summary

ETAPA 4 (Sem 7-10): Testes
  → Unitários (sla.ts, scoreUtils.ts)
  → Integração (triggers, RLS)
  → E2E (atendimento, vistoria, multitenancy)

ETAPA 5 (Sem 10-14): Refatoração estrutural
  → Dividir api.ts por domínio
  → Dividir database.ts por domínio
  → ESLint rules customizadas

ETAPA 6 (Sem 14+): Evolução de produto
  → Wizard de onboarding
  → API pública
  → Dashboard de transparência
```

---

## O que NÃO precisa ser feito

- Reescrita do sistema ❌
- Migração para outro banco ❌
- Troca de framework ❌
- Substituição do Supabase por backend próprio agora ❌ (avaliar quando escalar para 50+ clientes)

---

## Conclusão

O Sentinella Web é um produto **tecnicamente bem construído para seu estágio**. As decisões arquiteturais fundamentais (Supabase + RLS + React Query + Tailwind) são sólidas e adequadas. Os problemas identificados são típicos de um produto em crescimento acelerado, não de má arquitetura.

A prioridade imediata é: **corrigir o bug do payload JSONB, auditar as credenciais do pipeline Python, e começar a construir a rede de segurança de testes**. Com isso, o sistema ganha confiança para evoluir sem risco de regressões.

O produto está pronto para escalar para novos municípios — com as correções de segurança e a suíte de testes básica no lugar.
