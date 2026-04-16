# SLA Inteligente — Auditoria e Proposta de Implementação

> Gerado em: 2026-04-12
> Status: somente leitura — nenhum código ou migration foi alterado
> Escopo: auditar infraestrutura SLA existente e propor camada complementar baseada em `foco_risco`

---

## A. O que já existe hoje

### A.1 Banco de dados

| Entidade | Papel |
|---|---|
| `sla_operacional` | Registro principal de SLA. 20+ colunas: `inicio`, `prazo_final`, `concluido_em`, `status`, `violado`, `escalonado`, `prioridade_original`, `reaberto_por`, `updated_at` |
| `sla_config` | Configuração JSONB por cliente: `prioridades[]`, `fatores` (risco, persistência, temperatura), `horario_comercial` |
| `sla_config_regiao` | Override regional de SLA — prioridade regional sobrepõe a config base do cliente |
| `sla_config_audit` | Histórico de alterações de configuração com quem alterou e quando |
| `sla_feriados` | Feriados nacionais e municipais por cliente — consumidos pelo cálculo de prazo |
| `sla_erros_criacao` | Log de falhas na criação automática de SLA (QW-09) |
| `foco_risco_historico` | Append-only de transições de estado com `status_anterior`, `status_novo`, `alterado_em` — **não consumido pelo SLA atual** |

**Funções/RPCs existentes:**

| Função | O que faz |
|---|---|
| `sla_calcular_prazo_final()` | Cálculo canônico: horas base + fatores de redução + horário comercial + feriados + override regional |
| `fn_iniciar_sla_ao_confirmar_foco` | Trigger: cria `sla_operacional` quando foco entra em `confirmado` |
| `fn_fechar_sla_ao_resolver_foco` | Trigger: fecha `sla_operacional` quando foco vai a `resolvido`/`descartado` |
| `marcar_slas_vencidos()` | Marca como `vencido` registros com `prazo_final < now()` |
| `escalar_sla_operacional()` | Escala prioridade: Monitoramento→Baixa→Média→Alta→Urgente; recalcula prazo |
| `reabrir_sla()` | Reabre SLA fechado recalculando prazo a partir de agora |
| `gerar_slas_para_run()` | Cria SLAs em lote para itens pluviométricos (P1/P2/P3 only) |
| `sla_resolve_config()` | Resolução de config efetiva: individual → plano → padrão (COALESCE) |

**Triggers automáticos:**
- `trg_levantamento_item_criar_sla_auto` — cria SLA ao inserir levantamento_item
- `trg_after_insert_pluvio_item_sla` — cria SLA ao inserir pluvio_operacional_item
- `trg_operacoes_trigger_concluido_sla` — fecha SLA quando operação é concluída

---

### A.2 Camada de serviço (api.ts)

**`api.sla` — 13 métodos:**
`listByCliente`, `listForPanel`, `listWithJoins`, `updateStatus`, `updateCampos`, `reabrir`, `verificarVencidos`, `escalar`, `pendingCount`, `errosCriacao`, `listRunsByCliente`, `listOperadoresByCliente`, `gerarSlas`

**`api.slaFeriados`** — CRUD de feriados por cliente
**`api.slaConfigRegiao`** — CRUD de overrides regionais
**`api.slaConfig`** — leitura/escrita da config JSON base
**`api.slaIminentes`** — listagem de SLAs próximos do vencimento

---

### A.3 Hooks e cálculos frontend

| Hook | Responsabilidade |
|---|---|
| `useSlaAlerts` | Polling 60s → `verificarVencidos()` → notificação push; retorna `urgentCount`, `urgentSlas` |
| `usePainelSLA` | Realtime em `focos_risco` filtrado por `confirmado`/`em_tratamento`; calcula `pct_consumido`, `severidade`, `tempo_restante_min` |

**Severidade calculada em `usePainelSLA`:**
```
pct = (now - confirmado_em) / (prazo_final - confirmado_em) * 100
>= 100 → 'vencido'   (push disparado)
>=  90 → 'critico'   (push disparado via Edge Function)
>=  70 → 'atencao'
  < 70 → 'ok'
```

