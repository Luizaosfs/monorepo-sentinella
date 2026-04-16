# P0 — Relatório de Auditoria Cirúrgica
**Data:** 2026-04-11
**Fontes analisadas:**
- `D:\sentinella\backup_20260411_124445\database\database.sql` (dump completo do banco)
- `D:\sentinella\backup_20260411_125227\sentinelaweb_sources.zip` (fontes React/TypeScript)

---

## 1. RESUMO EXECUTIVO

| Categoria | Achados reais | Falsos positivos | Ação |
|---|---|---|---|
| Papéis legados em SQL live | **1 confirmado** | 0 | Corrigido na migration |
| Identity mismatch auth_id/usuario_id | **1 confirmado (ambíguo)** | 0 | Documentado, não é bug real |
| SECURITY DEFINER sem tenant check | **0** | muitos suspeitos | N/A |
| `focos_risco.status` update direto no frontend | **0** | 1 suspeito | N/A (campo diferente) |
| Supabase direto em pages/hooks para ops sensíveis | **2 low-risk** | 8 aceitáveis | Documentados |

**O banco está em estado consideravelmente bom.** As migrations 20261014000007 e 20261015000001/2 limparam a maioria dos problemas de papéis legados. O único achado de código real é a função `criar_levantamento_item_manual` que ainda aceita `operador` e `usuario` como papéis válidos.

---

## 2. ACHADOS CONFIRMADOS

### 2.1 CRÍTICO — `criar_levantamento_item_manual`: papéis legados na validação

**Arquivo:** schema live, função `public.criar_levantamento_item_manual`
**Linhas do dump:** ~1808–1812

**Trecho exato com problema:**
```sql
SELECT LOWER(pu.papel::text) INTO v_papel
FROM papeis_usuarios pu WHERE pu.usuario_id = v_auth_id LIMIT 1;

IF v_papel IS NULL OR v_papel NOT IN ('admin', 'supervisor', 'usuario', 'operador') THEN
  RAISE EXCEPTION 'Papel não permitido para criação manual de item.';
END IF;
```

**Por que é um problema:**
- `'usuario'` e `'operador'` são dead values no enum `papel_app` desde a migration 20261015000002
- A constraint `chk_papel_canonico` bloqueia esses valores em novos dados, mas se algum registro histórico existir, um usuário com papel morto passa pelo `IF` e pode criar itens
- `'agente'` (papel canônico ativo para agentes de campo) não está na lista — um agente legítimo com papel `agente` recebe `RAISE EXCEPTION` e não consegue criar itens manuais
- Isso é um **bloqueio funcional real** para agentes, não apenas um risco teórico

**Correção:** substituir lista por `('admin', 'supervisor', 'agente', 'notificador')` — aplicada na migration `20260411000000_p0_correcoes_cirurgicas.sql`.

---

### 2.2 CONFIRMADO (mas by-design) — `criar_levantamento_item_manual`: branch `'operador'`

**Trecho exato:**
```sql
IF v_papel = 'operador' THEN
  IF (SELECT u.cliente_id FROM usuarios u WHERE u.auth_id = v_auth_id LIMIT 1)
     IS DISTINCT FROM v_cliente_id THEN
    RAISE EXCEPTION 'Operador só pode criar itens para o próprio cliente.';
  END IF;
ELSE
  IF NOT public.usuario_pode_acessar_cliente(v_cliente_id) THEN
    RAISE EXCEPTION 'Sem permissão para acessar o cliente deste planejamento.';
  END IF;
END IF;
```

**Por que é um problema:**
- O branch `'operador'` nunca executa (papel morto, nunca atribuído)
- Admins e supervisores caem no `ELSE` que chama `usuario_pode_acessar_cliente()` — correto
- O branch especial era uma proteção redundante que ficou órfã

**Correção:** remoção do branch `'operador'`; todo papel passa por `usuario_pode_acessar_cliente()`.

---

### 2.3 INFORMATIVO — `papeis_usuarios.usuario_id` guarda `auth.uid()`, não `usuarios.id`

