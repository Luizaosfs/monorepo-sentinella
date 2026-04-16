# CLAUDE.md

## Nome do projeto
SentinelaWeb

## Objetivo
O Sentinela é uma plataforma para prefeituras e operadores de campo realizarem monitoramento e tratamento de possíveis focos relacionados à dengue.

O sistema combina planejamento operacional, levantamentos em campo, voos com drone, análise automática de imagens e acompanhamento das ações corretivas.

## Público-alvo
- Prefeituras
- Equipes de vigilância
- Operadores de campo
- Gestores

## Visão geral do negócio
Cada cliente é uma prefeitura com regiões, bairros e áreas de atuação.
A equipe cria planejamentos de trabalho executados de duas formas: Drone ou Manual.

## Fluxo principal — Drone
1. Planejamento vinculado a uma região/bairro.
2. Voo executado no sistema Sentinela em Python.
3. Imagens capturadas → extração de metadados com ExifTool → análise com YOLO.
4. Cada problema identificado gera: `levantamento_item` + imagem no Cloudinary.
5. Operador vai ao local, evidencia o problema e aplica plano de ação.

## Fluxo principal — Manual
1. Planejamento manual vinculado à região/bairro.
2. Operador executa a vistoria manualmente.
3. Problemas identificados geram registros no levantamento e em `levantamento_item`.
4. Operador evidencia o problema e aplica plano de ação.

## Conceitos do domínio
- **Cliente** — prefeitura
- **Região / Bairro** — estruturas geográficas para organizar planejamento e execução
- **Planejamento** — organização da atividade (drone ou manual)
- **Levantamento** — execução prática associada ao planejamento; conjunto de evidências
- **Levantamento Item** — cada problema, foco ou evidência identificada
- **Operador** — verifica o local, evidencia o problema e aplica ações corretivas
- **Plano de ação** — conjunto de ações tomadas após identificação e validação do problema

## Tecnologias principais
- Python + ExifTool + YOLO — processamento de voo e análise de imagens
- Supabase / PostgreSQL — armazenamento
- Cloudinary — imagens evidenciadas ou recortes relevantes
- Aplicação web React + TypeScript — gestão operacional

## Diretrizes arquiteturais
- Separar regras de negócio da infraestrutura
- Evitar lógica de negócio em controllers ou handlers
- Nomes de domínio claros: `planejamento`, `levantamento`, `levantamento_item`, `operador`, `plano_acao`, `cliente`, `regiao`, `bairro`
- Preservar rastreabilidade entre planejamento, levantamento e evidências
- Toda análise automática deve ser auditável
- Toda evidência mantém vínculo com cliente, região/bairro, levantamento e item

## Regras importantes
- **LGPD**: `casos_notificados` NÃO armazena nome, CPF, data de nascimento ou qualquer identificador direto — apenas endereço e bairro
- O cruzamento caso↔foco é feito exclusivamente pelo trigger `trg_cruzar_caso_focos` no banco — nunca replicar no frontend
- `caso_foco_cruzamento` é preenchido somente pelo trigger — nunca inserir manualmente
- **`platform_admin`** é valor morto no enum `papel_app` — nenhum usuário deve tê-lo; usar `admin` como nível máximo
- **`levantamento_itens.cliente_id`** é denormalizado via trigger `trg_levantamento_itens_set_cliente_id` — nunca setar manualmente
- **`levantamentos.total_itens`** é mantido pelo trigger `trg_sync_total_itens` — não calcular no frontend
- **`usuarios.ativo`** (boolean, DEFAULT true) — filtrar por `ativo = true` em listagens de equipe
- **RPC `denunciar_cidadao`** retorna `{ ok, foco_id, deduplicado }` — protocolo = primeiros 8 chars do `foco_id`

## O que o assistente deve considerar ao sugerir código
- Respeitar o domínio da aplicação e manter escalabilidade para múltiplos clientes
- Evitar acoplamento entre processamento de drone e fluxo manual
- Facilitar integração com Supabase e Cloudinary
- Facilitar auditoria e rastreabilidade
- Manter possibilidade de expansão do SLA e regras climáticas

## Estilo de resposta esperado
- Explique rapidamente o objetivo
- Use nomes consistentes com o domínio
- Priorize clareza e manutenção
- Evite abstrações desnecessárias

---

## Mapa de arquivos-chave

**Antes de criar qualquer código**, verifique se o tipo, hook ou método já existe.
→ Mapa completo em `docs/FILE_MAP.md`

Arquivos centrais não-óbvios:

