# Mapa de SELECTs Diretos Remanescentes

**Auditado em:** 2026-04-11
**Critério:** arquivos `.ts`/`.tsx` fora de `src/services/api.ts` com `supabase.from()`

Tabelas sensíveis (exigem atenção especial):
`focos_risco`, `papeis_usuarios`, `vistorias`, `casos_notificados`, `levantamento_itens`, `usuarios`, `clientes`

---

## Tabela geral

| # | Arquivo | Tabela | Op | Filtro | Classificação | Justificativa |
|---|---|---|---|---|---|---|
| 1 | `src/lib/seedDefaultRiskPolicy.ts:91–140` | `sentinela_risk_defaults` e 8 tabelas `sentinela_risk_*` | INSERT | — (seed de criação de cliente) | PODE_PERMANECER | Utilitário de seed, não fluxo de usuário, tabelas de config de infraestrutura não sensíveis |
| 2 | `src/pages/agente/AgenteVistoria.tsx:30` | `focos_risco` | SELECT | `cliente_id` + `imovel_id` + soft-delete | MIGRAR_SPRINT | Tabela sensível; query correta mas inline em componente de página; extrair para `api.focosRisco.listByImovel()` |
| 3 | `src/pages/operador/OperadorFormularioVistoria.tsx:142` | `imoveis` | SELECT | `id` (PK) | PODE_PERMANECER | Leitura de 3 campos para label de UI; sem lógica de domínio; tabela não sensível |
| 4 | `src/hooks/useClienteAtivo.tsx:58` | `clientes` | SELECT | `ativo = true` | PODE_PERMANECER | Hook central de multitenancy; mover para api.ts criaria dependência circular |
| 5 | `src/hooks/useClienteAtivo.tsx:85` | `clientes` | SELECT | `id = userClienteId` | PODE_PERMANECER | Idem acima — mesmo hook, mesmo motivo |
| 6 | `src/pages/admin/AdminCanalCidadao.tsx:147` | `clientes` | SELECT | `id = clienteId` | MIGRAR_SPRINT | Leitura simples; deve ir para `api.clientes.get(id)` por consistência |
| 7 | `src/pages/admin/AdminClientes.tsx:120` | `clientes` | **UPDATE** | `id = id` | **MIGRAR_AGORA** | **Única escrita em tabela sensível fora de api.ts** — soft-delete de cliente deve estar em `api.clientes.softDelete(id)` |
| 8 | `src/pages/public/MunicipioPublico.tsx:16` | `clientes` | SELECT | `slug = slug` | PODE_PERMANECER | Página pública sem auth; apenas campos públicos (`id, nome, slug`); sem alternativa viável via api.ts |
| 9 | `src/pages/public/PortalDenuncia.tsx:220` | `clientes` | SELECT | `slug` ou `id` | PODE_PERMANECER | Idem acima — página pública sem auth |
| 10 | `src/hooks/mapa/useMapaFocosRealtime.ts:59` | — (Realtime) | `removeChannel` | — | PODE_PERMANECER | Limpeza de subscription Realtime; não é query de dados |
| 11 | `src/hooks/usePainelSLA.ts:119` | — (Realtime) | `removeChannel` | — | PODE_PERMANECER | Idem |
| 12 | `src/hooks/useRealtimeInvalidator.ts:44` | — (Realtime) | `removeChannel` | — | PODE_PERMANECER | Idem |
| 13 | `src/pages/gestor/GestorFocos.tsx:130` | — (Realtime) | `removeChannel` | — | PODE_PERMANECER | Idem |

---

## Ação imediata (MIGRAR_AGORA)

### AdminClientes.tsx:120 — UPDATE em `clientes`

**O que fazer:** Criar `api.clientes.softDelete(id: string)` em `src/services/api.ts`:

```typescript
clientes: {
  softDelete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('clientes')
      .update({ ativo: false, deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
},
```

E no componente substituir o `useMutation` local por chamada a `api.clientes.softDelete(id)`.

---

## Ações de sprint (MIGRAR_SPRINT)

### AgenteVistoria.tsx:30 — SELECT em `focos_risco`

Criar `api.focosRisco.listByImovel(clienteId, imovelId, since)` retornando `{ id, status, created_at, foco_anterior_id }[]`.

### AdminCanalCidadao.tsx:147 — SELECT em `clientes`

Criar `api.clientes.get(id)` retornando `{ id, nome, slug }`.

---

## Observação sobre `seedDefaultRiskPolicy.ts`

As 12 chamadas diretas em tabelas `sentinela_risk_*` são INSERTs executados apenas na criação de um novo cliente (seed). Não são chamadas em fluxo normal de usuário. A função é importada em `AdminClientes.tsx` no fluxo de cadastro de cliente. Pode permanecer como está — mover para `api.ts` não agrega valor de segurança ou manutenibilidade.

---

## Contagem por classificação

| Classificação | Quantidade |
|---|---|
| PODE_PERMANECER | 10 |
| MIGRAR_SPRINT | 2 |
| MIGRAR_AGORA | 1 |
| **Total** | **13** |
