# Ações do SLA Operacional

## Quais ações um SLA pode ter

O SLA operacional tem **status** e, conforme o status, a coluna **Ações** no Painel Operacional exibe botões diferentes.

| Status             | Ação na UI        | O que acontece |
|--------------------|-------------------|----------------|
| **Pendente**       | **Iniciar**       | Status → `em_atendimento`; cria ou atualiza operação `em_andamento` e associa o operador. |
| **Em atendimento** | **Concluir**      | Abre o diálogo de conclusão (evidências + observação); ao salvar, status → `concluido` e trigger no banco atualiza `sla_operacional.concluido_em`. |
| **Concluído**      | **Reabrir** (admin/supervisor) | Volta status para `pendente` e zera `concluido_em`; o item volta a aparecer como pendente. |
| **Vencido**        | —                 | Nenhum botão (prazo estourado). |

- **Onde está:** `src/pages/Operador.tsx` → componente `SlaActions` e mutation `updateStatusMutation`.
- **Conclusão com evidências:** `src/components/operador/ConcluirSlaDialog.tsx`.
- **API:** `api.sla.updateStatus(slaId, { status })`, `api.sla.reabrir(slaId)` e `api.operacoes.ensureEmAndamento(...)` em `src/services/api.ts`.

No **Admin** (`AdminSla.tsx`) há ainda: atribuir operador (select) e forçar **Iniciar** / **Concluir** independente de quem está logado.

---

## Como implementar novas ações

Exemplos: **Reabrir** (concluído → pendente), **Escalar** (aumentar prioridade e recalcular prazo), **Transferir** (trocar operador).

### 1. Backend (Supabase)

- **Transições permitidas:** a tabela `sla_operacional` hoje é atualizada via `update` genérico. Se quiser regras rígidas, use RPC ou CHECK/trigger que só permita certas mudanças de `status`.
- **Reabrir:** RPC ou PATCH que faça `status = 'pendente'`, `concluido_em = null`, e opcionalmente `operador_id = null`.
- **Escalar:** RPC que receba nova prioridade, chame a lógica de cálculo de SLA (ex.: `sla_horas_from_config` ou equivalente), atualize `sla_operacional` (prioridade, `prazo_final`, `sla_horas`) e marque `escalonado = true` se já existir esse campo.

### 2. API (front)

Em `src/services/api.ts`, dentro do objeto `sla`, adicionar por exemplo:

```ts
reabrir: async (slaId: string): Promise<void> => {
  await api.sla.updateStatus(slaId, { status: 'pendente', concluido_em: null });
},
escalar: async (slaId: string, novaPrioridade: string): Promise<void> => {
  // Chamar RPC no Supabase que recalcula prazo e atualiza o registro
  const { error } = await supabase.rpc('escalar_sla_operacional', { p_sla_id: slaId, p_prioridade: novaPrioridade });
  if (error) throw error;
},
```

### 3. UI (Painel Operador)

Em `SlaActions`, para o status em que a ação faz sentido (ex.: `concluido` para Reabrir):

- Renderizar o botão (ex.: "Reabrir").
- Disparar uma mutation que chame `api.sla.reabrir(sla.id)` (ou a nova função).
- No `onSuccess` da mutation, invalidar a query dos SLAs (ex.: `queryClient.invalidateQueries({ queryKey: ['sla_panel', clienteId] })`) para a lista atualizar.

Exemplo mínimo de botão:

```tsx
{sla.status === 'concluido' && isAdmin && (
  <Button size="sm" variant="outline" className="h-7 text-[10px]" disabled={loading}
    onClick={() => reabrirMutation.mutate({ slaId: sla.id })}>
    Reabrir
  </Button>
)}
```

Assim, as ações possíveis hoje (Iniciar, Concluir) continuam iguais; novas ações (Reabrir, Escalar, etc.) seguem o mesmo padrão: backend permitindo a transição, função na API e botão + mutation no `SlaActions`.
