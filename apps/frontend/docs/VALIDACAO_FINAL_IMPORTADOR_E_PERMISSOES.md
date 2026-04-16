# SENTINELLA — Validação Final: Importador e Permissões

> Gerado em: 2026-04-02
> Escopo: `AdminImportarImoveis.tsx`, `api.ts`, `AppLayout.tsx`, migrations RLS, guards de rota

---

## 1. O que está correto

### Importador de Imóveis
| Item | Status | Detalhe |
|------|--------|---------|
| Rota protegida no frontend | ✅ | `/admin/importar-imoveis` está dentro de `<Route element={<AdminGuard />}>` que exige `isAdminOrSupervisor` |
| operador não acessa | ✅ | `AdminGuard` redireciona para `/` se não for admin ou supervisor |
| notificador não acessa | ✅ | Idem |
| usuario/viewer não acessa | ✅ | Idem |
| RLS imoveis INSERT | ✅ | `WITH CHECK (usuario_pode_acessar_cliente(cliente_id))` — somente mesmo cliente |
| Cross-tenant import impossível | ✅ | `batchCreate` sempre sobrescreve `cliente_id` com o do usuário autenticado; RLS confirma |
| Deduplicação | ✅ | `buscarChavesExistentes` carrega Set de chaves existentes antes do INSERT; duplicatas contabilizadas e nunca inseridas |
| Geocodificação com cap | ✅ | MAX_GEOCODE = 300 linhas; excedente importado sem lat/lng com aviso |
| Throttle Nominatim | ✅ | `sleep(1100ms)` entre requests — respeita limite de 1 req/s |
| Relatório CSV de erros | ✅ | Download disponível no step "Concluído" com status por linha |
| XLSX suportado | ✅ | SheetJS instalado; primeira aba processada |
| tipo_imovel padrão | ✅ | Ausente → `residencial` com aviso (não erro fatal) |
| lat/lng opcionais | ✅ | Ausência dispara geocodificação; não bloqueia importação |
| import_log evoluído | ✅ | Migration `20260920000000` adicionou `duplicados`, `geocodificados`, `geo_falhou` |

### Permissões RBAC (pós-P0)
| Regra | Status | Detalhe |
|-------|--------|---------|
| `get_meu_papel()` retorna `notificador` corretamente | ✅ | Corrigido em `20260919000000` — prioridade 3, acima de operador |
| `drones` SELECT exige autenticação | ✅ | Policy `auth.role() = 'authenticated'` — sem acesso anônimo |
| `drones` INSERT/UPDATE restrito a admin+supervisor | ✅ | `is_admin() OR is_supervisor()` |
| `operador_pode_gerir_usuario()` retorna false | ✅ | Corrigido em `20260919000001` |
| `usuarios` INSERT restrito a admin+supervisor | ✅ | Policy `usuarios_insert_admin_supervisor` |
| `usuarios` UPDATE own liberado | ✅ | Policy `usuarios_update_proprio` para qualquer papel |
| `papeis_usuarios` INSERT restrito a admin+supervisor | ✅ | Policy `papeis_usuarios_insert_admin_supervisor` |
| `platform_admin` bloqueado | ✅ | Constraint `papeis_sem_platform_admin` + `is_platform_admin()` dropada |
| Supervisor não cria papel admin/supervisor | ✅ | `papel_permitido_para_supervisor()` só permite `operador`, `notificador`, `usuario` |

---

## 2. O que está inconsistente (não-crítico para piloto monocliente)

### I1 — `imoveis_insert` RLS não restringe por papel
**Situação:** A policy atual permite que qualquer usuário autenticado do mesmo cliente insira imóveis diretamente via API Supabase, mesmo que seja operador ou notificador.

**Por que está assim:** Operadores precisam criar imóveis em campo via `OperadorListaImoveis` (cadastro rápido). A restrição é frontend-only para o importador.

**Risco real:** Um operador motivado poderia usar o Supabase JS SDK diretamente para inserir imóveis em lote. Não insere em outro cliente (RLS garante `cliente_id`), mas contorna a auditoria do `import_log`.

**Impacto para piloto monocliente:** Baixo — operadores são funcionários municipais confiáveis.

**Correção futura:** Separar a rota de criação unitária (operador) da importação em lote (admin/supervisor), possivelmente via RPC `SECURITY DEFINER` para batch import.

---

### I2 — Menu "Importar Imóveis" visível a supervisor com `adminOnly: false`
**Situação:** `adminOnly: false` → supervisor vê e acessa o importador.

**Análise:** Isso é **correto** — supervisor deve poder importar imóveis do seu município. O campo `adminOnly` controla apenas itens de plataforma (Clientes, Quotas, Drones) que supervisores não devem ver.

**Ação:** Nenhuma — comportamento correto.

---

### I3 — `buscarChavesExistentes` sem paginação
**Situação:** Carrega TODOS os registros `(logradouro, numero, bairro)` do cliente em memória para montar o Set de deduplicação.

**Risco:** Cliente com 100k+ imóveis → query lenta (estimativa: 2-5s, ~3MB de payload).

**Impacto para piloto:** Baixo — municípios pequenos têm 5k–30k imóveis.

**Correção futura:** Criar índice composto `(cliente_id, lower(logradouro), lower(numero), lower(bairro))` e fazer a deduplicação via RPC no banco.

---

### I4 — Parse CSV/XLSX síncrono no thread principal
**Situação:** Arquivos com >10k linhas podem travar a UI por 1-2 segundos durante o parse.

