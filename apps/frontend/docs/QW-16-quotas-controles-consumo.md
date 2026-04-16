# SENTINELLA WEB — QW-16
# Limites por Cliente e Enforcement de Quotas

**Status:** Diagnóstico concluído — aguardando Sprint A
**Data:** 2026-03-27

---

## Diagnóstico — Estado real da infraestrutura

### O que já existe (confirmado no código)

| Componente | Arquivo | O que faz |
|---|---|---|
| `cliente_quotas` | migration `20250311190000` | Limites: `voos_mes`, `levantamentos_mes`, `itens_mes`, `usuarios_ativos` |
| `v_cliente_uso_mensal` | migration `20250311190000` | Agrega uso do mês + flags `*_excedido` |
| RPC `cliente_verificar_quota` | migration `20250311190000` | Retorna `{ok, usado, limite}` para uma métrica |
| Trigger `check_quota_voos` | migration `20260319241000` | BEFORE INSERT em `voos` — bloqueia se `voos_mes` excedido |
| Trigger `fn_check_quota_itens` | migration `20260402000000` | BEFORE INSERT em `levantamento_itens` — bloqueia se `itens_mes` excedido |
| Fix timezone | migration `20260605040000` | Corrige cálculo de mês para `America/Sao_Paulo` |
| Billing snapshot (QW-15) | migration `20260732000000` | Registra `vistorias_mes`, `ia_calls_mes`, `storage_gb` — imutável, mensal |
| `QuotaBanner` | componente | Banner 70%/85%/100% — aviso UX (implementado) |
| `QuotaAlertBadge` | componente | Badge vermelho no menu admin quando excedido |
| `AdminQuotas` | página `/admin/quotas` | Edição de limites + visualização de uso |
| `api.quotas.*` | api.ts | `byCliente`, `usoMensal`, `usoMensalAll`, `verificar`, `update` |

### Gaps identificados (o que falta)

| Operação | Quota rastreada? | Trigger no banco? | Check no frontend? |
|---|---|---|---|
| Criar voo | ✅ `voos_mes` | ✅ BEFORE INSERT | ✗ |
| Criar levantamento | ✅ `levantamentos_mes` (view) | ✗ **falta** | ✗ |
| Criar item drone/manual | ✅ `itens_mes` | ✅ BEFORE INSERT | ✗ |
| Criar vistoria | ✅ `vistorias_mes` (billing only) | ✗ não existe | ✗ |
| Triagem IA | ✅ `ia_calls_mes` (billing only) | ✗ não existe | ✗ |
| Upload imagem | parcial `storage_gb` (billing) | ✗ | ✗ |
| Criar usuário | ✅ `usuarios_ativos` (view only) | ✗ **falta** | ✗ |
| Denúncia cidadão | ✗ | ✗ (rate limit IP via QW-14) | ✗ |
| Casos notificados | ✗ | ✗ | ✗ |
| Notificações e-SUS | ✗ | ✗ | ✗ |
| Sync CNES | ✗ | ✗ | ✗ |
| Gerar relatório | ✗ | ✗ | ✗ |

---

## 1. Matriz de Quotas por Recurso

| Recurso | Métrica | Onde contar | Classificação | Enforcement atual | Enforcement alvo |
|---|---|---|---|---|---|
| Voos de drone | `voos_mes` | INSERT `voos` | 🔴 BLOQUEAR | Trigger banco ✅ | Manter |
| Itens de levantamento | `itens_mes` | INSERT `levantamento_itens` | 🔴 BLOQUEAR | Trigger banco ✅ | Manter |
| Criar levantamento | `levantamentos_mes` | INSERT `levantamentos` | 🟡 BLOQUEAR COM CARÊNCIA | ✗ | Trigger banco (Sprint A) |
| Criar usuário | `usuarios_ativos` | INSERT `usuarios` | 🔴 BLOQUEAR | ✗ | Trigger banco (Sprint A) |
| Triagem IA | `ia_calls_mes` | Edge Function | 🔴 BLOQUEAR só IA | ✗ | Edge Function check (Sprint B) |
| Vistorias de campo | `vistorias_mes` | INSERT `vistorias` | 🟢 **NUNCA BLOQUEAR** | ✗ | Apenas aviso (Sprint B) |
| Storage / Imagens | `storage_gb` | billing snapshot | 🟡 AVISAR | ✗ | Apenas aviso (Sprint B) |
| Denúncias cidadão | — | rate limit IP | 🟢 **NUNCA BLOQUEAR** | Rate limit IP ✅ | Sem mudança |
| Casos notificados | — | — | 🟢 **NUNCA BLOQUEAR** | Sem limite | Sem mudança |
| Notificações e-SUS | — | — | 🟢 **NUNCA BLOQUEAR** | Sem limite | Sem mudança |
| Sync CNES | — | — | 🟢 **NUNCA BLOQUEAR** | Agendado, baixo impacto | Sem mudança |
| Relatórios PDF | — | — | 🟢 **NUNCA BLOQUEAR** | Sem limite | Sem mudança |

