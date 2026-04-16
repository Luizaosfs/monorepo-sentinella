# 13 — Padrões de Desenvolvimento

## Objetivo deste documento

Documentar os padrões técnicos estabelecidos no projeto Sentinella Web, para que qualquer desenvolvedor possa contribuir de forma consistente, sem introduzir inconsistências ou quebrar convenções existentes.

> **Para quem é este documento:** todo desenvolvedor que vai contribuir com o projeto — seja para adicionar uma feature, corrigir um bug, ou revisar um PR. Leia do início ao fim antes de escrever a primeira linha de código.

> **Relação com o CLAUDE.md:** o CLAUDE.md é o documento de referência rápida (mapa de arquivos, padrões de hook, exemplos de código). Este documento é mais extenso e explica o **porquê** de cada padrão, além de cobrir casos que o CLAUDE.md não detalha.

---

## 1. Padrões de Frontend

### 1.1 Estrutura de pastas

```
src/
  components/          ← componentes reutilizáveis (não são páginas)
    ui/                ← shadcn/ui gerados — não editar manualmente
    layout/            ← AppLayout, AppSidebar, etc.
    dashboard/         ← widgets do dashboard
    levantamentos/     ← painéis de detalhes, listas de itens
    vistoria/          ← etapas do formulário de vistoria
    map-v3/            ← camadas de mapa (HeatmapLayer, etc.)
  guards/              ← componentes de guarda de rota
  hooks/
    queries/           ← hooks de dados (useQuery, useMutation)
  lib/                 ← utilitários puros (sem React, sem Supabase)
  pages/               ← páginas (uma por rota)
    admin/
    operador/
    notificador/
    public/
  services/            ← camada de acesso a dados
  types/               ← interfaces TypeScript do domínio
  test/                ← configuração e fixtures de testes
```

### 1.2 Regra de importação

Sempre usar o alias `@/`:

```typescript
// ERRADO
import { api } from '../../services/api';
import { STALE } from '../lib/queryConfig';

// CORRETO
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
```

Exceção: Edge Functions (Deno) usam importações de URL — não aplicar `@/` nelas.

### 1.3 Componentes

**Nomenclatura:** PascalCase. O nome do arquivo deve ser igual ao nome do componente.

```typescript
// src/components/levantamentos/ItemDetailPanel.tsx
export function ItemDetailPanel({ itemId }: { itemId: string }) { ... }
```

**Regra de tamanho:** se um componente ultrapassar 400 linhas, extrair responsabilidades em sub-componentes. Cada sub-componente deve ter uma responsabilidade clara e um nome que a expresse.

**Props typing:** sempre tipar as props explicitamente, nunca usar `any`:

```typescript
// ERRADO
function MeuComponente(props: any) { ... }

// CORRETO
interface MeuComponenteProps {
  clienteId: string;
  onSuccess?: () => void;
}
function MeuComponente({ clienteId, onSuccess }: MeuComponenteProps) { ... }
```

**Estado local vs. server state:**
- Dados do banco de dados → React Query (useQuery/useMutation) via hooks em `hooks/queries/`
- Estado de formulário → `useState` local no componente ou React Hook Form
- Estado de UI (aberto/fechado, aba ativa) → `useState` local

### 1.4 Dados de multitenancy em componentes

**Nunca** pedir `clienteId` como prop de componentes de página. Sempre usar o hook centralizado:

```typescript
// ERRADO — acopla o componente a quem o chama
function AdminCasosNotificados({ clienteId }: { clienteId: string }) { ... }

// CORRETO — o componente se resolve
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
function AdminCasosNotificados() {
  const { clienteId } = useClienteAtivo();
  ...
}
```

Componentes compartilhados (ex: `ItemDetailPanel`) podem receber `clienteId` como prop quando são usados em contextos onde o clienteId já está resolvido pelo pai.

### 1.5 Imports de UI

Usar sempre componentes do shadcn/ui (`@/components/ui/`). Não instalar bibliotecas de UI adicionais sem discussão — cada nova dependência aumenta o bundle.