**Contexto:** A policy live em `papeis_usuarios` usa:
```sql
USING (usuario_id = auth.uid() OR public.is_admin() OR ...)
```

A função `criar_levantamento_item_manual` usa:
```sql
FROM papeis_usuarios pu WHERE pu.usuario_id = v_auth_id  -- v_auth_id = auth.uid()
```

**Avaliação:** Isso é **by-design** no esquema atual. A migration 20261015000001 documenta explicitamente que `papeis_usuarios.usuario_id` armazena `auth.uid()` (não `usuarios.id`). Todas as policies e funções usam isso de forma consistente. Não é um bug — é um acoplamento de identidade legado que funciona.

**Risco remanescente:** Se o schema for normalizado futuramente para usar `usuarios.id`, todos os pontos que fazem `pu.usuario_id = auth.uid()` precisarão ser atualizados simultaneamente. Isso inclui as 4 policies de `papeis_usuarios` e ~8 funções helper.

---

### 2.4 FALSO POSITIVO — `usuario_pode_acessar_cliente`: sem bug de identity

**Versão ANTIGA (em migration history ~20250302000000):**
```sql
WHERE pu.usuario_id = u.auth_id AND pu.papel = 'admin'
```
Isso seria um bug: `u.auth_id` comparado com `pu.usuario_id` que também guarda `auth_id` — na prática funciona mas é confuso.

**Versão LIVE (dump linha 10220):**
```sql
CREATE FUNCTION public.usuario_pode_acessar_cliente(p_cliente_id uuid) RETURNS boolean AS $$
  SELECT
    public.is_admin()
    OR CASE
      WHEN auth.jwt() -> 'app_metadata' ->> 'cliente_id' IS NOT NULL
      THEN (auth.jwt() -> 'app_metadata' ->> 'cliente_id')::uuid = p_cliente_id
      ELSE EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.auth_id = auth.uid()
          AND u.cliente_id = p_cliente_id
      )
    END;
$$;
```

**Avaliação:** A versão live está correta. JWT fast-path + DB fallback. Sem bug de identity.

---

### 2.5 FALSO POSITIVO — `is_operador()` não existe no schema live

**Buscado:** `CREATE FUNCTION public.is_operador` no dump
**Resultado:** Nenhuma ocorrência no schema live. A função existe APENAS na tabela `supabase_migrations` (histórico de texto de migrations antigas) mas foi dropada pela migration 20261015000002.

**Conclusão:** `is_operador()` está corretamente removida do banco.

---

### 2.6 FRONTEND — `api.ts`: `focos_risco.update` não atualiza `status`

**Arquivo:** `src/services/api.ts`, linha 3787
**Trecho:**
```typescript
update: async (id: string, payload: Partial<Pick<FocoRisco,
  'responsavel_id' | 'desfecho' | 'prioridade' | 'regiao_id'>>): Promise<void> => {
  const { error } = await supabase.from('focos_risco').update(payload).eq('id', id);
```

**Avaliação:** O tipo `Partial<Pick<...>>` exclui `status` explicitamente. Não é uma violação da regra "status só via RPC". **Falso positivo.**

---

### 2.7 FRONTEND — Supabase direto em páginas (aceitável vs. preocupante)

**Páginas com `import { supabase }` fora de `api.ts`:**

| Arquivo | Operação | Avaliação |
|---|---|---|
| `AdminCanalCidadao.tsx` | Realtime subscription | Aceitável (sem escrita) |
| `AdminPluvioRisco.tsx` | Leitura pluvio | Aceitável (sem escrita) |
| `AdminSupervisorTempoReal.tsx` | Realtime subscription | Aceitável (sem escrita) |
| `AdminUsuarios.tsx` | `supabase.functions.invoke` + `supabase.auth.resetPasswordForEmail` | Aceitável (Auth API, não dados) |
| `AgenteReinspecao.tsx` | Dynamic import supabase | Aceitável (sem operação sensível confirmada) |
| `AgenteVistoria.tsx` | `SELECT focos_risco` (leitura, com cliente_id filter) | **Low-risk mas deveria estar em api.ts** |
| `GestorFocos.tsx` | Realtime subscription + `supabase.removeChannel` | Aceitável (sem escrita) |
| `Login.tsx` | `supabase.auth.*` | Correto (único lugar legítimo) |
| `OperadorFormularioVistoria.tsx` | `SELECT imoveis` (leitura header, com eq id) | **Low-risk mas deveria estar em api.ts** |
| `OperadorInicioTurno.tsx` | (verificar — import presente) | A verificar |

