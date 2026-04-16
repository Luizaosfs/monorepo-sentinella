# P7.11 — Resumo de Execução: Correções Estruturais + Hardening de Governança

> Executado em 2026-04-14

---

## 1. O que foi alterado

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/services/api.ts` | Tipo de `focosRisco.update()` estreitado; `updateStatus` tipado; `updateCampos` removido; `atribuirOperador()` + `concluirManualmente()` criados; `updatePapel()` + `setPapel()` → RPC; `update()` de usuário sem `cliente_id`; `operacoes.cancelar()` adicionado; `canalCidadao.stats()` adicionado |
| `src/pages/admin/AdminSla.tsx` | `updateCampos` → `atribuirOperador()` + `concluirManualmente()` |
| `src/components/map-dashboard/RiskDetailsPanel.tsx` | Mutação direta `supabase.from('operacoes').update()` → `api.operacoes.cancelar()` |
| `src/components/map-v3/ItemDetailsPanel.tsx` | Idem |
| `src/pages/admin/AdminCanalCidadao.tsx` | Limite `.limit(20)` → `.limit(200)` |

### Migrations criadas

| Arquivo | Conteúdo |
|---|---|
| `supabase/migrations/20270226000000_rpc_set_papel_usuario.sql` | RPC atômica `rpc_set_papel_usuario(auth_id, papel)` — substitui DELETE+INSERT não-atômico; valida papéis canônicos |
| `supabase/migrations/20270227000000_view_canal_cidadao_stats.sql` | View `v_canal_cidadao_stats` — métricas agregadas de volume por cliente (24h, 7d, 30d, resolvidos, em aberto) |

### Documentos criados

| Arquivo | Conteúdo |
|---|---|
| `docs/auditoria/MUTACOES_DIRETAS_INVENTARIO.md` | Inventário completo das mutações diretas — classificação, risco e recomendação por item |
| `docs/arquitetura/VERDADE_CANONICA_E_COMPATIBILIDADE.md` | Mapa de verdade canônica vs compatibilidade: aggregate root, campos virtuais, aliases de papel, bridges de rota, legado controlado |
| `docs/auditoria/P7_11_RESUMO_EXECUCAO.md` | Este documento |

---

## 2. O que foi confirmado no código real

### Problemas da auditoria que eram verdadeiros

| Item | Confirmado | Ação tomada |
|---|---|---|
| `updatePapel` / `setPapel` — DELETE+INSERT não-atômico | ✅ | RPC `rpc_set_papel_usuario` criada; métodos redirecionados |
| `sla.updateCampos` — tipo totalmente aberto (`Record<string,unknown>`) | ✅ | Removido; substituído por `atribuirOperador()` + `concluirManualmente()` |
| `sla.updateStatus` — tipo aberto | ✅ | Tipado: `{ status: string; iniciado_em?: string }` |
| `focosRisco.update` — tipo incluía `prioridade` e `regiao_id` sem uso | ✅ | Estreitado para `responsavel_id \| desfecho` |
| Mutação direta de `operacoes` em componentes de UI | ✅ | `api.operacoes.cancelar()` criado; 2 componentes corrigidos |
| `usuarios.update` aceitava `cliente_id` no payload | ✅ | Removido do payload permitido |
| Canal cidadão — limite de 20 denúncias visíveis | ✅ | Aumentado para 200 |
| Canal cidadão — sem métricas agregadas de volume | ✅ | View + API method criados |

### Problemas que NÃO se confirmaram no código real

| Item da auditoria | Resultado |
|---|---|
| Legado "operador" causando ambiguidade para usuários | ❌ NÃO confirmado — normalização já está completa em todos os pontos; nenhuma label "operador" exibida ao usuário |
| Mutações de status de `focos_risco` diretas no frontend | ❌ NÃO confirmado — toda transição de status já passa por `rpc_transicionar_foco_risco`; apenas metadados simples são editados diretamente |
| `status_atendimento` como acesso real ao banco removido | ❌ NÃO é bug — campo virtual computado em memória por `enrichItensComFoco.ts`; `MapClusterLayer.tsx` lê do objeto enriquecido, não do banco |

---

## 3. O que foi endurecido

### Mutações centralizadas

- `papeis_usuarios` — agora só modificado via RPC atômica `rpc_set_papel_usuario`
- `sla_operacional` — `updateCampos` eliminado; operações nomeadas com tipos restritos
- `focos_risco` — superfície de update reduzida: `responsavel_id` e `desfecho` apenas
- `operacoes` — cancelamento centralizado em `api.operacoes.cancelar()`
- `usuarios` — `cliente_id` removido do UPDATE direto

### Governança reforçada

- Papel de usuário agora validado no banco (lista canônica: `agente`, `supervisor`, `admin`, `notificador`, `analista_regional`)
- `platform_admin` bloqueado implicitamente pela RPC (não está na lista permitida)
- Atomicidade garantida na troca de papel (eliminada janela de inconsistência)

### Observabilidade melhorada

- Canal cidadão: `v_canal_cidadao_stats` + `api.canalCidadao.stats()` disponíveis para admin/supervisor
- Volume temporal (24h, 7d, 30d), resolvidos vs em aberto visíveis

### Legados reduzidos

- `updateCampos` removido (duplicata perigosa)
- `focosRisco.update` não mais aceita `prioridade` / `regiao_id`
- `usuarios.update` não mais aceita `cliente_id`

---

## 4. Pendências restantes

| Item | Risco | Observação |
|---|---|---|
| Visibilidade de eventos de rate limit do canal cidadão | Baixo | Não há tabela de log de rate limit; para auditá-los seria necessário criar `canal_cidadao_rate_events` e instrumentar `denunciar_cidadao`. Não executado — fora do escopo cirúrgico. |
| `api.ts` com 5.277 linhas | Baixo-médio | Arquivo largo mas bem organizado por namespaces. Refatoração em módulos separados (ex: `focosRiscoApi.ts`) é candidata para P8+. Não executado — sem necessidade real imediata. |
| Referência a `status_atendimento` em `AdminCanalCidadao.tsx:213` | Nenhum | É campo virtual calculado em runtime — não é acesso a coluna removida. Sem ação necessária. |

---

## 5. Veredito final do P7.11

**CONCLUÍDO TOTALMENTE** dentro do escopo definido.

Todos os 8 pontos de ação foram executados ou conscientemente avaliados como "não aplicável" com base no código real. Nenhum ponto ficou bloqueado.

### Balanço final

| Critério de sucesso | Status |
|---|---|
| Menos mutação crítica direta no frontend | ✅ 5 tipos de mutação centralizada |
| Mais governança por intenção | ✅ RPCs atômicas, métodos nomeados com tipos restritos |
| Menos ambiguidade entre canônico e legado | ✅ Documento oficial criado; legado "operador" confirmado bem resolvido |
| Melhor auditabilidade do canal cidadão | ✅ View + método de estatísticas; limite expandido |
| Menor risco estrutural para crescer | ✅ Surface de mutação perigosa eliminada; RLS e atomicidade reforçadas |