**Helpers em `src/types/sla.ts`:**
`getSlaVisualStatus`, `getTempoRestante`, `getSlaOrigem`, `getSlaReductionReason`, `getSlaLocalLabel`, `calcularSlaHoras` (estimativa visual — não canônica)

---

### A.4 Telas que já exibem SLA

| Tela | O que mostra |
|---|---|
| `AdminSla` | Lista completa, geração em lote, escalada, reabertura, erros, export PDF |
| `GestorFocoDetalhe` | `SlaBadge` + prazo + motivo de redução + tab SLA com histórico |
| `GestorFocos` | Coluna SLA na tabela; linha destacada se `sla_status='vencido'` |
| `CentralOperacional` | KPIs `slas_vencidos`, `slas_vencendo_2h` |
| `AgenteHoje` | `SlaBadge` nos focos atribuídos ao agente |
| `SlaAlertBell` | Dropdown de SLAs urgentes no header (push + polling) |
| `PainelSLAWidget` | Widget compacto de focos em risco de SLA |

---

### A.5 Configuração por cliente/região já existente

- `sla_config`: prazo por prioridade (P1=4h, P2=12h, P3=24h, P4=72h, P5=168h) + fatores de redução + horário comercial
- `sla_config_regiao`: override por região geográfica dentro do cliente
- `sla_feriados`: feriados nacionais (seed disponível) + municipais por cliente
- `sla_config_audit`: rastreabilidade de quem mudou o quê

---

## B. O que falta para "SLA inteligente"

### B.1 Tempo por estado do foco_risco

**Problema:** `foco_risco_historico` registra todas as transições com timestamp, mas **nenhum código atual calcula o tempo gasto em cada estado**.

**O que falta:**
- View ou função SQL: `tempo_por_estado(foco_id)` → `{ estado, entrada_em, saida_em, duracao_min }`
- Agregado: `tempo_medio_por_estado(cliente_id, periodo)` para identificar onde focos ficam parados
- Nenhum campo derivado em `sla_operacional` ou `focos_risco` cobre isso hoje

---

### B.2 Severidade por fase do foco

**Problema:** A severidade atual (`ok/atencao/critico/vencido`) é calculada apenas com base em `confirmado_em` e `prazo_final`. Não reflete:
- Quanto tempo levou para sair de `suspeita` → `confirmado` (atraso pré-SLA)
- Se o foco está em `aguarda_inspecao` há mais de X horas sem agente atribuído
- Gargalos específicos de etapa (ex: triagem demorada vs inspeção demorada)

**O que falta:**
- Thresholds por etapa: `suspeita→em_triagem` (esperado ≤2h), `aguarda_inspecao` (esperado ≤24h)
- Campo ou view calculada: `atraso_por_fase` com semáforo por estado
- Integração com `sla_config` para tornar esses thresholds configuráveis por cliente

---

### B.3 Agregados por etapa (visão de gargalo)

**Problema:** Não existe hoje nenhuma query/view que responda: *"qual etapa do fluxo é o maior gargalo para este cliente neste período?"*

**O que falta:**
- View analítica: `v_gargalo_por_etapa(cliente_id, data_inicio, data_fim)` → tempo médio por estado
- Separação: pré-SLA (suspeita→confirmado) vs SLA ativo (confirmado→resolvido)
- Identificar estados onde focos ficam "presos" (outliers > 2σ da média)

---

### B.4 Prioridade temporal real ao gestor

**Problema:** O gestor hoje vê `SlaBadge` (ok/atencao/critico/vencido) baseado no prazo de resolução total. Não vê:
- Focos que **ainda não iniciaram SLA** (em `suspeita`/`em_triagem`) mas já têm muito tempo decorrido
- Focos em `aguarda_inspecao` sem responsável atribuído há horas
- Ranking de urgência considerando tempo real decorrido em cada fase

