# SLA Operacional vs SLA no Mapa

Comparação direta dos dois contextos de SLA no Sentinela.

---

## Visão geral

| Aspecto | SLA Operacional (pluvio) | SLA no Mapa (levantamento) |
|--------|---------------------------|----------------------------|
| **Unidade** | Um **bairro/região** em uma rodada pluviométrica | Um **item** de levantamento (ponto no mapa) |
| **Tabela** | `sla_operacional` (uma linha por SLA) | Campo `sla_horas` em `levantamento_itens` |
| **Origem** | Run pluvio → itens (bairros) → **Gerar SLAs** na Gestão de SLA | Preenchido na criação do item (manual ou no processamento do drone) |
| **Status** | `pendente` → `em_atendimento` → `concluido` / `vencido` | Não tem status próprio; usa `status_atendimento` do item |
| **Operador** | Atribuído em `sla_operacional.operador_id` | Implícito no atendimento do item (operador que atende) |
| **Alertas** | Sino, useSlaAlerts, notificações, widget no Dashboard | Apenas contagens no painel do mapa (safe / warning / danger) |
| **Configuração** | `sla_config` por cliente (horas por prioridade, fatores) | Sem config centralizada; valor fixo ou regra no processamento |

---

## Modelo de dados

### SLA Operacional

- **sla_operacional**: `id`, `item_id` (→ pluvio_operacional_item), `operador_id`, `prioridade`, `sla_horas`, `inicio`, `prazo_final`, `concluido_em`, `status`, `violado`, `escalonado`, …
- **sla_config**: por `cliente_id`, JSON com prioridades, fatores, horário comercial.
- **Fluxo**: run pluvio existe → Gestão de SLA → “Gerar SLAs” → INSERT em `sla_operacional` usando config.

### SLA no Mapa

- **levantamento_itens**: coluna `sla_horas` (número de horas, ex.: 24).
- Sem tabela de status de SLA; o item tem `status_atendimento` (pendente, em_atendimento, resolvido) e `data_resolucao`.
- **Fluxo**: valor definido ao criar/importar o item (formulário manual envia `sla_horas`; processamento drone pode preencher por regra).

---

## Onde cada um aparece no app

| Onde | SLA Operacional | SLA no Mapa |
|------|------------------|-------------|
| **/operador** | Lista de SLAs, Assumir, Concluir | — |
| **/admin/sla** | Gestão, Configuração, Gerar SLAs, PDF, ranking | — |
| **Dashboard** | Widget SLA, sino de alertas | — |
| **/mapa** | — | Painel: Total / Pontos críticos / Regiões / **Score**; blocos “Dentro do prazo”, “Próximo ao venc.”, “Vencidos” (contagem por `sla_horas` do item) |
| **Levantamentos / detalhe do item** | — | Exibe “SLA Xh” no item |
| **Criar item manual** | — | Campo opcional “SLA (horas)” |
| **PDF levantamento** | — | Coluna SLA por item |

---

## Como melhorar e usar melhor

### SLA Operacional

- Garantir migração aplicada e **Gerar SLAs** executado para runs com itens.
- Ajustar **Configuração** (horas por prioridade, fatores, horário comercial) em Gestão de SLA.
- Usar alertas (sino, useSlaAlerts) e relatórios (PDF, ranking) para acompanhamento e auditoria.

### SLA no Mapa

- **Preencher `sla_horas`** em todos os itens que devem ter prazo: no formulário manual e na regra de processamento do drone (ex.: por tipo de detecção ou prioridade).
- Opcional: usar a mesma lógica de **sla_config** (prioridades/fatores) para calcular `sla_horas` ao criar itens de levantamento, mantendo consistência com o SLA operacional.
- O painel do mapa já usa `sla_horas` para contagens (safe/warning/danger); evoluir para exibir “tempo restante” por item (usando `data_hora`/created_at + `sla_horas`) se quiser paridade com o operacional.

### Unificação (opcional)

- Definir prazos em um só lugar (`sla_config` ou extensão) para “prioridade/tipo” e usar na geração de SLA operacional **e** no preenchimento de `sla_horas` dos itens do mapa.
- Assim, operacional e mapa passam a seguir as mesmas regras de prazo, diferenciando só a unidade (bairro vs item) e o fluxo de status/alertas.

---

## Referências

- Contexto e fluxo completo: `docs/SLA-CONTEXTO-E-FLUXO.md`
- Passo a passo do SLA operacional: `docs/SLA-SEQUENCIA-PASSO-A-PASSO.md`
- Tipos: `src/types/sla.ts`, `src/types/sla-config.ts`