| Arquivo | Responsabilidade |
|---|---|
| `src/types/database.ts` | Todos os tipos do domínio |
| `src/services/api.ts` | Camada única de acesso ao Supabase |
| `src/lib/queryConfig.ts` | Constantes STALE/GC — usar em todos os hooks |
| `src/lib/offlineQueue.ts` | Fila IndexedDB para operações offline |
| `src/lib/transicoesFoco.ts` | State machine de transições de focos_risco |
| `src/lib/mapStatusOperacional.ts` | Mapeamento 8→3 estados (`mapFocoToStatusOperacional`) |
| `src/lib/pilotoEventos.ts` | `logEvento()` fire-and-forget — instrumentação IA |
| `src/hooks/useClienteAtivo.tsx` | Hook central de multitenancy — sempre use para obter clienteId |
| `src/hooks/use-mobile.tsx` | `useIsMobile()` — breakpoint 768px |

---

## Padrões de código estabelecidos

### Hook de query

```typescript
// src/hooks/queries/useNomeFuncionalidade.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';

export function useNomeFuncionalidade(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['nome-funcionalidade', clienteId],
    queryFn: () => api.nomeFuncionalidade.list(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM, // LIVE=0, SHORT=1min, MEDIUM=3min, LONG=10min, STATIC=30min
  });
}
```

### Método em api.ts

```typescript
nomeFuncionalidade: {
  list: async (clienteId: string): Promise<TipoRetorno[]> => {
    const { data, error } = await supabase
      .from('nome_tabela')
      .select('*')
      .eq('cliente_id', clienteId)  // OBRIGATÓRIO — multitenancy
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
},
```

### Migration Supabase com RLS

```sql
CREATE TABLE nome_tabela (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE nome_tabela ENABLE ROW LEVEL SECURITY;

CREATE POLICY "isolamento_por_cliente" ON nome_tabela
  USING (public.usuario_pode_acessar_cliente(cliente_id));

CREATE INDEX ON nome_tabela (cliente_id);
```

---

## Regras de multitenancy — crítico

**Toda** query deve ser filtrada por `cliente_id`. Sem exceção.

```typescript
// ERRADO — vaza dados entre clientes
const { data } = await supabase.from('levantamento_itens').select('*');

// CORRETO
const { data } = await supabase
  .from('levantamento_itens')
  .select('*, levantamento:levantamentos!inner(*)')
  .eq('levantamento.cliente_id', clienteId);
```

Para obter o `clienteId`, **sempre** use o hook centralizado:

```typescript
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
const { clienteId } = useClienteAtivo();
```

### Padrão RLS obrigatório

```sql
-- CORRETO
USING (public.usuario_pode_acessar_cliente(cliente_id))

-- PROIBIDO — padrão legado
USING (cliente_id IN (SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()))
```

---

## Regras de SLA

SLA criado automaticamente quando foco transiciona para `confirmado` (trigger `fn_iniciar_sla_ao_confirmar_foco`).
Fonte de verdade: `sla_config` no banco — configurável por cliente e por região.

| Prioridade | SLA padrão | Mnemônico |
|---|---|---|
| P1 | 4h | Crítico — próximo a caso notificado |
| P2 | 12h | Alto — score YOLO alto |
| P3 | 24h | Médio — padrão geral |
| P4 | 72h | Baixo — monitoramento |
| P5 | 168h (7d) | Mínimo — rastreamento |
| **Mínimo absoluto** | **2h** | sempre |

`SLA_RULES` em `src/types/sla.ts` é `@deprecated`.
`calcularSlaHoras()` no frontend é estimativa visual — não usar para decisões de negócio.

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

## Risco pluvial — variáveis do modelo

Definido em `src/lib/seedDefaultRiskPolicy.ts`:
- `chuva_mm`, `dias_sem_chuva`, `temperatura` (ótimo 25–30°C), `vento` (redutor >13 km/h), `persistencia_7d`, `tendencia`

Janela crítica: **3–6 dias após chuva intensa** (larvas em desenvolvimento ativo).

---

## Módulo focos_risco — regras críticas

### State machine (8 estados)

```
suspeita → em_triagem → aguarda_inspecao → em_inspecao → confirmado → em_tratamento → resolvido
                                                                                      → descartado
```

| Estado | Transições permitidas |
|---|---|
| `suspeita` | `em_triagem`, `descartado` |
| `em_triagem` | `aguarda_inspecao`, `descartado` |
| `aguarda_inspecao` | `em_inspecao`, `confirmado`, `descartado` |
| `em_inspecao` | `confirmado`, `descartado` |
| `confirmado` | `em_tratamento`, `descartado` |
| `em_tratamento` | `resolvido`, `descartado` |

