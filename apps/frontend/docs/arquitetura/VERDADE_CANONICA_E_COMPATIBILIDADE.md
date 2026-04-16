# Verdade Canônica vs Compatibilidade — SentinelaWeb

> Documento fiel ao estado real do código em 2026-04-14.
> Objetivo: reduzir ambiguidade para manutenção e treinamento.

---

## 1. Aggregate Root canônico — `focos_risco`

`focos_risco` é a entidade central do fluxo operacional. Todo problema identificado (por drone, vistoria manual ou canal cidadão) gera um registro aqui.

### State machine (8 estados)

```
suspeita → em_triagem → aguarda_inspecao → em_inspecao → confirmado → em_tratamento → resolvido
                                                                                      → descartado
```

### Invariantes invioláveis

| Regra | Implementação |
|---|---|
| Transição de status **somente via RPC** | `rpc_transicionar_foco_risco` |
| `resolvido` e `descartado` são terminais | Não reabre; cria novo foco com `foco_anterior_id` |
| Histórico append-only | `foco_risco_historico` — nunca UPDATE/DELETE |
| SLA começa em `confirmado` | Campo `confirmado_em`, não `suspeita_em` |

---

## 2. Campos virtuais (não armazenados)

| Campo | Onde é calculado | Propósito |
|---|---|---|
| `statusOperacional` (3 estados: `pendente`, `em_atendimento`, `resolvido`) | `src/lib/mapStatusOperacional.ts` — `mapFocoToStatusOperacional()` | Exibição simplificada na UI; mapeamento 8→3 |
| Score YOLO normalizado | Frontend — `normalizeScore()` | Normaliza `0–1` ou `0–100` para escala `0–1` |
| `calcularSlaHoras()` | `src/types/sla.ts` | Estimativa visual de horas de SLA — **não usar para decisões de negócio** |

---

## 3. Compatibilidade de transição — `status_atendimento`

**Situação real:** campo `status_atendimento` foi **removido** de `levantamento_itens` na migration `20260711`. Não existe mais na tabela.

**Referências residuais encontradas no código:**
- `src/components/map-v3/MapClusterLayer.tsx:104` — referência de leitura a `item.status_atendimento`
- `src/pages/admin/AdminCanalCidadao.tsx:213` — `d.status_atendimento` — pode ser campo de outra entidade (ex: `focos_cidadao` ou view)
- `api.ts` — `updateAtendimento()` marcado `@deprecated` como no-op explícito

**Regra:** nunca recriar `status_atendimento` em `levantamento_itens`. Referências de UI que ainda leem este campo devem ser migradas para `focos_risco.status`.

---

## 4. Bridges de rota — `/operador` → `/agente`

O papel histórico chamado "operador" foi renomeado para "agente" no domínio canônico. As rotas antigas são mantidas como redirects para não quebrar bookmarks ou integrações.

| Rota legada | Rota canônica atual | Localização |
|---|---|---|
| `/operador/inicio` | `/agente/hoje` | `App.tsx:210` |

**Regra:** novas rotas devem usar `/agente/*`. Não criar novas rotas em `/operador/*`.

---

## 5. Aliases de papel

| Nomenclatura legada | Nomenclatura canônica | Observação |
|---|---|---|
| `operador` (na UI antiga) | `agente` | Papel no banco: `agente` |
| `gestor` | `supervisor` | Mesmo papel; sem distinção no banco |
| `platform_admin` | *(morto)* | Dead value no enum `papel_app` — nunca atribuir |

Papéis canônicos ativos em `papeis_usuarios.papel`:
```
agente | supervisor | admin | notificador | analista_regional
```

---

## 6. Legado residual controlado em `api.ts`

| Método | Status | Motivo |
|---|---|---|
| `itens.updateAtendimento()` | `@deprecated` no-op | Compatibilidade com itens pré-migração sem foco vinculado. Não remove status que não existe mais. |
| `itens.updateObservacaoAtendimento()` | Ativo — legado tolerável | Campo `observacao` simples; não afeta state machine |

---

## 7. `SLA_RULES` em `src/types/sla.ts`

Marcado `@deprecated`. A fonte de verdade de SLA é a tabela `sla_config` no banco, configurável por cliente e por região. `SLA_RULES` é referência estática desatualizada — não usar para cálculos de negócio.

---

## 8. Canal cidadão — fluxo canônico

Denúncias públicas entram via RPC `denunciar_cidadao`, que:
1. Aplica rate limit (5/min por município — C-04)
2. Cria `focos_risco` diretamente com `origem = 'cidadao'`
3. Retorna `{ ok, foco_id, deduplicado }` — protocolo = primeiros 8 chars do `foco_id`

Auditoria disponível em `AdminCanalCidadao.tsx` (admin/supervisor).

---

## 9. Componentes legados ainda existentes

| Componente | Status | Observação |
|---|---|---|
| `src/components/map-dashboard/RiskDetailsPanel.tsx` | Legado tolerável | Painel de mapa antigo; ainda em uso mas com mutação direta de `operacoes` (ver auditoria) |
| `src/components/map-v3/ItemDetailsPanel.tsx` | Versão mais nova | Idem — mesma mutação direta de `operacoes` |
| `src/hooks/queries/useItemStatusHistorico.ts` | Compatibilidade | Consulta histórico de status de itens via bridge |

---

## Resumo de prioridade de fonte de verdade

| Entidade | Fonte de verdade | Nunca usar |
|---|---|---|
| Status de foco | `focos_risco.status` via `rpc_transicionar_foco_risco` | UPDATE direto no frontend |
| Papel de usuário | `papeis_usuarios.papel` via `rpc_set_papel_usuario` | DELETE+INSERT manual |
| SLA config | `sla_config` no banco | `SLA_RULES` em `types/sla.ts` |
| SLA lifecycle | RPCs: `reabrir_sla`, `escalar_sla_operacional`, `marcar_slas_vencidos` | campos genéricos via update |
| Cruzamento caso↔foco | trigger `trg_cruzar_caso_focos` | Inserção manual em `caso_foco_cruzamento` |
