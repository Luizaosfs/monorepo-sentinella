# CLAUDE.md — sentinella-frontend

## Visão geral

Frontend React do Sentinella Web — plataforma B2G SaaS de vigilância entomológica municipal.

**Stack:** React 18.3 · Vite · TypeScript 5.7 · TanStack Query v5 · React Router v6 · Zod · Leaflet 1.9 · Shadcn/Radix UI

**Contexto de migração:** O projeto migrou do Supabase para backend NestJS próprio.
A autenticação e todas as queries agora passam pelo `@sentinella/api-client` (HTTP + JWT).
O `supabase-js` ainda está presente como dependência legada em transição — não usar em código novo.

---

## Domínio (use sempre estes nomes)

- `cliente` — prefeitura
- `regiao` / `bairro` — estruturas geográficas de organização
- `planejamento` — organização da atividade (DRONE | MANUAL)
- `levantamento` — execução prática vinculada ao planejamento
- `levantamento_item` — cada foco/evidência identificada
- `foco_risco` — aggregate root do evento de risco (state machine 7 estados)
- `agente` / `operador` — usuário de campo (mesmo papel, dois nomes)
- `plano_acao` — ações tomadas após identificação do problema
- `sla_operacional` — prazo de atendimento por prioridade
- `vistoria` — visita de campo a um imóvel

---

## Arquitetura obrigatória

1. Lógica de negócio fica em hooks (`src/hooks/queries/`) — nunca em componentes de página
2. Toda chamada HTTP usa `@sentinella/api-client` — nunca `supabase.from()` em código novo
3. Server state via TanStack Query (`useQuery` / `useMutation`)
4. `staleTime` obrigatório: usar constantes de `src/lib/queryConfig.ts`
5. Formulários validam via Zod (`@sentinella/contracts`) antes de submeter
6. `clienteId` sempre via `useClienteAtivo()` — nunca hardcoded
7. Toda evidência mantém vínculo: `cliente_id`, `levantamento_id`, `item_id`
8. Análises automáticas (YOLO, risco pluvial) devem preservar `config_fonte` e `score_final`

---

## Convenções de código

```
Componentes:  PascalCase         → src/components/
Hooks:        camelCase "use..."  → src/hooks/
Serviços:     camelCase           → src/services/api/
Tipos:        PascalCase          → src/types/database.ts
Imports:      alias @/            → import { http } from '@sentinella/api-client'
```

---

## Padrão de hook de query

```typescript
// src/hooks/queries/useNomeFuncionalidade.ts
import { useQuery } from '@tanstack/react-query';
import { http } from '@sentinella/api-client';
import { STALE } from '@/lib/queryConfig';

export function useNomeFuncionalidade(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['nome-funcionalidade', clienteId],
    queryFn: () => http.get('/nome-rota', { params: { clienteId } }),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM, // LIVE=0 SHORT=1min MEDIUM=3min LONG=10min STATIC=30min
  });
}
```

## Padrão de serviço (src/services/api/)

```typescript
// src/services/api/focos-risco.ts
import { http } from '@sentinella/api-client';

export const focosRiscoService = {
  list: (clienteId: string) =>
    http.get('/focos-risco', { params: { clienteId } }),

  create: (body: CreateFocoRiscoBody) =>
    http.post('/focos-risco', body),

  update: (id: string, body: Partial<FocoRisco>) =>
    http.put(`/focos-risco/${id}`, body),
};
```

---

## Multitenancy — sempre verificar

Para obter `clienteId`, **sempre** usar:

```typescript
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
const { clienteId } = useClienteAtivo();
```

Toda query DEVE incluir `clienteId` como parâmetro. Nunca retornar dados de múltiplos clientes.

---

## SLA — fonte canônica

O prazo de SLA é **sempre** `sla_operacional.prazo_final` (campo do banco).

- Para exibir: usar `sla.prazo_final` (ISO 8601)
- Para verificar vencimento: `new Date() > new Date(sla.prazo_final)`
- Para criar SLA: o backend cria automaticamente ao transicionar foco para `confirmado`

`calcularSlaHoras()` e `SLA_RULES` em `src/types/sla.ts` são `@deprecated` — apenas para simulações visuais.

| Prioridade | SLA padrão |
|---|---|
| P1 | 4h |
| P2 | 12h |
| P3 | 24h |
| P4 | 72h |
| P5 | 168h (7d) |
| Mínimo absoluto | 2h |

---

## Focos de risco — state machine

```
suspeita → em_triagem → aguarda_inspecao → em_inspecao → confirmado → em_tratamento → resolvido
                      ↘                 ↘             ↘           ↘              ↘ descartado
```

- Transições via endpoint `POST /focos-risco/:id/transicionar` — nunca PATCH direto de `status`
- `resolvido` e `descartado` são terminais — não reabre; cria novo foco com `foco_anterior_id`
- SLA começa a contar em `confirmado_em`, não em `suspeita_em`
- `foco_risco_historico` é append-only — nunca alterar

---

## Score YOLO — normalização obrigatória

O pipeline Python pode gravar `score_final` como `0–1` ou `0–100`. Sempre normalizar:

```typescript
function normalizeScore(raw: number | null | undefined): number | null {
  if (raw == null) return null;
  return raw > 1 ? raw / 100 : raw;
}
// >= 0.85 → Muito alta | >= 0.65 → Alta | >= 0.45 → Média | < 0.45 → Baixa
```

Itens com `tipo_entrada === 'MANUAL'` não têm score — exibir "Entrada manual".

---

## Soft delete — obrigatório

Tabelas `focos_risco`, `casos_notificados`, `levantamento_itens`, `clientes` têm `deleted_at`.
Toda listagem deve filtrar por registros ativos (o backend faz isso, mas hooks devem estar cientes).

---

## Regras de domínio importantes

- `casos_notificados` não armazena nome, CPF ou data de nascimento (LGPD)
- Cruzamento caso ↔ foco é feito pelo backend (trigger + Use Case) — nunca replicar no frontend
- `levantamento_itens.cliente_id` é denormalizado via trigger — nunca setar manualmente
- `score_prioridade` em `focos_risco` é calculado pelo trigger — não atualizar manualmente
- `logEvento()` (piloto_eventos) é fire-and-forget — nunca `await`, nunca captura exceção
- `platform_admin` não existe — nunca criar usuário com esse papel

---

## Arquivos-chave

| Arquivo | Responsabilidade |
|---|---|
| `src/types/database.ts` | Todos os tipos do domínio |
| `src/lib/queryConfig.ts` | Constantes STALE/GC — obrigatório em todos os hooks |
| `src/lib/offlineQueue.ts` | Fila IndexedDB para operações offline |
| `src/lib/transicoesFoco.ts` | Mapeamento de transições válidas de focos_risco |
| `src/lib/mapStatusOperacional.ts` | `mapFocoToStatusOperacional()` — 7→3 estados visuais |
| `src/lib/pilotoEventos.ts` | `logEvento()` — instrumentação IA (fire-and-forget) |
| `src/hooks/useClienteAtivo.tsx` | Hook central de multitenancy |
| `src/hooks/use-mobile.tsx` | `useIsMobile()` — breakpoint 768px |

---

## O que fazer ao receber uma tarefa

1. Identificar o domínio (levantamento? sla? drone? agente? pluvio?)
2. Verificar se o tipo já existe em `src/types/database.ts`
3. Verificar se o hook já existe em `src/hooks/queries/`
4. Criar ou estender o service em `src/services/api/`
5. Criar o hook em `src/hooks/queries/`
6. Implementar o componente consumindo o hook
7. Nunca acessar `http` diretamente em componentes de página — sempre via hook