```typescript
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner'; // já instalado — usar para toasts
```

### 1.6 Ícones

Usar `lucide-react` (já instalado):

```typescript
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
```

### 1.7 Formatação de datas e números

Sempre usar `pt-BR`:

```typescript
// Datas
new Date(isoString).toLocaleDateString('pt-BR')
new Date(isoString).toLocaleString('pt-BR')

// Números
value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
```

---

## 2. Padrões de Backend (api.ts e Edge Functions)

### 2.1 Toda query passa por `api.ts`

Componentes e hooks nunca importam `supabase` diretamente. O único ponto de acesso ao Supabase no frontend é `src/services/api.ts`:

```typescript
// ERRADO — viola o padrão de auditoria de multitenancy
import { supabase } from '@/lib/supabase';
const { data } = await supabase.from('casos_notificados').select('*');

// CORRETO
import { api } from '@/services/api';
const casos = await api.casosNotificados.list(clienteId);
```

**Por que:** o `api.ts` é o único lugar onde podemos garantir que `cliente_id` está sendo filtrado. Se queries estiverem espalhadas, não há como auditar multitenancy.

### 2.2 Todo método de `api.ts` filtra por `cliente_id`

**Toda** query que acessa dados de negócio deve ter `.eq('cliente_id', clienteId)` ou equivalente:

```typescript
// ERRADO — vaza dados entre prefeituras
list: async () => {
  const { data, error } = await supabase.from('levantamento_itens').select('*');
  if (error) throw error;
  return data || [];
}

// CORRETO
list: async (clienteId: string) => {
  const { data, error } = await supabase
    .from('levantamento_itens')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
```

### 2.3 Estrutura padrão de método em `api.ts`

```typescript
// Dentro do objeto api:
nomeDominio: {
  list: async (clienteId: string): Promise<TipoRetorno[]> => {
    const { data, error } = await supabase
      .from('nome_tabela')
      .select('colunas, necessarias')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  getById: async (id: string): Promise<TipoRetorno | null> => {
    const { data, error } = await supabase
      .from('nome_tabela')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  create: async (payload: Omit<TipoRetorno, 'id' | 'created_at' | 'updated_at'>): Promise<TipoRetorno> => {
    const { data, error } = await supabase
      .from('nome_tabela')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, payload: Partial<TipoRetorno>): Promise<void> => {
    const { error } = await supabase
      .from('nome_tabela')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  remove: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('nome_tabela')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
},
```

### 2.4 Tratamento de erros em `api.ts`

Sempre relançar o erro após verificar:

```typescript
if (error) throw error;
```

Nunca engolir o erro ou retornar um fallback silencioso:

```typescript
// ERRADO — esconde problemas de banco
if (error) return [];

// ERRADO — torna erros difíceis de rastrear
try { ... } catch { return []; }

// CORRETO — deixa o hook ou componente decidir o que fazer com o erro
if (error) throw error;
```

### 2.5 Edge Functions

**Nomenclatura:** kebab-case. Pasta em `supabase/functions/nome-da-function/index.ts`.

**Estrutura padrão:**

```typescript
// supabase/functions/nome-da-function/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ATENÇÃO: service_role bypassa RLS.
    // Todo select/insert/update DEVE ter filtro de cliente_id explícito.
    const clienteId = /* extrair do request ou contexto */;

    // ... lógica da função

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      function: 'nome-da-function',
      error: error.message,
    }));

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

**Regra crítica:** toda Edge Function usa `service_role key` e por isso bypassa o RLS. **Cada query deve ter filtro de `cliente_id` explícito.** Não assumir que o RLS protegerá.

---

## 3. Padrões de Hooks de Query

### 3.1 Estrutura padrão

```typescript
// src/hooks/queries/useNomeFuncionalidade.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';

