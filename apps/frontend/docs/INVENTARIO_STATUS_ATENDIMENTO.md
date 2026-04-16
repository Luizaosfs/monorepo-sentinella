# Inventário de uso de status_atendimento

> Documento de referência. **NÃO é um plano de migração.**
> Gerado em: 2026-04-12
> Regra: a camada operacional (3 estados) é intencional e deve ser preservada.

---

## Contexto arquitetural

O sistema tem DUAS CAMADAS DISTINTAS e intencionais:

| Camada | Estados | Público | Tabela-base |
|--------|---------|---------|-------------|
| **Operacional** | `pendente` → `em_atendimento` → `resolvido` | Agente / Operador de campo | `levantamento_itens` (virtual via `enrichItensComFoco`) |
| **Epidemiológica** | 8 estados (`suspeita` … `resolvido`) | Gestor / Admin | `focos_risco` |

Os campos `status_atendimento`, `acao_aplicada` e `data_resolucao` em `levantamento_itens`
são **virtuais** — preenchidos em runtime por `src/lib/enrichItensComFoco.ts` a partir do
`focos_risco` vinculado. Eles **não existem mais como colunas físicas** após a migration `20260711`.

---

## Resumo

| Métrica | Valor |
|---------|-------|
| Total de arquivos com referência | 12 |
| Camada operacional (preservar) | 9 |
| Camada epidemiológica / admin (avaliar) | 2 |
| Legado / divergência (avaliar) | 1 |

---

## Camada Operacional — PRESERVAR

Estes componentes pertencem ao fluxo simplificado (3 estados) para agentes em campo
ou para visualizações operacionais diretas. **Não migrar.**

| # | Arquivo | Linha(s) | Campo(s) | Contexto |
|---|---------|----------|----------|---------|
| 1 | `src/pages/operador/OperadorMapa.tsx` | 81 | `status_atendimento` | Filtro de itens no mapa do operador — exibe pendente/em_atendimento/resolvido |
| 2 | `src/pages/Levantamentos.tsx` | 60, 131, 180–182 | `status_atendimento`, `acao_aplicada` | Filtro por status + atualização local após resolução — view principal de levantamentos |
| 3 | `src/pages/MapaInspecao.tsx` | 125 | `status_atendimento` | Coloração de marcadores no mapa de inspeção por status operacional |
| 4 | `src/pages/Dashboard.tsx` | 269 | `status_atendimento` | Cálculo de `pendentesSlice` no gráfico do dashboard |
| 5 | `src/components/levantamentos/ItemDetailPanel.tsx` | 68–69, 106–113, 130, 174, 205 | `status_atendimento`, `acao_aplicada` | Painel de detalhes do item — estado local sincronizado com `focoRisco`; chama `api.itens.updateAtendimento` (no-op mantido para compatibilidade) |
| 6 | `src/components/levantamentos/LevantamentoItemTable.tsx` | 48, 63, 75 | `status_atendimento`, `acao_aplicada` | Tabela de itens — opacidade por status + exibição de ação aplicada |
| 7 | `src/components/levantamentos/LevantamentoMobileItem.tsx` | 20 | `status_atendimento` | Card mobile de item — exibe badge de status operacional |
| 8 | `src/components/map-v3/MapClusterLayer.tsx` | 30, 104 | `status_atendimento` | Coloração de clusters no mapa v3 por status operacional |
| 9 | `src/components/levantamentos/detail/ItemSlaTimeline.tsx` | 59–60 | `acao_aplicada_nova` | Timeline de SLA — exibe ação aplicada registrada no histórico (campo de histórico, não da tabela principal) |

---

## Camada Epidemiológica / Admin — Avaliar

Estes componentes estão no contexto admin/gestor e fazem uso misto:
lêem `status_atendimento` virtual mas poderiam usar `focos_risco.status` diretamente.
**Não é blocker — apenas sinalizado para revisão futura.**

| # | Arquivo | Linha(s) | Campo(s) | Observação |
|---|---------|----------|----------|-----------|
| 1 | `src/pages/admin/AdminHeatmapTemporal.tsx` | 65 | `status_atendimento` | Conta `resolvidos` para o heatmap animado. Poderia usar `focos_risco.status = 'resolvido'` diretamente — mudança de produto, não técnica |
| 2 | `src/components/dashboard/AtendimentoStatusWidget.tsx` | 117–122 | `data_resolucao`, `acao_aplicada` | Widget do dashboard que exibe itens com data de resolução e ação. Usa campos virtuais — funciona corretamente enquanto `enrichItensComFoco` estiver ativo |

---

## Legado / Divergência — Avaliar necessidade

| # | Arquivo | Linha(s) | Campo(s) | Observação |
|---|---------|----------|----------|-----------|
| 1 | `src/pages/admin/AdminCanalCidadao.tsx` | 25–28, 60, 120, 185–187, 209–210 | `status_atendimento`, `acao_aplicada`, `data_resolucao` | Ver seção abaixo |

---

## Divergência conhecida: AdminCanalCidadao

O componente `src/pages/admin/AdminCanalCidadao.tsx` define uma função local
`mapFocoStatusToAtendimento` (linha 25) que **difere** da versão centralizada em
`src/lib/enrichItensComFoco.ts`:

| Implementação | Mapeamento de `confirmado` |
|---|---|
| `enrichItensComFoco.ts` (centralizada) | `confirmado` → `'em_atendimento'` |
| `AdminCanalCidadao.tsx` (local, linha 28) | `confirmado` → **`'pendente'`** (não mapeado) |

### Impacto prático
Um foco cidadão no estado `confirmado` aparece como **"Em andamento"** na visão geral
de levantamentos (via `enrichItensComFoco`), mas como **"Pendente"** na listagem do
canal cidadão (`AdminCanalCidadao`).

### Classificação
**MUDANÇA DE PRODUTO — não corrigir sem validação.**
A diferença pode ser intencional: no contexto do canal cidadão, um foco `confirmado`
ainda não foi tratado do ponto de vista do gestor que monitora as denúncias.
Qualquer alinhamento entre as duas funções requer decisão de produto.

---

## Notas técnicas

### Campos virtuais vs. físicos
Após a migration `20260711000000_drop_deprecated_levantamento_itens_cols.sql`,
os campos `status_atendimento`, `acao_aplicada`, `data_resolucao` e `checkin_*`
**não existem mais como colunas físicas** em `levantamento_itens`.

Eles são injetados em runtime pela função `enrichItensComFoco()` em
`src/lib/enrichItensComFoco.ts`, que os deriva do `focos_risco` vinculado.
Todos os componentes acima consomem o tipo enriquecido — não há leitura direta
do banco para esses campos.

### api.itens.updateAtendimento
Conforme documentado no CLAUDE.md, `api.itens.updateAtendimento` e
`api.itens.updateObservacaoAtendimento` são **no-op** — mantidos apenas para
compatibilidade de código legado em `ItemDetailPanel.tsx`.
Toda gestão de estado real de foco usa `api.focosRisco.transicionar`.
