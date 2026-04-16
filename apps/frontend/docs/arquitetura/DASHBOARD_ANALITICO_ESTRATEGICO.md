# Dashboard Analítico Estratégico — Arquitetura

> Versão: P8.2 | Data: 2026-04-14

---

## Objetivo

Expor os dados da consolidação avançada de vistoria em uma visão macro, territorial e multidimensional, destinada a supervisores, admins e analistas regionais.

---

## O que é

Uma tela de análise estratégica (`/gestor/dashboard-analitico`) que agrega:

1. **Resumo geral** — KPIs macro: total de vistorias, taxa de acesso, distribuição P1-P4, alertas urgentes
2. **Risco territorial** — mapa de bairros por nível de criticidade: % vetorial alto, % vulnerável, alertas de saúde
3. **Distribuição de vulnerabilidade** — breakdown de `vulnerabilidade_domiciliar` por bairro (barras)
4. **Alertas de saúde** — distribuição de `alerta_saude` por bairro
5. **Resultado operacional** — distribuição de `resultado_operacional` por bairro (visitado vs sem acesso)
6. **Imóveis críticos** — lista de imóveis P1/P2 com todas as dimensões analíticas visíveis

---

## O que NÃO é

- Não recalcula consolidação — lê diretamente do banco
- Não substitui a CentralOperacional (operação do dia)
- Não é em tempo real — reflete o estado consolidado das vistorias
- Não expõe PII — apenas endereço e bairro agregado

---

## Público-alvo

| Papel | Acesso |
|---|---|
| admin | ✅ Sim |
| supervisor | ✅ Sim |
| analista_regional | ✅ Sim |
| agente | ❌ Não |
| notificador | ❌ Não |

---

## Filtros disponíveis

| Filtro | Onde se aplica |
|---|---|
| Bairro | Vistas territoriais, distribuições, lista de críticos |
| Prioridade (P1/P2) | Lista de imóveis críticos |
| Dimensão vetorial alto/crítico | Lista de imóveis críticos |

---

## Views de banco

| View | Granularidade | Filtros aplicáveis |
|---|---|---|
| `v_dashboard_analitico_resumo` | 1 row por `cliente_id` | — |
| `v_dashboard_analitico_risco_territorial` | por `(cliente_id, bairro)` | bairro |
| `v_dashboard_analitico_vulnerabilidade` | por `(cliente_id, bairro, valor)` | bairro |
| `v_dashboard_analitico_alerta_saude` | por `(cliente_id, bairro, valor)` | bairro |
| `v_dashboard_analitico_resultado_operacional` | por `(cliente_id, bairro, valor)` | bairro |
| `v_dashboard_analitico_imoveis_criticos` | por vistoria (P1/P2) | bairro, prioridade, data_visita |

Todas com `security_invoker = true` — RLS da tabela `vistorias` e `imoveis` aplicado automaticamente.

---

## Arquitetura de componentes

```
DashboardAnalitico.tsx (página)
  ├── useDashboardAnalitico() — hooks de query
  │     ├── useResumoAnalitico(clienteId)
  │     ├── useRiscoTerritorial(clienteId, bairroFilter?)
  │     ├── useVulnerabilidadeDistrib(clienteId, bairroFilter?)
  │     ├── useAlertaSaudeDistrib(clienteId, bairroFilter?)
  │     ├── useResultadoOperacionalDistrib(clienteId, bairroFilter?)
  │     └── useImovelCriticos(clienteId, filters?)
  │
  ├── KpiCards — 4 cards superiores
  ├── RiscoTerritorialTabela — tabela por bairro com semáforo
  ├── VulnerabilidadeDistrib — barras horizontais por valor
  ├── AlertaSaudeDistrib — barras horizontais
  ├── ResultadoOperacionalDistrib — barras por tipo de acesso
  └── ImoveisCriticosTabela — tabela P1/P2 com todas dimensões
```

---

## Arquivos relevantes

| Arquivo | Responsabilidade |
|---|---|
| `src/pages/gestor/DashboardAnalitico.tsx` | Página principal |
| `src/hooks/queries/useDashboardAnalitico.ts` | Hooks de query |
| `src/guards/DashboardAnaliticoGuard.tsx` | Proteção de rota (admin + supervisor + analista_regional) |
| `supabase/migrations/20270301000000_dashboard_analitico_views.sql` | 6 views analíticas |

---

## Decisões de design

- **Views, não RPCs**: dados agregados sem parâmetros de período simplificam cache e RLS
- **security_invoker=true**: todas as views herdam o RLS de `vistorias` e `imoveis` — zero bypass
- **Sem recharts nos totais**: KPIs exibidos como cards numéricos; recharts apenas nas distribuições
- **Bairro como pivô**: permite filtrar as 5 views relacionadas com uma única seleção