### Regra de ouro

> **Operações de campo nunca bloqueiam.**
> Vistorias, casos notificados, denúncias, notificações e-SUS e relatórios
> são operações de saúde pública. O sistema avisa, nunca paralisa.

---

## 2. Estratégia de Bloqueio vs Aviso

### Soft limits — UX progressivo (já existe estrutura)

| Percentual | Ação | Onde |
|---|---|---|
| 70% | Banner amarelo — "Você está a 30% do limite" | `QuotaBanner` ✅ |
| 85% | Banner laranja — "Atenção: uso elevado" | `QuotaBanner` ✅ |
| 100% | Banner vermelho — "Limite atingido" | `QuotaBanner` ✅ |
| 100% + recurso bloqueável | Botão de ação desabilitado + toast explicativo | Frontend (Sprint B) |
| 100% + trigger banco | Exceção capturada → toast amigável | `quotaErrorHandler` (Sprint A) |

### Hard limits — banco e Edge Function

| Recurso | Onde bloquear | Comportamento ao exceder |
|---|---|---|
| `voos_mes` | Trigger BEFORE INSERT `voos` | RAISE EXCEPTION → HTTP 409 ✅ |
| `itens_mes` | Trigger BEFORE INSERT `levantamento_itens` | RAISE EXCEPTION → HTTP 409 ✅ |
| `levantamentos_mes` | Trigger BEFORE INSERT `levantamentos` (Sprint A) | Bloqueia só acima de 150% (carência) |
| `usuarios_ativos` | Trigger BEFORE INSERT `usuarios` (Sprint A) | RAISE EXCEPTION → toast explicativo |
| `ia_calls_mes` | Edge Function `triagem-ia-pos-voo` (Sprint B) | HTTP 402 → toast; levantamento segue sem IA |

### Carência e exceções

| Situação | Comportamento | Quem autoriza |
|---|---|---|
| Levantamentos — carência de 50% | Trigger só bloqueia acima de 150% do limite | Automático |
| Plano enterprise (`limite IS NULL`) | Sem limite em qualquer métrica | — |
| Campo `surto_ativo = true` no cliente | `levantamentos_mes` e `vistorias_mes` ignoram limite | Admin plataforma |
| Admin plataforma eleva limite manualmente | Liberado imediatamente via `AdminQuotas` | Admin plataforma |

---

## 3. Onde a Validação Ocorre

| Camada | Recursos | Justificativa |
|---|---|---|
| **Trigger banco** | voos, itens, levantamentos, usuários | À prova de bypass — funciona mesmo sem passar pelo frontend |
| **Edge Function** | triagem IA | Custo externo direto (Claude API) — deve bloquear antes da chamada |
| **Frontend (UX)** | todos os recursos | Desabilitar botão e exibir toast antes de tentativa — melhor experiência |
| **job_queue** | — | Jobs não verificam quota — são operações internas do sistema |

### Fluxo offline — sem verificação de quota

```
Campo sem rede → offlineQueue.ts → save_vistoria enfileirado (sem check)
Ao reconectar  → drain           → create vistoria → sucesso sempre
                                 → toast: "X vistorias sincronizadas (aviso: quota excedida)"
```

Vistorias enfileiradas offline **nunca verificam quota**. Operador de campo não pode ser bloqueado por limite.

---

## 4. Relação cliente_quotas × planos (QW-15 + QW-16)

Hoje `cliente_quotas` tem limites definidos manualmente por admin.
Com QW-16 Sprint C, os limites do plano viram o **default** ao criar cliente,
sobrescritos individualmente via `cliente_quotas`:

```
planos.limite_vistorias_mes  ←→  cliente_quotas.vistorias_mes  (sobrescreve)
planos.limite_ia_calls_mes   ←→  cliente_quotas.ia_calls_mes
planos.limite_storage_gb     ←→  cliente_quotas.limite_storage_gb
```

A RPC `cliente_verificar_quota` deve usar `COALESCE(quota_individual, plano_limite)`.

---

## 5. Proposta Incremental de Implementação

### Sprint A — Completar enforcement existente (baixo risco)

