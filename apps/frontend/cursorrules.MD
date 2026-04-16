# SentinellaWeb — Cursor AI Rules

## Contexto do projeto
Você está trabalhando no SentinellaWeb, uma plataforma para prefeituras realizarem
monitoramento e combate à dengue via levantamento de focos com drones e equipes
de campo. Stack: React + TypeScript + Vite + Supabase + Cloudinary.

## Domínio principal (use sempre estes nomes)
- cliente       → uma prefeitura
- planejamento  → organização da atividade (DRONE | MANUAL)
- levantamento  → execução prática vinculada ao planejamento
- levantamento_item → cada foco/evidência identificada
- operador      → usuário de campo que visita e resolve os itens
- plano_acao    → ações tomadas após validação do problema
- regiao/bairro → estruturas geográficas de organização
- sla_operacional → tempo esperado de atendimento por prioridade

## Arquitetura e regras obrigatórias
1. Separe sempre lógica de negócio da camada de UI
2. Toda query ao Supabase fica em src/services/api.ts ou em um hook dedicado
   em src/hooks/queries/
3. Dados compartilhados entre páginas usam React Query (useQuery/useMutation)
4. Formulários validam via Zod antes de persistir
5. Nunca acesse supabase diretamente em componentes de página — use hooks
6. Toda evidência deve manter vínculo: cliente_id, levantamento_id, item_id
7. Análises automáticas (YOLO, risco pluvial) devem ser auditáveis: grave
   sempre a fonte (config_fonte) e o score original

## Convenções de código
- Componentes: PascalCase em src/components/
- Hooks:       camelCase começando com "use" em src/hooks/
- Serviços:    camelCase em src/services/api.ts
- Tipos:       interfaces em src/types/database.ts
- Seeds:       seedDefault<Feature>.ts em src/lib/
- Imports:     sempre use alias @/ (ex: import { api } from "@/services/api")

## Padrão de hook de query
```typescript
// src/hooks/queries/useNomeFuncionalidade.ts
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";

export function useNomeFuncionalidade(clienteId: string) {
  return useQuery({
    queryKey: ["nome-funcionalidade", clienteId],
    queryFn: () => api.nomeFuncionalidade.list(clienteId),
    enabled: !!clienteId,
  });
}
```

## Padrão de serviço
```typescript
// Adicionar em src/services/api.ts dentro do objeto api:
nomeFuncionalidade: {
  list: async (clienteId: string): Promise<TipoRetorno[]> => {
    const { data, error } = await supabase
      .from("nome_tabela")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },
},
```

## SLA — fonte canônica

O prazo de SLA é **sempre** o campo `prazo_final` da tabela `sla_operacional`.
Calculado automaticamente pelos triggers `trg_levantamento_item_criar_sla_auto`
e `trg_after_insert_pluvio_item_sla` via `sla_calcular_prazo_final()`,
que aplica feriados e horário comercial configurados por cliente.

**NUNCA use `calcularSlaHoras()` de `src/types/sla.ts` para lógica de negócio.**
Essa função existe apenas para simulações visuais em formulários de configuração.
Está marcada como `@deprecated`.

- Para exibir o prazo: use `sla.prazo_final` (ISO 8601 do banco)
- Para criar um SLA: insira o `levantamento_item` — o trigger cria automaticamente
- Para verificar vencimento: `new Date() > new Date(sla.prazo_final)`

### Referência de regras de cálculo (apenas para configuração/simulação)
- P1/Crítico:    4h  (reduzir 30% se risco "Muito Alto")
- P2/Alta:       12h (reduzir 20% se persistência > 3 dias)
- P3/Moderada:   24h (reduzir 10% se temp > 30°C)
- P4/Baixa:      72h
- Mínimo sempre: 2h

## Risco pluvial — variáveis que impactam
chuva_mm, dias_sem_chuva, temperatura, vento, persistencia_7d, tendencia
→ lógica em seedDefaultRiskPolicy.ts / AdminRiskPolicy.tsx

## O que fazer ao receber uma tarefa
1. Identifique o domínio afetado (levantamento? sla? drone? operador?)
2. Verifique se o tipo já existe em src/types/database.ts
3. Se precisar de nova tabela, sugira a migration SQL antes de escrever código
4. Crie ou estenda o método em api.ts
5. Crie o hook em src/hooks/queries/
6. Implemente o componente/página consumindo o hook
7. Para novas features críticas, sugira seed em src/lib/