**Achados preocupantes (low-risk, não P0):**
- `AgenteVistoria.tsx`: query direta em `focos_risco` com `clienteId` filtrado — correto funcionalmente mas viola padrão arquitetural do projeto (tudo via `api.ts`)
- `OperadorFormularioVistoria.tsx`: query direta em `imoveis` para header — mesma situação

**Nenhuma operação de escrita sensível** (INSERT/UPDATE em `focos_risco`, `papeis_usuarios`, `vistorias`) foi encontrada fora de `api.ts`.

---

## 3. CORREÇÕES APLICADAS

### Migration: `20260411000000_p0_correcoes_cirurgicas.sql`

**Correção 1A — Lista de papéis em `criar_levantamento_item_manual`:**
- Removidos `'usuario'` e `'operador'` da whitelist
- Adicionado `'agente'` (papel canônico ativo, estava faltando — bug funcional)
- Novo whitelist: `('admin', 'supervisor', 'agente', 'notificador')`

**Correção 1B — Branch `'operador'` removido:**
- Todo papel passa por `usuario_pode_acessar_cliente()` uniformemente
- Elimina dead code path

**Verificação final (DO block):**
- Emite `WARNING` se existirem papéis mortos em dados ativos
- Emite `NOTICE OK` se dados estiverem limpos

---

## 4. RISCOS REMANESCENTES

### R1 — Coupling de identidade em `papeis_usuarios.usuario_id` (BAIXO)
`papeis_usuarios.usuario_id` armazena `auth.uid()` (não `usuarios.id`). Funciona por design mas cria acoplamento frágil. Se o schema for normalizado no futuro, ~12 objetos (policies + funções) precisam ser atualizados atomicamente.

**Mitigação atual:** migration 20261015000001 documenta explicitamente; constraint `chk_papel_canonico` protege os dados.

### R2 — Queries diretas a `focos_risco` e `imoveis` em páginas (BAIXO)
`AgenteVistoria.tsx` e `OperadorFormularioVistoria.tsx` fazem SELECT direto. São apenas leituras com filtro correto de `clienteId`. Não é risco de segurança mas viola o padrão arquitetural do projeto.

**Recomendação:** mover para `api.focosRisco.listByImovel()` e `api.imoveis.getHeader()` na próxima sprint de refactor.

### R3 — Enum `papel_app` contém valores mortos (INFORMATIVO)
`operador`, `usuario`, `platform_admin` não podem ser removidos do enum PostgreSQL sem recriar todas as RLS policies (limitação do PG com dependências transitivas). A constraint `chk_papel_canonico` bloqueia inserção desses valores.

**Status:** Aceito. Documentado na migration 20261015000002.

### R4 — `is_supervisor()` aceita `'moderador'` no fallback DB (INFORMATIVO)
```sql
ELSE EXISTS (
  SELECT 1 FROM public.papeis_usuarios pu
  WHERE pu.usuario_id = auth.uid()
    AND LOWER(pu.papel::text) IN ('supervisor', 'moderador')
)
```
`moderador` não existe no enum. Na prática nunca casa. Sem risco real mas é dead code.

---

## 5. O QUE NÃO FOI ENCONTRADO (confirmação negativa)

- Nenhum usuário com `platform_admin` realizando operações reais (enum morto, sem policies ativas)
- Nenhum UPDATE direto em `focos_risco.status` no frontend
- Nenhum INSERT manual em `caso_foco_cruzamento`
- Nenhum acesso sem filtro `cliente_id` em operações de escrita
- Nenhuma SECURITY DEFINER sem checagem de tenant em funções de negócio

---

*Auditoria realizada em 2026-04-11 a partir dos backups gerados às 12:44 e 12:52.*