| Item | Arquivo | Ação |
|---|---|---|
| A1 | `_qw16a_quota_campos.sql` | `ALTER TABLE cliente_quotas` — adiciona `vistorias_mes`, `ia_calls_mes`, `storage_gb` (nullable = sem limite) |
| A2 | `_qw16a_quota_campos.sql` | Recria `v_cliente_uso_mensal` incluindo novas métricas |
| A3 | `_qw16a_quota_campos.sql` | Trigger `fn_check_quota_usuarios` em `usuarios` BEFORE INSERT |
| A4 | `_qw16a_quota_campos.sql` | Trigger `fn_check_quota_levantamentos` em `levantamentos` BEFORE INSERT — bloqueia só acima de 150% |
| A5 | `src/types/database.ts` | Adiciona `vistorias_mes`, `ia_calls_mes`, `storage_gb` em `ClienteQuota` e `ClienteUsoMensal` |
| A6 | `src/services/api.ts` | `api.quotas.verificar` aceita novas métricas |
| A7 | `src/lib/quotaErrorHandler.ts` | Handler centralizado: captura ERRCODE `P0001` e exibe toast amigável |

### Sprint B — Enforcement UX e Edge Function (médio risco)

| Item | Arquivo | Ação |
|---|---|---|
| B1 | `triagem-ia-pos-voo/index.ts` | Check `ia_calls_mes` via `cliente_verificar_quota` antes de chamar Claude — retorna HTTP 402 |
| B2 | `src/pages/admin/AdminQuotas.tsx` | Adicionar painel com novas métricas (vistorias, IA, storage) |
| B3 | `src/components/QuotaBanner.tsx` | Mostrar aviso específico por métrica excedida |
| B4 | Frontend — criar levantamento | `api.quotas.verificar('levantamentos_mes')` antes de submeter — desabilita botão se excedido |
| B5 | Frontend — triagem IA | Toast explicativo quando receber HTTP 402 da Edge Function |
| B6 | `useOfflineQueue.ts` | Toast de aviso ao sincronizar se `vistorias_mes` excedido (nunca bloqueia) |

### Sprint C — Integração planos × quotas (alto valor, fecha QW-15+16)

| Item | Arquivo | Ação |
|---|---|---|
| C1 | `_qw16c_planos_quota_defaults.sql` | Adiciona `limite_vistorias_mes`, `limite_ia_calls_mes`, `limite_storage_gb` em `planos` |
| C2 | `_qw16c_planos_quota_defaults.sql` | Atualiza `cliente_verificar_quota` para `COALESCE(quota_individual, plano_limite)` |
| C3 | `_qw16c_planos_quota_defaults.sql` | Trigger `trg_seed_cliente_plano` passa limites do plano para `cliente_quotas` |
| C4 | `src/pages/admin/AdminClientes.tsx` | Exibir métricas de uso ao lado do plano |
| C5 | `_qw16c_surto.sql` | Campo `surto_ativo boolean` em `clientes` + bypass de quota em triggers |

### Sprint D — Observabilidade (opcional, após C)

| Item | Ação |
|---|---|
| D1 | `AdminSaudeSistema.tsx` — painel de clientes próximos ao limite (>85%) |
| D2 | Edge Function cron semanal — alerta admin plataforma por e-mail se cliente >85% |
| D3 | `audit_log` — registrar cada bloqueio de quota (quem tentou, métrica, timestamp) |

---

## 6. Impacto por Camada

| Camada | Sprint A | Sprint B | Sprint C |
|---|---|---|---|
| **Banco** | 2 triggers novos + ALTER TABLE | — | 1 migration planos + trigger seed |
| **RLS** | Sem mudança | Sem mudança | Sem mudança |
| **Edge Functions** | — | 1 check em triagem-ia | — |
| **Frontend** | `quotaErrorHandler` | `AdminQuotas`, `QuotaBanner`, botão levantamento | `AdminClientes` uso ao vivo |
| **Fluxo offline** | Sem mudança | Aviso no sync | Sem mudança |
| **Billing** | Sem mudança | Sem mudança | COALESCE plano × quota |
| **Jobs (QW-13)** | Sem mudança | Sem mudança | Sem mudança |

---

## 7. Riscos

| Risco | Mitigação |
|---|---|
| Operador bloqueado em campo durante surto | Vistorias nunca bloqueiam; surto suspende demais |
| Contagem errada por retry offline | Banco usa contagem por `date_trunc` — INSERT idempotente via trigger |
| Limite muito baixo frustra prefeitura durante pico de dengue | Carência 150% em levantamentos; surto suspende tudo |
| Trigger de levantamento quebra importação em massa | Carência de 150% + pode ser desabilitado temporariamente por admin |
| Triagem IA retorna 402 sem explicação no frontend | Sprint B B5 trata o erro com toast específico |
