# Inventário de Mutações Diretas — P7.11

> Auditado em 2026-04-14. Baseado no código real encontrado em `src/services/api.ts` e componentes.

---

## Legenda de classificação

| Classificação | Significado |
|---|---|
| **segura e aceitável** | Operação simples, bem delimitada, sem risco de violar invariantes |
| **legado tolerável** | Existe por compatibilidade; não é ideal mas não causa risco imediato |
| **deve virar RPC** | Operação crítica que exige atomicidade ou validação no banco |
| **deve ser removida** | Duplicidade ou antipadrão sem justificativa |

---

## 1. Tabela `focos_risco`

| # | Arquivo | Função/Método | Tipo | Campos alterados | Risco | Classificação | Recomendação |
|---|---|---|---|---|---|---|---|
| F1 | `src/services/api.ts:326` | `itens.updateObservacaoAtendimento()` | UPDATE | `observacao` | Baixo — campo de texto livre, não afeta state machine | **legado tolerável** | Manter; campo simples. Considerar mover para RPC se `observacao` vier a ter regras |
| F2 | `src/services/api.ts:3795` | `focosRisco.vincularImovel()` | UPDATE | `imovel_id` | Baixo — enriquecimento de dado, documentado como não-transição | **segura e aceitável** | Manter como está |
| F3 | `src/services/api.ts:3969` | `focosRisco.update()` | UPDATE | `responsavel_id \| desfecho \| prioridade \| regiao_id` | **MÉDIO** — `prioridade` e `regiao_id` afetam score de prioridade e routing operacional; aceitar mudança direta sem validação pode violar coerência | **deve virar RPC** (parcial) | Separar em duas operações: (a) `atualizarMetadados(responsavel_id, desfecho)` — UPDATE direto aceitável; (b) `atualizarPrioridade(prioridade)` e `atualizarRegiao(regiao_id)` — idealmente RPCs com validação de papel e log em `foco_risco_historico` |

---

## 2. Tabela `sla_operacional`

| # | Arquivo | Função/Método | Tipo | Campos alterados | Risco | Classificação | Recomendação |
|---|---|---|---|---|---|---|---|
| S1 | `src/services/api.ts:885` | `sla.updateStatus()` | UPDATE | `Record<string, unknown>` — qualquer campo | **ALTO** — tipo totalmente aberto; aceita `status`, `prazo_final`, `prioridade` sem restrição | **deve virar RPC** | Tipar explicitamente os campos permitidos; operações de status devem usar as RPCs já existentes (`reabrir_sla`, `escalar_sla_operacional`, `marcar_slas_vencidos`) |
| S2 | `src/services/api.ts:1008` | `sla.updateCampos()` | UPDATE | `Record<string, unknown>` — qualquer campo | **ALTO** — alias idêntico a `updateStatus` com nome diferente; duplicidade e mesmo risco | **deve ser removida** | Remover `updateCampos`; consolidar em chamadas tipadas ou RPCs. É duplicata desnecessária de `updateStatus` |

**Nota:** As RPCs canônicas de SLA já existem e estão corretas (`reabrir_sla`, `escalar_sla_operacional`, `marcar_slas_vencidos`, `gerar_slas_para_run`). O problema é que `updateStatus` e `updateCampos` ficam como escapes não-governados.

---

## 3. Tabela `usuarios`

| # | Arquivo | Função/Método | Tipo | Campos alterados | Risco | Classificação | Recomendação |
|---|---|---|---|---|---|---|---|
| U1 | `src/services/api.ts:3092` | `usuarios.insert()` | INSERT | `nome, email, cliente_id, auth_id` | Baixo — criação controlada | **segura e aceitável** | Manter |
| U2 | `src/services/api.ts:3096` | `usuarios.update()` | UPDATE | `nome, email, cliente_id, agrupamento_id, auth_id` | **MÉDIO** — `cliente_id` mutável diretamente; mudar vínculo de cliente por UPDATE direto pode violar isolamento multitenant | **deve virar RPC** (para cliente_id) | Remover `cliente_id` do payload permitido em UPDATE direto; criar RPC `transferir_usuario_para_cliente()` se a operação for legítima |
| U3 | `src/services/api.ts:3100` | `usuarios.updatePapel()` | DELETE + INSERT | `papeis_usuarios` | **ALTO** — operação não-atômica: delete seguido de insert cria janela de inconsistência onde usuário fica sem papel | **deve virar RPC** | Criar RPC `rpc_set_papel_usuario(usuario_id, papel)` que executa atomicamente dentro de uma transação |
| U4 | `src/services/api.ts:3105` | `usuarios.setPapel()` | DELETE + INSERT | `papeis_usuarios` | **ALTO** — mesmo problema de U3; opera por `authId` em vez de `usuarioId`, causando possível confusão de chave | **deve virar RPC** | Consolidar com RPC de U3; eliminar a duplicidade `updatePapel` vs `setPapel` |
| U5 | `src/services/api.ts:3111` | `usuarios.deletePapeis()` | DELETE | `papeis_usuarios` | Médio — usado em fluxo de remoção; deixa usuário sem papel até próximo INSERT | **legado tolerável** | Manter por ora; garantir que só seja chamado junto com `remove()` |
| U6 | `src/services/api.ts:3116` | `usuarios.remove()` | UPDATE | `ativo = false` | Baixo — soft delete documentado e intencional | **segura e aceitável** | Manter |
| U7 | `src/services/api.ts:3122` | `usuarios.marcarOnboardingConcluido()` | UPDATE | `onboarding_concluido, onboarding_versao, onboarding_concluido_em` | Baixo — metadado de UX, sem impacto operacional | **segura e aceitável** | Manter |

