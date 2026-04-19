# SentinellaWeb — Cursor AI Rules

## Contexto do projeto

Plataforma B2G SaaS para prefeituras monitorarem e combaterem dengue.
**Stack:** React 18 + TypeScript + Vite + TanStack Query v5 + React Router v6 + Leaflet.

**Migração em andamento:** O projeto migrou do Supabase para backend NestJS próprio.
Use `@sentinella/api-client` para todas as chamadas HTTP. **Não use `supabase.from()` em código novo.**

## Domínio principal (use sempre estes nomes)

- `cliente`          → prefeitura
- `planejamento`     → organização da atividade (DRONE | MANUAL)
- `levantamento`     → execução prática vinculada ao planejamento
- `levantamento_item`→ cada foco/evidência identificada
- `foco_risco`       → aggregate root do evento de risco (state machine 7 estados)
- `agente`/`operador`→ usuário de campo (mesmo papel)
- `plano_acao`       → ações tomadas após identificação do problema
- `regiao`/`bairro`  → estruturas geográficas de organização
- `sla_operacional`  → prazo de atendimento por prioridade

## Arquitetura e regras obrigatórias

1. Lógica de negócio em hooks (`src/hooks/queries/`) — nunca em componentes de página
2. Toda chamada HTTP via `@sentinella/api-client` — nunca `supabase.from()` em código novo
3. Server state via TanStack Query (`useQuery` / `useMutation`)
4. `staleTime` obrigatório: usar constantes `STALE` de `src/lib/queryConfig.ts`
5. Formulários validam via Zod antes de persistir
6. `clienteId` sempre via `useClienteAtivo()` — nunca hardcoded
7. Toda evidência mantém vínculo: `cliente_id`, `levantamento_id`, `item_id`
8. Análises automáticas (YOLO, risco pluvial) preservam `config_fonte` e `score_final`

## Convenções de código

```
Componentes:  PascalCase         → src/components/
Hooks:        camelCase "use..."  → src/hooks/queries/
Serviços:     camelCase           → src/services/api/
Tipos:        PascalCase          → src/types/database.ts
Imports:      alias @/            → import { http } from '@sentinella/api-client'
```

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

## Padrão de serviço

```typescript
// src/services/api/nome-dominio.ts
import { http } from '@sentinella/api-client';

export const nomeDominioService = {
  list: (clienteId: string) =>
    http.get('/nome-rota', { params: { clienteId } }),

  create: (body: CreateNomeBody) =>
    http.post('/nome-rota', body),

  update: (id: string, body: Partial<NomeTipo>) =>
    http.put(`/nome-rota/${id}`, body),
};
```

## SLA — fonte canônica

O prazo de SLA é **sempre** `sla_operacional.prazo_final` (campo do banco).
`calcularSlaHoras()` e `SLA_RULES` são `@deprecated` — apenas para simulações visuais.

- Para exibir: `sla.prazo_final` (ISO 8601)
- Para verificar vencimento: `new Date() > new Date(sla.prazo_final)`
- SLA criado automaticamente pelo backend ao transicionar foco para `confirmado`

## Focos de risco — state machine

```
suspeita → em_triagem → aguarda_inspecao → em_inspecao → confirmado → em_tratamento → resolvido
                                                                                     → descartado
```

Transições via `POST /focos-risco/:id/transicionar`.
`resolvido` e `descartado` são terminais — não reabre; cria novo foco com `foco_anterior_id`.

## Score YOLO — normalização obrigatória

```typescript
function normalizeScore(raw: number | null | undefined): number | null {
  if (raw == null) return null;
  return raw > 1 ? raw / 100 : raw; // pipeline grava 0–1 ou 0–100
}
// >= 0.85 Muito alta | >= 0.65 Alta | >= 0.45 Média | < 0.45 Baixa
```

## Multitenancy — sempre verificar

```typescript
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
const { clienteId } = useClienteAtivo(); // SEMPRE assim — nunca hardcoded
```

Toda query DEVE filtrar por `clienteId`. Nunca retornar dados de múltiplos clientes.

## Risco pluvial — variáveis do modelo

`chuva_mm`, `dias_sem_chuva`, `temperatura` (ótimo 25–30°C), `vento` (redutor >13 km/h), `persistencia_7d`, `tendencia`.
Janela crítica: **3–6 dias após chuva intensa**.
Lógica em `src/lib/seedDefaultRiskPolicy.ts`.

## Regras importantes

- `casos_notificados` não armazena nome, CPF ou data de nascimento (LGPD)
- `logEvento()` é fire-and-forget — nunca `await`, nunca captura exceção
- `platform_admin` não existe — nunca criar usuário com esse papel
- `agente` e `operador` são o mesmo papel
- Soft delete: filtrar `deleted_at IS NULL` em `focos_risco`, `levantamento_itens`, `clientes`

## O que fazer ao receber uma tarefa

1. Identificar o domínio (levantamento? sla? drone? agente? pluvio?)
2. Verificar se o tipo já existe em `src/types/database.ts`
3. Verificar se o hook já existe em `src/hooks/queries/`
4. Criar ou estender o service em `src/services/api/`
5. Criar o hook em `src/hooks/queries/`
6. Implementar o componente/página consumindo o hook
7. Nunca acessar `http` diretamente em componentes de página

## Arquivos-chave

| Arquivo | Responsabilidade |
|---|---|
| `src/types/database.ts` | Todos os tipos do domínio |
| `src/lib/queryConfig.ts` | Constantes STALE/GC — obrigatório em todos os hooks |
| `src/lib/offlineQueue.ts` | Fila IndexedDB para operações offline |
| `src/lib/transicoesFoco.ts` | Transições válidas de focos_risco |
| `src/lib/mapStatusOperacional.ts` | `mapFocoToStatusOperacional()` — 7→3 estados visuais |
| `src/lib/pilotoEventos.ts` | `logEvento()` — instrumentação IA (fire-and-forget) |
| `src/hooks/useClienteAtivo.tsx` | Hook central de multitenancy |