export function useNomeFuncionalidade(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['nome-funcionalidade', clienteId],
    queryFn: () => api.nomeDominio.list(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });
}
```

### 3.2 Constantes de staleTime

Sempre usar as constantes de `src/lib/queryConfig.ts`. Nunca usar números literais:

```typescript
// ERRADO
staleTime: 180000,

// CORRETO
import { STALE } from '@/lib/queryConfig';
staleTime: STALE.MEDIUM, // 3 minutos
```

| Constante | Valor | Quando usar |
|-----------|-------|-------------|
| `STALE.LIVE` | 0ms | Dados que mudam a cada segundo (contadores, status em tempo real) |
| `STALE.SHORT` | 1 min | Casos notificados, SLA, focos ativos |
| `STALE.MEDIUM` | 3 min | Padrão geral para a maioria dos dados |
| `STALE.LONG` / `STALE.MAP` | 10 min | Dados cartográficos, levantamentos históricos |
| `STALE.STATIC` | 30 min | Configurações, catálogos, feriados |

### 3.3 Query keys

Seguir a convenção `[entidade, parâmetro1, parâmetro2]`:

```typescript
queryKey: ['casos-notificados', clienteId]
queryKey: ['caso-detalhes', casoId]
queryKey: ['vistorias', clienteId, agenteId, ciclo]
queryKey: ['sla', clienteId, 'pendentes']
```

### 3.4 Mutations

```typescript
// src/hooks/queries/useCreateCasoMutation.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';

export function useCreateCasoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateCasoPayload) =>
      api.casosNotificados.create(payload),
    onSuccess: (_, variables) => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['casos-notificados', variables.clienteId] });
    },
  });
}
```

---

## 4. Padrões de SQL e Supabase

### 4.1 Toda nova tabela segue este template

```sql
CREATE TABLE nome_tabela (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  -- campos específicos da tabela
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS obrigatório
ALTER TABLE nome_tabela ENABLE ROW LEVEL SECURITY;

-- Índice obrigatório em cliente_id
CREATE INDEX idx_nome_tabela_cliente_id ON nome_tabela (cliente_id);

-- Trigger de updated_at (se a tabela tiver updates)
CREATE TRIGGER trg_nome_tabela_updated_at
  BEFORE UPDATE ON nome_tabela
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
```

### 4.2 Nomenclatura SQL

```
Tabelas:          snake_case, plural    → levantamento_itens, casos_notificados
Colunas:          snake_case            → cliente_id, created_at, status_atual
Índices:          idx_tabela_coluna     → idx_levantamento_itens_cliente_id
Triggers:         trg_tabela_descricao  → trg_vistorias_updated_at
Funções:          fn_verbo_substantivo  → fn_transicionar_foco, fn_cruzar_casos
RPCs:             snake_case, verbo     → canal_cidadao_denunciar, resumo_agente_ciclo
Políticas RLS:    "descricao_legivel"   → "isolamento_por_cliente"
Migrations:       YYYYMMDDHHMMSS_desc.sql
```

### 4.3 Migrations

**Nomenclatura de arquivo:** `YYYYMMDDHHMMSS_descricao_clara.sql`

A descrição deve ser autoexplicativa:
```
20260400001000_habilitar_rls_tabelas_pendentes.sql     ✓
20260400002000_fix_payload_cruzamento_surto.sql        ✓
20260400003000_rate_limit_canal_cidadao.sql            ✓
20260000000001_update.sql                              ✗ (genérico demais)
```

**Regras de migrations:**
- Migrations são irreversíveis em produção — pensar antes de aplicar
- Sempre incluir `IF NOT EXISTS` em CREATEs e `IF EXISTS` em DROPs
- Nunca usar migrations para seed de dados de desenvolvimento
- Toda migration deve ser idempotente quando possível
- Adicionar comentário no topo explicando o contexto:

```sql
-- 20260400002000_fix_payload_cruzamento_surto.sql
-- Corrige o trigger de cruzamento caso-foco para acumular casos em array
-- em vez de sobrescrever o último caso. Resolve o bug DT-12 identificado
-- em 2026-03-26 na análise de dívida técnica.
```

### 4.4 Funções PL/pgSQL

```sql
CREATE OR REPLACE FUNCTION fn_nome_da_funcao(
  p_param1 uuid,
  p_param2 text DEFAULT NULL
)
RETURNS tipo_retorno
LANGUAGE plpgsql
-- SECURITY DEFINER apenas quando necessário e documentado
AS $$
DECLARE
  v_variavel_local tipo;
BEGIN
  -- Lógica da função

  RETURN resultado;
EXCEPTION
  WHEN OTHERS THEN
    -- Log do erro antes de relançar
    RAISE LOG 'fn_nome_da_funcao: erro para param1=%, erro=%', p_param1, SQLERRM;
    RAISE;
END;
$$;
```

**SECURITY DEFINER:** usar apenas quando a função precisa acessar dados além do que o RLS do chamador permite. Sempre documentar por que é necessário:

```sql
-- SECURITY DEFINER: necessário porque esta função lê papeis_usuarios
-- para qualquer auth_id, não apenas o do usuário atual.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$ ... $$;
```

---

## 5. Padrões de RLS

### 5.1 Política padrão de isolamento por cliente

```sql
-- Para tabelas com cliente_id direto:
CREATE POLICY "isolamento_por_cliente" ON nome_tabela
  FOR ALL TO authenticated
  USING (
    cliente_id IN (
      SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()
    )
  );

-- Para tabelas sem cliente_id direto (join necessário):
CREATE POLICY "isolamento_por_cliente" ON vistoria_depositos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vistorias v
      WHERE v.id = vistoria_depositos.vistoria_id
        AND v.cliente_id IN (
          SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()
        )
    )
  );