## Multitenancy — sempre verificar
Todo insert/select/update DEVE filtrar por cliente_id.
Nunca retorne dados de múltiplos clientes em uma mesma query de operador.

## Quando gerar código de migração Supabase
```sql
-- Sempre inclua RLS
ALTER TABLE nome_tabela ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cliente_isolado" ON nome_tabela
  USING (cliente_id = auth.uid());
  -- ajuste conforme a função de autenticação usada no projeto
```

## Prioridade de melhorias sugeridas (backlog imediato)
1. Push de SLA crítico — useSlaAlerts → Web Push API (service worker em Install.tsx)
2. Score YOLO visível ao operador — exibir score_final no card de levantamento_item
3. Rota otimizada no OperadorMapa — Google Maps Directions API (TSP simples)
4. Canal cidadão via QR — formulário público + tipo_entrada: MANUAL, fonte: cidadao
5. Falso positivo em campo — feedback para retroalimentar re-treino do modelo YOLO
6. Recorrência por endereço — usar LevantamentoItemRecorrencia já no database.ts
7. Alerta de janela pós-chuva — botão "Criar planejamento agora" no PluvioRiskWidget
8. Relatório automático semanal — Supabase Edge Function + reportPdf.ts existente

## Referências rápidas de arquivos-chave
- src/types/database.ts        → todos os tipos do domínio
- src/types/sla.ts             → SlaOperacional, calcularSlaHoras, SLA_RULES
- src/services/api.ts          → camada de acesso ao Supabase
- src/lib/seedDefaultRiskPolicy.ts → política de risco pluvial padrão
- src/lib/seedDefaultSlaConfig.ts  → configuração SLA padrão por cliente
- src/pages/operador/OperadorMapa.tsx → mapa do operador de campo
- src/pages/admin/AdminSla.tsx       → gestão de SLA
- src/hooks/useSlaAlerts.ts          → alertas de SLA (expandir para push)
- src/hooks/useOfflineStatus.ts      → detecta conexão (expandir para fila offline)

## Aggregate roots atualizados (março 2026)

| Entidade | Tabela | Papel |
|---|---|---|
| Foco de Risco | `focos_risco` | Aggregate root principal — ciclo de vida do risco (7 estados) |
| Imóvel | `imoveis` | Aggregate root da visita de campo |
| Levantamento Item | `levantamento_itens` | Item identificado em levantamento (drone ou manual) |
| Caso Notificado | `casos_notificados` | Notificação epidemiológica — cruzamento automático com focos |

## Soft delete — regra obrigatória (QW-10A)

As tabelas `focos_risco`, `casos_notificados`, `levantamento_itens` e `clientes`
têm `deleted_at timestamptz`. Todo SELECT de listagem nessas tabelas DEVE incluir:

```typescript
.is('deleted_at', null)
```

Exceção: relatórios de auditoria e comparativos históricos.

## Views — regra obrigatória (ADR-QW04)

Toda nova view deve ser criada com `WITH (security_invoker = true)`.
Sem esta diretiva, a view executa com privilégios do criador (bypassa RLS)
e expõe dados de todos os clientes para qualquer usuário autenticado.

## Namespaces novos em api.ts

Além dos namespaces documentados no CLAUDE.MD, existem:
- `api.quotas.usoMensal(clienteId)` → usa RPC `fn_meu_uso_mensal()`
- `api.quotas.usoMensalAll()` → usa RPC `fn_uso_mensal_todos_clientes()` (admin only)
- `api.jobQueue` — enfileirar e monitorar jobs assíncronos
- `api.offlineSyncLog` — registrar falhas de sync (operadores de campo)
- `api.auditLog` — consultar audit_log (admin/supervisor)
- `api.billing` — ciclos e snapshots de faturamento

## staleTime — OBRIGATÓRIO

Sempre usar constantes de `src/lib/queryConfig.ts`:

```typescript
import { STALE } from '@/lib/queryConfig';
// LIVE=0 | SHORT=1min | MEDIUM=3min | LONG=10min | MAP=10min | STATIC=30min
```

NUNCA usar números literais como `staleTime: 60000`.