**O que falta:**
- Campo virtual na view `v_focos_risco_ativos`: `tempo_em_estado_atual_min` (agora - última transição)
- Lógica de "urgência pré-SLA": focos em `suspeita` com > X horas devem aparecer como `atencao`
- `SlaBadge` ou novo badge para estados pré-`confirmado`

---

### B.5 Alertas específicos de foco_risco

**Problema:** Os alertas atuais (`SlaAlertBell`, push via `sla-push-critico`) disparam com base em `sla_operacional` (que só existe a partir de `confirmado`). Focos em estados anteriores nunca geram alertas.

**O que falta:**
- Regra: foco em `suspeita` sem transição por > 4h → alerta gestor
- Regra: foco em `aguarda_inspecao` sem `responsavel_id` por > 8h → alerta supervisor
- Edge Function ou cron job: `foco-sla-pre-confirmacao` que verifica `foco_risco_historico`
- Canal de notificação separado dos alertas operacionais (não poluir `SlaAlertBell` do agente)

---

## C. O que NÃO deve ser alterado

| O que | Motivo |
|---|---|
| `sla_operacional` (schema e triggers) | Base de dados de todo o SLA operacional; mudança quebra AdminSla, alertas, escalada |
| `sla_config` / `sla_config_regiao` / `sla_feriados` | Configuração já em produção por cliente |
| `fn_iniciar_sla_ao_confirmar_foco` | Trigger crítico — início do SLA canônico |
| `fn_fechar_sla_ao_resolver_foco` | Trigger crítico — fechamento do SLA |
| `useSlaAlerts` | Hook em produção usado pelo agente e pelo header |
| `PainelSLAWidget` / `SlaAlertBell` | Componentes de campo e gestão já estáveis |
| `AdminSla` | Página de administração operacional |
| `SlaBadge` | Badge reutilizado em todas as telas — alterar quebra consistência visual |
| Telas do agente (`AgenteHoje`, `AgenteVistoria`, `AgenteReinspecao`) | Fluxo de campo simplificado — não deve receber complexidade de gestão |
| `calcularSlaHoras()` em `sla.ts` | Função deprecated mas ainda usada como fallback visual |

---

## D. Proposta de implementação em 3 fases

### Fase A — Base analítica invisível (sem UI, sem breaking changes)

**Objetivo:** criar infraestrutura de dados para SLA inteligente sem tocar no SLA atual.

**Entregas:**

1. **View `v_tempo_por_estado_foco`**
   ```sql
   -- Calcula duração de cada estado usando foco_risco_historico
   -- Colunas: foco_risco_id, cliente_id, estado, entrada_em, saida_em, duracao_min
   -- Fonte: foco_risco_historico com LAG() para calcular intervalos
   ```

2. **View `v_focos_risco_ativos` — adicionar campo virtual**
   ```sql
   -- Novo campo: tempo_em_estado_atual_min
   -- = EXTRACT(EPOCH FROM (now() - MAX(alterado_em))) / 60
   -- WHERE foco_risco_id = foco.id AND status_novo = foco.status
   ```

3. **Tabela `sla_foco_config` (nova, aditiva)**
   ```sql
   -- Thresholds por estado por cliente (configurável)
   -- cliente_id, estado, horas_atencao, horas_critico
   -- Seed padrão: suspeita→atencao 4h/critico 12h, aguarda_inspecao→atencao 8h/critico 24h
   ```

**Riscos:** Nenhum — views são read-only; nova tabela não interfere com nada existente.

---

### Fase B — Exposição para gestor/admin (UI complementar)

**Objetivo:** tornar visível ao gestor a informação analítica da Fase A.

**Entregas:**

1. **`useFocoSlaInteligente(focoId)` hook**
   - Consome `v_tempo_por_estado_foco`
   - Retorna: `{ tempoEmEstadoAtual, severidadePre, historicoTempo }`

2. **`FocoSlaTimeline` component** (novo, não substitui `SlaBadge`)
   - Mini gráfico de barras horizontais mostrando tempo por estado
   - Inserido na tab SLA do `GestorFocoDetalhe`

3. **`GargaloWidget` no `PainelExecutivo`**
   - Tabela: estado × tempo médio do cliente no período
   - Destaca o estado com maior tempo médio (gargalo)