```

### 5.2 Política com bypass para admin

```sql
-- Admin vê dados de qualquer cliente:
CREATE POLICY "acesso_por_cliente_ou_admin" ON nome_tabela
  FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));
```

### 5.3 Política para inserção

Sempre separar políticas de leitura e escrita quando os critérios diferem:

```sql
-- Leitura: cliente
CREATE POLICY "leitura_cliente" ON nome_tabela
  FOR SELECT TO authenticated
  USING (cliente_id IN (SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()));

-- Escrita: apenas operadores do mesmo cliente
CREATE POLICY "escrita_operador" ON nome_tabela
  FOR INSERT TO authenticated
  WITH CHECK (
    cliente_id IN (SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid())
    AND public.is_operador()
  );
```

### 5.4 Verificação de RLS ao criar tabela

Antes de qualquer deploy de migration com nova tabela, verificar:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'nome_nova_tabela';
-- rowsecurity deve ser true
```

### 5.5 O que nunca fazer em RLS

```sql
-- NUNCA usar service_role em policies (seria ignorado de qualquer forma):
-- service_role bypassa RLS completamente

-- NUNCA criar política sem cláusula de cliente:
CREATE POLICY "all_access" ON nome_tabela USING (true); -- PROIBIDO

-- NUNCA assumir que a ausência de RLS é intencional:
-- sempre habilitar RLS em tabelas novas, mesmo que a política seja liberal
```

---

## 6. Padrões de Nomenclatura

### 6.1 Resumo completo