---

## 4. Tabela `operacoes` — mutações diretas em componentes de UI

| # | Arquivo | Localização | Tipo | Campos alterados | Risco | Classificação | Recomendação |
|---|---|---|---|---|---|---|---|
| O1 | `src/components/map-dashboard/RiskDetailsPanel.tsx:297` | Inline no componente (JSX handler) | UPDATE direto via `supabase` | `status = 'cancelado', concluido_em` | **MÉDIO** — mutação de status diretamente no componente, sem passar por `api.ts`; dificulta rastreabilidade e testes | **deve ser removida** | Criar `api.operacoes.cancelar(id)` em `api.ts` e substituir o acesso direto ao `supabase` |
| O2 | `src/components/map-v3/ItemDetailsPanel.tsx:317` | Inline no componente (JSX handler) | UPDATE direto via `supabase` | `status = 'cancelado', concluido_em` | **MÉDIO** — idem O1; duplicata em componente diferente | **deve ser removida** | Mesmo método `api.operacoes.cancelar(id)` |

---

## 5. Outras tabelas (seguras — registrado por completude)

| Tabela | Arquivo | Classificação | Motivo |
|---|---|---|---|
| `piloto_eventos` | `src/lib/pilotoEventos.ts:62` | segura e aceitável | INSERT fire-and-forget de instrumentação; sem impacto operacional |
| `sentinela_drone_risk_config` | `src/lib/seedDefaultDroneRiskConfig.ts` | segura e aceitável | Seeds de configuração; só executados em setup inicial |
| `sentinela_yolo_class_config` | `src/lib/seedDefaultDroneRiskConfig.ts` | segura e aceitável | Seeds de configuração |
| `sentinela_yolo_synonym` | `src/lib/seedDefaultDroneRiskConfig.ts` | segura e aceitável | Seeds de configuração |
| `sentinela_risk_policy` | `src/lib/seedDefaultRiskPolicy.ts` | segura e aceitável | Seeds de política de risco |
| `planejamento` | `src/services/api.ts:585` | segura e aceitável | CRUD de planejamento; domínio não-crítico |
| `regioes` | `src/services/api.ts:695` | segura e aceitável | CRUD administrativo |
| `pluvio_operacional_run/item` | `src/services/api.ts:746` | segura e aceitável | Pipeline pluviométrico; operação controlada |
| `pluvio_risco` | `src/services/api.ts:797` | segura e aceitável | Pipeline de risco; operação controlada |
| `clientes` | `src/services/api.ts:508` | segura e aceitável | CRUD de cliente; operação admin |
| `casos_notificados` | via `api.casosNotificados.update()` | legado tolerável | Atualização de metadados de caso; sem vínculo com state machine |
| `sentinela_risk_fallback_rule` | `src/services/api.ts:3317` | segura e aceitável | Configuração de política de risco |

---

## Resumo executivo

| Categoria | Qtd | Ação recomendada |
|---|---|---|
| Segura e aceitável | 12 | Nenhuma ação necessária |
| Legado tolerável | 3 | Monitorar; corrigir quando houver motivo |
| Deve virar RPC | 4 (F3 parcial, S1, U2 parcial, U3+U4) | **Prioridade alta** — U3+U4 são não-atômicos |
| Deve ser removida | 3 (S2, O1, O2) | **Prioridade média** — S2 é duplicata perigosa; O1/O2 são antipadrão |

### Prioridade de correção

1. **U3 + U4** — `updatePapel` / `setPapel` são não-atômicos; virar RPC elimina janela de inconsistência
2. **S1 + S2** — `updateStatus` / `updateCampos` são escapes abertos em `sla_operacional`; tipar S1 e remover S2
3. **O1 + O2** — mutação de `operacoes` direta em componente; extrair para `api.ts`
4. **U2** — `cliente_id` mutável por UPDATE direto; restringir payload
5. **F3** — `prioridade` e `regiao_id` em `focosRisco.update()` sem validação de papel