4. **`usePainelSLA` — adicionar focos pré-SLA**
   - Expandir filtro para incluir focos em `suspeita`/`em_triagem`/`aguarda_inspecao`
   - Severidade calculada via `sla_foco_config` da Fase A
   - Renderizados separados dos focos com SLA ativo (não misturar)

**Riscos:** Médio — novos hooks e componentes, sem alterar os existentes. Risco principal: misturar os dois sistemas de severidade visualmente.

---

### Fase C — Alertas e automação

**Objetivo:** notificar gestores sobre gargalos antes do SLA formal ser violado.

**Entregas:**

1. **Edge Function `foco-sla-pre-confirmacao`** (nova)
   - Cron: a cada 30min
   - Query: focos em `suspeita`/`em_triagem`/`aguarda_inspecao` com `tempo_em_estado_atual > threshold`
   - Ação: job em `job_queue` com tipo `'alerta_foco_gargalo'`; `notif-canal-cidadao` como modelo

2. **`job-worker` — novo handler `alerta_foco_gargalo`**
   - Push para gestores/supervisores do cliente
   - Destino: canal separado de `SlaAlertBell` (não poluir alertas do agente)

3. **`AdminSla` — nova aba "Análise de Gargalos"**
   - Tempo médio por estado nos últimos 30/60/90 dias
   - Comparativo entre regiões
   - Botão exportar PDF (reutilizar padrão `slaAuditPdf.ts`)

**Riscos:** Médio/Alto — edge functions novas + modificação de job-worker. Deve ter feature flag para ativar por cliente.

---

## Resumo de riscos

| Risco | Severidade | Mitigação |
|---|---|---|
| Views analíticas com JOIN pesado em `foco_risco_historico` | Médio | Adicionar índice em `(foco_risco_id, alterado_em)` |
| `usePainelSLA` recebendo focos pré-SLA pode inflar contadores existentes | Alto | Manter separação clara: `FocoSLAStatus[]` vs `FocoPreSLAStatus[]` |
| Alertas pré-SLA poluindo canal do agente | Alto | Notificações da Fase C apenas para papéis `gestor`/`admin`/`supervisor` |
| `sla_foco_config` sem seed → thresholds nulos | Baixo | Trigger `trg_seed_sla_foco_config` ao criar cliente (mesmo padrão do `score_config`) |
| Confusão gestor: dois sistemas de SLA | Médio | UI deve distinguir claramente "SLA Operacional" vs "Tempo por Fase" |

---

## Tabela de arquivos analisados

| Arquivo | Tipo | Status |
|---|---|---|
| `src/types/sla.ts` | Tipos + helpers | Completo, estável |
| `src/types/sla-config.ts` | Config JSON | Completo |
| `src/hooks/useSlaAlerts.ts` | Hook polling | Completo, não alterar |
| `src/hooks/usePainelSLA.ts` | Hook realtime | Completo; Fase B expande |
| `src/services/api.ts` (api.sla) | 13 métodos | Completo |
| `src/pages/admin/AdminSla.tsx` | Dashboard admin | Completo; Fase C adiciona aba |
| `src/pages/gestor/GestorFocoDetalhe.tsx` | Detalhe foco | Fase B adiciona componente na tab SLA |
| `src/pages/gestor/GestorFocos.tsx` | Lista focos | Sem alteração planejada |
| `src/pages/gestor/CentralOperacional.tsx` | KPIs | Fase B pode adicionar card gargalo |
| `src/pages/agente/AgenteHoje.tsx` | Visão agente | **NÃO alterar** |
| `supabase/migrations/20250303*.sql` | Schema core | Base — não tocar |
| `supabase/migrations/20260710010000` | SLA sync focos | Referência para Fase A |
| `foco_risco_historico` (tabela) | Dados brutos | Fase A consome via view |

---

*Próximo passo recomendado:* executar Fase A (views + tabela config) como migration isolada e sem efeito colateral, validar dados em staging, só então partir para Fase B.