| Contexto | Padrão | Exemplo |
|----------|--------|---------|
| Componentes React | PascalCase | `ItemDetailPanel`, `AdminCasosNotificados` |
| Hooks | camelCase com `use` | `useCasosNotificados`, `useCreateVistoriaMutation` |
| Funções utilitárias | camelCase | `calcularSlaHoras`, `normalizeScore` |
| Constantes | UPPER_SNAKE | `SLA_RULES`, `DEPOSITO_LABELS`, `STALE` |
| Interfaces TypeScript | PascalCase | `CasoNotificado`, `VistoriaDeposito` |
| Enums TypeScript | PascalCase | `StatusCaso`, `TipoDeposito` |
| Namespaces em api.ts | camelCase | `api.casosNotificados`, `api.slaFeriados` |
| Arquivos de componente | PascalCase.tsx | `ItemDetailPanel.tsx` |
| Arquivos de hook | camelCase.ts | `useCasosNotificados.ts` |
| Arquivos de serviço | camelCase.ts | `api.ts`, `reportPdf.ts` |
| Arquivos de seed | seedDefault<Feature>.ts | `seedDefaultSlaConfig.ts` |
| Tabelas SQL | snake_case plural | `casos_notificados`, `levantamento_itens` |
| Colunas SQL | snake_case | `cliente_id`, `created_at` |
| Funções SQL | snake_case verbo | `fn_transicionar_foco` |
| Edge Functions | kebab-case | `cnes-sync`, `relatorio-semanal` |
| Migrations | timestamp + desc | `20260400001000_fix_rls_tabelas.sql` |

### 6.2 Nomes de domínio preferidos

Usar sempre o vocabulário do domínio, não termos técnicos genéricos:

```
PREFERIDO                    EVITAR
planejamento                 plan, schedule, planning
levantamento                 survey, inspection, report
levantamento_item            item, finding, result
foco_risco                   risk, issue, problem
vistoria                     visit, checkup, audit
operador                     user, agent, worker
cliente                      tenant, organization, account
regiao / bairro              area, zone, sector
ciclo                        period, iteration, round
```

---

## 7. Padrões para Documentação

### 7.1 Comentários no código

Comentar **por quê**, não **o quê**:

```typescript
// ERRADO — diz o que o código já diz
// Filtra por cliente_id
.eq('cliente_id', clienteId)

// CORRETO — explica a intenção ou restrição não óbvia
// Multitenancy: obrigatório em toda query — isolamento entre prefeituras
.eq('cliente_id', clienteId)

// CORRETO — documenta uma decisão de design não óbvia
// Usa ST_DWithin (PostGIS) em vez de haversine porque focos_risco
// tem índice GIST de geography, o que torna PostGIS mais eficiente aqui.
```

### 7.2 JSDoc para funções de domínio

Funções de negócio críticas devem ter JSDoc:

```typescript
/**
 * Calcula o SLA em horas para um item, aplicando fatores de risco.
 *
 * ATENÇÃO: esta função é usada apenas para PREVIEW no frontend.
 * O SLA oficial é calculado pelo banco via sla_aplicar_fatores().
 * Se os dois divergirem, o valor do banco prevalece.
 *
 * @param prioridade - P1 (Crítico) a P5 (Baixo)
 * @param classificacaoRisco - "Muito Alto", "Alto", "Médio", "Baixo"
 * @returns Horas de SLA, nunca menos que SLA_MIN_HORAS (2h)
 */
export function calcularSlaHoras(
  prioridade: SlaP,
  classificacaoRisco?: ClassificacaoRisco,
): number { ... }
```

### 7.3 Documentação de campos virtuais

Campos que não existem no banco mas são reconstruídos no frontend devem ser marcados:

```typescript
interface LevantamentoItem {
  // === Campos reais do banco ===
  id: string;
  levantamento_id: string;

  // === Campos virtuais (@virtual) ===
  // Estes campos NÃO existem na tabela levantamento_itens.
  // São reconstruídos por enrichItensComFoco() em api.ts
  // a partir dos dados de focos_risco.
  // Consultas SQL diretas (Edge Functions, pipeline) NÃO terão esses campos.

  /** @virtual Origem: focos_risco.status */
  status_atendimento?: string;

  /** @virtual Origem: focos_risco.acao_aplicada */
  acao_aplicada?: string;
}
```

### 7.4 Documentação de migrations

Toda migration deve ter um cabeçalho:

```sql
-- ============================================================
-- Migration: 20260400002000_fix_payload_cruzamento_surto.sql
-- Autor: [nome]
-- Data: 2026-04-XX
-- Resolve: DT-12, RD-01 (docs/09-divida-tecnica.md)
-- Descrição:
--   Corrige o trigger fn_cruzar_caso_focos para acumular IDs de
--   casos em um array JSON em vez de sobrescrever o último caso.
--   Em surtos com múltiplos casos próximos ao mesmo foco, todos
--   os casos agora ficam registrados no payload.
-- Reversão:
--   Não aplicável — a mudança é apenas no trigger (sem ALTER TABLE).
--   Para reverter: restaurar a versão anterior da função.
-- ============================================================
```

---

## 8. Padrões para Testes

### 8.1 Organização

```
src/
  test/
    setup.ts                  ← configuração global (mocks, matchers)
    fixtures/
      levantamento.ts         ← dados reutilizáveis de levantamento
      sla.ts                  ← dados de SLA
      focos.ts                ← dados de focos_risco
    mocks/
      supabase.ts             ← mock do cliente Supabase
  types/
    sla.test.ts               ← ao lado do arquivo testado
  lib/
    prioridade.test.ts
    normalizeScore.test.ts
  services/
    enrichItens.test.ts
```

### 8.2 Padrão de teste unitário

```typescript
// src/types/sla.test.ts
import { describe, it, expect } from 'vitest';
import { calcularSlaHoras } from './sla';

describe('calcularSlaHoras', () => {
  describe('prioridade P1 (Crítico)', () => {
    it('retorna 4h sem fatores de redução', () => {
      expect(calcularSlaHoras('P1')).toBe(4);
    });

    it('aplica redução de 30% para risco Muito Alto', () => {
      const resultado = calcularSlaHoras('P1', 'Muito Alto');
      expect(resultado).toBe(2.8); // 4h * 0.7
    });

    it('nunca retorna menos que 2h (mínimo absoluto)', () => {
      // Vários fatores de redução combinados
      const resultado = calcularSlaHoras('P1', 'Muito Alto', 5, 32);
      expect(resultado).toBeGreaterThanOrEqual(2);
    });
  });

  describe('prioridades P4 e P5', () => {
    it('P4 não gera SLA automático', () => {
      // P4 e P5 não devem gerar registros de SLA
      // (conforme migration 20260606100000)
      expect(calcularSlaHoras('P4')).toBeNull();
    });
  });
});
```

### 8.3 Padrão de teste de hook

```typescript
// src/hooks/queries/useCasosNotificados.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { useCasosNotificados } from './useCasosNotificados';
import { api } from '@/services/api';

vi.mock('@/services/api');

const wrapper = ({ children }) => (
  <QueryClientProvider client={new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })}>
    {children}
  </QueryClientProvider>
);

describe('useCasosNotificados', () => {
  it('não executa query quando clienteId é null', () => {
    const { result } = renderHook(() => useCasosNotificados(null), { wrapper });
    expect(result.current.isFetching).toBe(false);
    expect(api.casosNotificados.list).not.toHaveBeenCalled();
  });

  it('carrega casos quando clienteId está disponível', async () => {
    vi.mocked(api.casosNotificados.list).mockResolvedValue([
      { id: '1', doenca: 'dengue', /* ... */ }
    ]);

    const { result } = renderHook(
      () => useCasosNotificados('cliente-123'),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });
});
```

### 8.4 Cobertura mínima por tipo de código

| Tipo de código | Cobertura mínima |
|----------------|-----------------|
| Funções puras de domínio (`calcularSlaHoras`, `normalizeScore`) | 90% |
| State machine (`focos_risco` transições) | 100% de transições válidas e 5+ inválidas |
| `enrichItensComFoco()` | 80% |
| Hooks de query | Testar: enabled/disabled, sucesso, erro |
| Componentes de página | Não testar — custo alto, valor baixo |

### 8.5 O que não testar

- Componentes de UI puros (apenas apresentação)
- Integrações com Supabase real (usar mocks)
- CSS e estilos
- Edge Functions (testar via staging)
- Código gerado pelo shadcn/ui

---

## 9. Padrões para Logs e Auditoria