**Impacto para piloto:** Baixo — imports típicos de prefeitura têm 500–5k linhas.

**Correção futura:** Mover parse para Web Worker.

---

## 3. O que é crítico corrigir antes de expansão multi-cliente

### 🔴 C1 — `usuario_pode_acessar_cliente()` concede acesso cross-tenant a qualquer admin

**Código atual (migration 20260702):**
```sql
SELECT EXISTS (
  SELECT 1 FROM papeis_usuarios pu
  WHERE pu.usuario_id = auth.uid()
    AND pu.papel::text = 'admin'   -- ← qualquer admin, de qualquer cliente
)
OR EXISTS (
  SELECT 1 FROM usuarios u
  WHERE u.auth_id    = auth.uid()
    AND u.cliente_id = p_cliente_id
)
```

**Problema:** A primeira condição retorna `true` para qualquer usuário com papel `admin`, independentemente do cliente. Isso significa que o admin da Prefeitura A pode ler e escrever dados da Prefeitura B.

**Impacto atual (piloto monocliente):** Nenhum — há apenas um cliente.

**Impacto em produção multi-cliente:** 🔴 Crítico — vazamento completo de dados entre prefeituras.

**Correção necessária antes de 2º cliente:**
```sql
CREATE OR REPLACE FUNCTION public.usuario_pode_acessar_cliente(p_cliente_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.auth_id    = auth.uid()
      AND u.cliente_id = p_cliente_id  -- admin só acessa seu próprio cliente
  )
$$;
```
> ⚠️ Mudança de alto impacto — afeta TODAS as políticas RLS. Testar extensivamente antes de aplicar.

---

### 🟡 C2 — Nominatim ToS: User-Agent identificável (já corrigido)

**Situação anterior:** User-Agent genérico sem contato.

**Correção aplicada:** `'Sentinella-Importador/1.0 (plataforma municipal; contato: suporte@sentinella.app)'`

**Ação necessária:** Confirmar que o e-mail `suporte@sentinella.app` é monitorado — Nominatim pode enviar aviso antes de banir o IP por uso excessivo.

**Limitação operacional:** Importações com >300 linhas sem coordenadas levam >5 minutos. Orientar prefeituras a incluir lat/lng quando possível, ou usar planilha da Prefeitura com endereços já geocodificados.

---

## 4. Checklist de testes manuais

### Importador
- [ ] Upload de CSV com separador vírgula — preview correto
- [ ] Upload de CSV com separador ponto-e-vírgula — preview correto
- [ ] Upload de XLSX — parse da primeira aba
- [ ] Arquivo sem colunas obrigatórias (`logradouro`, `numero`, `bairro`) → mensagem de erro clara
- [ ] Linhas sem `lat/lng` → marcadas como "geocodificar" em âmbar no preview
- [ ] Linhas com `tipo_imovel` ausente → aviso (não erro), importa como `residencial`
- [ ] Importação de arquivo já importado → todas as linhas marcadas como "duplicado"
- [ ] Download de modelo CSV → abre corretamente no Excel/LibreOffice
- [ ] Download de modelo XLSX → abre com cabeçalhos corretos
- [ ] Download de relatório CSV pós-importação → contém linha por erro/duplicado
- [ ] Importar como supervisor → funciona
- [ ] Tentar acessar `/admin/importar-imoveis` como operador → redirecionado para `/`
- [ ] Tentar acessar `/admin/importar-imoveis` como notificador → redirecionado para `/`

### Permissões
- [ ] Login como `notificador` → `get_meu_papel()` retorna `'notificador'`
- [ ] Notificador acessa `/notificador/registrar` → OK
- [ ] Notificador tenta acessar `/admin` → redirecionado
- [ ] Operador tenta acessar `/admin/usuarios` → redirecionado
- [ ] Operador tenta acessar `/admin/importar-imoveis` → redirecionado
- [ ] Supervisor cria usuário com papel `operador` → OK
- [ ] Supervisor tenta criar usuário com papel `admin` → bloqueado (RLS)
- [ ] Supervisor tenta criar usuário com papel `supervisor` → bloqueado (RLS)
- [ ] `drones` SELECT sem autenticação → bloqueado (0 rows)
- [ ] `drones` INSERT como operador autenticado → bloqueado por RLS
- [ ] `import_log` de outra prefeitura → 0 rows (RLS)
- [ ] Verificar no Supabase Dashboard: nenhum usuário com `papel = 'platform_admin'`

### RLS multi-tenant (executar no SQL Editor do Supabase)
```sql
-- Deve retornar 0 para qualquer user que não seja do cliente A
SELECT count(*) FROM imoveis WHERE cliente_id = '<cliente_a_id>';

-- Deve retornar false para admin de cliente A tentando acessar cliente B
SELECT public.usuario_pode_acessar_cliente('<cliente_b_id>');
-- ⚠️ Atualmente retorna TRUE se o usuário tiver papel=admin — ver C1 acima
```

---

## Ajustes aplicados nesta sessão

| Arquivo | Mudança |
|---------|---------|
| `src/pages/admin/AdminImportarImoveis.tsx` | User-Agent Nominatim com contato identificável |
| `src/components/AppLayout.tsx` | Label "Importar Imóveis (CSV)" → "Importar Imóveis (CSV/XLSX)" |
| `supabase/migrations/20260920000000_import_log_evolucao.sql` | +3 colunas: `duplicados`, `geocodificados`, `geo_falhou` |