### Invariantes
- **`rpc_transicionar_foco_risco` é a ÚNICA forma de mudar status** — nunca UPDATE direto
- `resolvido` e `descartado` são terminais — não reabre; cria novo foco com `foco_anterior_id`
- SLA começa a contar em `confirmado_em`, não em `suspeita_em`
- `foco_risco_historico` é append-only — nunca UPDATE/DELETE
- `api.itens.updateAtendimento` é **no-op** — mantido apenas para compatibilidade legada
- **Colunas REMOVIDAS de `levantamento_itens`** (migration 20260711): `status_atendimento`, `acao_aplicada`, `data_resolucao`, `checkin_em`, `checkin_latitude`, `checkin_longitude`, `observacao_atendimento` — não referenciar
- `score_prioridade` é calculado pelo trigger `trg_recalcular_score_prioridade` — não atualizar manualmente

---

## Módulo reinspecoes — regras críticas

- Ao entrar em `em_tratamento` → trigger cria reinspeção automática pendente (7 dias)
- Ao resolver/descartar foco → trigger cancela todas reinspeções pendentes
- Máx. 1 reinspeção pendente por `(foco_risco_id, tipo)` — unique partial index
- Resultado `resolvido` + `pode_resolver_foco=true` → frontend oferece botão para encerrar foco
- `fn_marcar_reinspecoes_vencidas()` roda via cron 06h UTC

---

## Módulo piloto_eventos — regras

- `logEvento()` é sempre fire-and-forget — nunca usar `await`, nunca lança exceção
- INSERT policy usa `usuarios.cliente_id` diretamente para evitar overhead em logging

---

## Módulo IA Pilot — regras

- Cache `ia_insights` verificado ANTES de chamar Claude Haiku — custo zero quando válido
- `force_refresh=true` no body ignora cache e força nova geração

---

## Módulo CNES — regras

- `uf` + `ibge_municipio` no cliente são obrigatórios para sync
- Unidades com `origem='manual'` e `cnes IS NULL` nunca são inativadas pela sync
- Inativação suave: `ativo=false`, nunca DELETE

---

## Módulo acesso a imóveis — regras

- 3 tentativas sem acesso → trigger eleva `prioridade_drone=true` no imóvel automaticamente
- `v_imovel_historico_acesso` é somente-leitura — nunca inserir manualmente
- Calhas inacessíveis devem atualizar `calha_acessivel=false` no perfil do imóvel

---

## Correções de segurança (não reverter)

- **S01** `platform_admin` neutralizado: dead value no enum, `is_platform_admin()` dropada
- **S02** `pluvio_risco` — isolamento via `usuario_pode_acessar_cliente()`, não USING(true)
- **S03** `fn_cruzar_caso_com_focos` usa `focos_risco` direto (sem `status_atendimento`)
- **S04** `denunciar_cidadao` cria `foco_risco` direto com rate limit 5/min
- **A01** `levantamento_itens.cliente_id` denormalizado — trigger auto-preenche em INSERT

### Migrations com código obsoleto (NÃO re-executar isoladamente)

| Migration | Problema |
|---|---|
| `20250318000000` | `fn_cruzar_caso_com_focos` usa `status_atendimento` (removida) |
| `20260604000000` | `fn_validar_transicao_status_atendimento` usa `status_atendimento` (removida) |
| `20260710030000` | `fn_cruzar_caso_com_focos` usa `status_atendimento` (removida) |
| `20260701000000` | Cria `is_platform_admin()` — revertido em `20260702000000` |
| `20260720000000` | `denunciar_cidadao` insere em `levantamento_itens` — substituído em `20260915000000` |

Versão correta de `fn_cruzar_caso_com_focos`: migration `20260910010000`
Versão correta de `denunciar_cidadao`: migration `20260915000000`

**Regras de negócio consolidadas:** `docs/REGRAS_DE_NEGOCIO_OFICIAIS.md`

---

## Convenções de nomenclatura

```
Componentes:    PascalCase           → src/components/
Hooks:          camelCase "use..."   → src/hooks/
Serviços:       camelCase            → src/services/api.ts (objeto api)
Tipos:          PascalCase           → src/types/database.ts
Seeds:          seedDefault<X>.ts    → src/lib/
Imports:        sempre alias @/      → import { api } from '@/services/api'
Edge Functions: kebab-case           → supabase/functions/nome-da-function/
```

---

## O que fazer ao receber uma tarefa de implementação

1. Identificar o domínio afetado (levantamento? sla? drone? operador? pluvio?)
2. Verificar se o tipo já existe em `src/types/database.ts`
3. Verificar se o método já existe em `src/services/api.ts`
4. Se precisar de nova tabela, propor a migration SQL com RLS antes de escrever código
5. Criar ou estender o método em `api.ts`
6. Criar o hook em `src/hooks/queries/`
7. Implementar o componente consumindo o hook
8. Para features críticas, criar seed em `src/lib/seedDefault<Feature>.ts`
9. Nunca acessar `supabase` diretamente em componentes de página
10. Sempre atualizar o `schema.sql` quando implementar novos campos ou tabelas