### 9.1 Logs em Edge Functions

Sempre usar JSON estruturado:

```typescript
// Sucesso
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  function: 'relatorio-semanal',
  cliente_id: clienteId,
  action: 'email_enviado',
  destinatario_hash: hashEmail(email), // nunca logar e-mail em texto claro
  status: 'sucesso',
  duracao_ms: Date.now() - inicio,
}));

// Erro
console.error(JSON.stringify({
  timestamp: new Date().toISOString(),
  function: 'relatorio-semanal',
  cliente_id: clienteId,
  action: 'email_envio_falhou',
  erro: error.message,
  stack: error.stack,
}));
```

### 9.2 O que nunca logar

```typescript
// NUNCA logar dados pessoais identificáveis:
console.log('Enviando para:', email);           // ERRADO
console.log('Paciente:', nomePaciente);         // ERRADO — LGPD
console.log('CPF:', cpf);                       // ERRADO — LGPD

// CORRETO — logar apenas identificadores ou hashes:
console.log(JSON.stringify({ destinatario_id: userId, action: 'email_sent' }));
```

### 9.3 Auditoria de operações críticas no banco

Operações de alta criticidade devem ser registradas em tabela de auditoria:

```sql
-- Exemplo: log de envio de relatórios (já implementado implicitamente)
-- Para operações novas que afetem dados de múltiplos clientes,
-- considerar adicionar registro em tabela de auditoria específica.

CREATE TABLE auditoria_operacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operacao text NOT NULL,           -- 'remocao_usuario', 'sync_cnes', etc.
  operador_id uuid,                  -- quem fez (null = sistema)
  cliente_id uuid,                   -- qual cliente foi afetado
  detalhes jsonb,                    -- contexto da operação (sem PII)
  created_at timestamptz DEFAULT now()
);
```

### 9.4 Rastreabilidade de mutations no frontend

Mutations que afetam dados críticos devem gerar um toast informativo para o usuário:

```typescript
onSuccess: () => {
  toast.success('SLA atualizado com sucesso');
  // Log para telemetria (quando implementado):
  // analytics.track('sla_status_updated', { itemId, novoStatus });
},
onError: (error) => {
  toast.error(`Erro ao atualizar SLA: ${error.message}`);
  console.error('sla_update_failed', { itemId, error: error.message });
},
```

---

## 10. Checklist de PR

Antes de abrir um PR, verificar:

### Multitenancy
- [ ] Toda nova query em `api.ts` filtra por `cliente_id`
- [ ] Nenhum componente importa `supabase` diretamente
- [ ] Toda nova tabela tem `cliente_id NOT NULL` e índice em `cliente_id`

### Segurança
- [ ] Toda nova tabela tem `ENABLE ROW LEVEL SECURITY`
- [ ] Toda nova tabela tem política de isolamento por cliente
- [ ] Funções `SECURITY DEFINER` são justificadas com comentário

### Código
- [ ] Imports usam alias `@/`
- [ ] Hooks usam constantes `STALE` de `queryConfig.ts`
- [ ] Hooks têm `enabled: !!parametro` quando o parâmetro pode ser null
- [ ] Campos virtuais estão marcados como `@virtual` nos tipos
- [ ] Novos métodos em `api.ts` seguem a estrutura padrão (seção 2.3)

### Banco de dados
- [ ] Migrations têm cabeçalho com contexto e referência ao problema que resolve
- [ ] Migrations não contêm seed de dados de desenvolvimento
- [ ] Migrations são idempotentes quando possível

### Testes
- [ ] Novas funções puras têm testes (quando a suíte estiver configurada)
- [ ] Mudanças em `calcularSlaHoras()` ou `enrichItensComFoco()` têm testes atualizados

### Documentação
- [ ] Campos não óbvios têm comentários explicando o porquê
- [ ] Mudanças de comportamento são refletidas nos docs em `docs/`

---

*Documento baseado no código-fonte real. Versão 2.1.0, análise em 2026-03-26.*
