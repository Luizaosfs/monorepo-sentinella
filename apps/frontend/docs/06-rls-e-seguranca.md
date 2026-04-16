# 06 — RLS e Segurança

> **Para quem é este documento:** desenvolvedores e responsáveis pela segurança que precisam entender como o isolamento entre clientes é implementado, como o controle de acesso por papel funciona, e onde estão os riscos identificados.

---

## Modelo de segurança em camadas

O Sentinella implementa defesa em profundidade com **três camadas independentes**. Cada uma protege contra uma classe diferente de falha:

```
┌─────────────────────────────────────────────────────────┐
│  CAMADA 1 — Frontend                                    │
│  Guards de rota (AdminOrSupervisorGuard, OperadorGuard) │
│  Protege contra: navegação direta por URL               │
│  Falha se: JavaScript for desabilitado ou bypassado     │
└──────────────────────┬──────────────────────────────────┘
                       │ Se falhar, camada 2 protege
┌──────────────────────▼──────────────────────────────────┐
│  CAMADA 2 — Serviço (api.ts)                            │
│  Filtro .eq('cliente_id', clienteId) em toda query      │
│  Protege contra: bugs no frontend que esquecem o filtro │
│  Falha se: código novo não seguir o padrão              │
└──────────────────────┬──────────────────────────────────┘
                       │ Se falhar, camada 3 protege
┌──────────────────────▼──────────────────────────────────┐
│  CAMADA 3 — Banco (RLS)                                 │
│  Políticas PostgreSQL que rejeitam linhas de outros     │
│  clientes antes de retorná-las                          │
│  Falha se: service_role key for usada (bypassa RLS)     │
└─────────────────────────────────────────────────────────┘
```

**Importante:** Edge Functions e o pipeline Python usam `service_role` key — eles operam **fora do RLS**. Cada um é responsável por seus próprios filtros de `cliente_id`.

---

## Funções auxiliares de RLS

O sistema define funções PL/pgSQL que são usadas dentro das políticas de RLS. Isso evita duplicação de lógica nas políticas e melhora legibilidade.

### `public.is_admin()`
```sql
-- Definida em 20250302100000_rls_geral_todas_tabelas.sql
-- Retorna true se o usuário autenticado tem papel 'admin' ou 'platform_admin'
SELECT COUNT(*) > 0 FROM papeis_usuarios
WHERE auth_id = auth.uid() AND papel IN ('admin', 'platform_admin')
```
Usada em políticas que concedem acesso irrestrito a admins.

### `public.is_operador()`
```sql
-- Definida em 20250306000000_operador_gestao_usuarios_rls.sql
-- Retorna true se o papel é 'operador'
```
Usada em políticas que restringem operadores a verem apenas seus próprios dados.

### `public.usuario_cliente_id()`
```sql
-- Retorna o cliente_id do usuário autenticado
SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()
```
Usada como shorthand em políticas de isolamento.

### `public.usuario_pode_acessar_cliente(p_cliente_id uuid)`
```sql
-- Verifica se o usuário tem acesso ao cliente especificado
-- Admin: acesso a todos os clientes
-- Outros: apenas ao próprio cliente
```
Usada em tabelas onde admin precisa ver dados de qualquer cliente.

### `public.usuario_pode_acessar_risk_policy(p_policy_id uuid)`
Verifica acesso a uma política de risco específica.

**Observação:** `usuario_pode_acessar_cliente` foi definida em **duas migrations diferentes** (`20250302000000` e `20250302100000`) com `CREATE OR REPLACE`. A segunda substitui a primeira. Não há divergência, mas indica evolução rápida sem reorganização.

---

## Padrão de política de isolamento

A política padrão para toda nova tabela:

```sql
-- Padrão observado na migration de vistoria e outras
CREATE POLICY "nome_tabela_isolamento" ON nome_tabela
  USING (cliente_id IN (
    SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()
  ));
```

Versão com admin bypass (para tabelas onde admin vê tudo):
```sql
CREATE POLICY "nome_tabela_select" ON nome_tabela
  FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));
```

---

## Cobertura RLS por grupo de tabelas

### Tabelas com RLS confirmado

| Grupo | Tabelas | Migration |
|-------|---------|-----------|
| Geográfico | `regioes` | `20250302000000`, `20250302100000` |
| Usuários | `usuarios`, `papeis_usuarios` | `20250302100000`, `20250306000000` |
| SLA | `sla_operacional` | `20250303000000` |
| Operacional | `operacoes`, `operacao_evidencias` | `20250306120000` |
| Vistoria | `imoveis`, `vistorias`, `vistoria_depositos`, `vistoria_sintomas`, `vistoria_riscos` | `20250318001000` |
| Calhas/acesso | `vistoria_calhas` | `20250318002000` |
| Notificações | `unidades_saude`, `casos_notificados`, `caso_foco_cruzamento` | `20250318000000` |
| Integração | `cliente_integracoes`, `item_notificacoes_esus` | `20250318003000` |
| CNES | `unidades_saude_sync_controle`, `unidades_saude_sync_log` | `20250319000000` |
| Focos | `focos_risco`, `foco_risco_historico` | `20260710000000` |
| Levantamentos | `levantamento_itens`, `levantamento_item_evidencias` | `20250302100000` |
| IA / Feedback | `yolo_feedback`, `levantamento_analise_ia` | `20250317002000` |
| 2026 — Vistoria/Drone | `vistoria_drone_correlacao` | `20260401040000` |
| 2026 — Resumos | `resumos_diarios` | `20260401050000` |
| 2026 — Canal Cidadão | `canal_cidadao_rate_limit` | `20260410000000` |
| 2026 — Distribuição | `distribuicao_quarteirao`, `quarteiroes` | `20260410010000`, `20260411000000` |
| 2026 — Alertas | `alerta_retorno_imovel` | `20260601020000` |
| 2026 — Detecções YOLO | `levantamento_item_detecoes` | `20260608100000` |
| 2026 — Seq. Protocolo | `notificacao_protocolo_seq` | `20260712010000` (patch) |

### Tabelas com RLS verificado em patches de 2026

| Tabela | Migration de correção |
|--------|-----------------------|
| `vistorias` (multitenancy admin) | `20260319233000` |
| `unidades_saude` (admin) | `20260609000000` |
| `notificador` (papel) | `20260605030000` |

### Resultado da auditoria de RLS (2026-07-12)

Auditoria completa executada sobre todas as migrations, incluindo as de 2026. As tabelas que constavam como "não confirmadas" na versão anterior deste documento foram verificadas diretamente no código-fonte:

| Tabela | Resultado |
|--------|-----------|
| `yolo_feedback` | ✅ RLS habilitado na migration de criação (`20250317002000`) |
| `levantamento_analise_ia` | ✅ RLS habilitado na migration de criação (`20250317002000`) |
| `unidades_saude_sync_controle` | ✅ RLS habilitado na migration de criação (`20250319000000`) |
| `unidades_saude_sync_log` | ✅ RLS habilitado na migration de criação (`20250319000000`) |
| `cliente_integracoes` | ✅ RLS habilitado na migration de criação (`20250318003000`) |
| `notificacao_protocolo_seq` | ⚠️ **Criada sem RLS** (`20260401020000`) — corrigida em `20260712010000` |

**Observação sobre `notificacao_protocolo_seq`:** tabela de contadores internos acessada exclusivamente pela função `proximo_protocolo_notificacao()` (SECURITY DEFINER). Foi habilitado RLS sem políticas adicionais — o acesso direto por usuários autenticados é bloqueado pelo padrão *deny all* do PostgreSQL, enquanto a função continua funcionando normalmente por ser SECURITY DEFINER. Ver seção de funções SECURITY DEFINER abaixo.

**Observação sobre `levantamento_item_detecoes`:** tem RLS habilitado com 3 políticas (SELECT, INSERT, DELETE). A política de INSERT usa `levantamentos.usuario_id` em vez de `levantamentos.cliente_id` — isolamento por dono do levantamento, não por prefeitura. Inconsistente com o padrão do projeto, mas sem impacto prático pois a tabela é gravada pelo pipeline Python via `service_role key` (que bypassa RLS). Documentado para revisão futura.

**Para verificar no banco de produção:**
```sql
-- spatial_ref_sys é excluída explicitamente: pertence à extensão PostGIS,
-- contém apenas dados públicos de sistemas de coordenadas (EPSG) e
-- não representa risco de segurança nem quebra de multitenancy.
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN ('spatial_ref_sys')
ORDER BY rowsecurity ASC, tablename ASC;
-- Todas as linhas devem ter rowsecurity = true
```

### Resultado da auditoria de RLS e views (QW-04, 2026-07-12)

Auditoria complementar à QW-02 cobrindo tabelas filhas, tabelas auxiliares e todas as views. Resultado: **nenhuma migration nova necessária** — todos os itens já estavam cobertos por correções históricas.

#### Tabelas filhas de `vistorias`

| Tabela | RLS | Policy | Migration de origem | Corrigida em |
|--------|-----|--------|---------------------|--------------|
| `vistoria_depositos` | ✅ | EXISTS via join a `vistorias` + `usuario_pode_acessar_cliente` | `20250318001000` | `20260319233000` |
| `vistoria_sintomas` | ✅ | `usuario_pode_acessar_cliente(cliente_id)` (tem `cliente_id` direto) | `20250318001000` | `20260319233000` |
| `vistoria_riscos` | ✅ | EXISTS via join a `vistorias` + `usuario_pode_acessar_cliente` | `20250318001000` | `20260319233000` |
| `vistoria_calhas` | ✅ | EXISTS via join a `vistorias` + `usuario_pode_acessar_cliente` | `20250318002000` | `20260319233000` |

**Nota sobre `vistoria_depositos` e `vistoria_riscos`:** essas tabelas não têm `cliente_id` direto. A policy usa `EXISTS (SELECT 1 FROM vistorias v WHERE v.id = vistoria_X.vistoria_id AND usuario_pode_acessar_cliente(v.cliente_id))` — padrão correto para tabelas filho sem tenant direto.

#### Views — status de security_invoker

| View | security_invoker | Como foi aplicado |
|------|-----------------|-------------------|
| `v_historico_atendimento_local` | ✅ | `WITH (security_invoker = true)` na criação |
| `v_recorrencias_ativas` | ✅ | `ALTER VIEW SET (security_invoker = on)` — `20260607000000` |
| `v_slas_iminentes` | ✅ | `ALTER VIEW SET (security_invoker = on)` — `20260607000000` |
| `v_cliente_uso_mensal` | ✅ | `ALTER VIEW SET (security_invoker = on)` — `20260607000000` |
| `v_imovel_historico_acesso` | ✅ | `ALTER VIEW SET (security_invoker = on)` — `20260607000000` |
| `v_focos_risco_ativos` | ✅ | `WITH (security_invoker = true)` na criação — `20260710000000` |
| `v_foco_risco_timeline` | ✅ | `WITH (security_invoker = true)` na criação — `20260710010000` |
| `v_focos_com_casos` | ✅ | `WITH (security_invoker = true)` na criação — `20260710030000` |
| `v_focos_risco_analytics` | ✅ | `WITH (security_invoker = true)` na criação — `20260710050000` |

**Por que `security_invoker` é obrigatório em views:** sem esta diretiva, a view executa com os privilégios do criador (geralmente `postgres` com `BYPASSRLS`). O RLS das tabelas subjacentes é ignorado e todos os dados de todos os clientes ficam visíveis para qualquer usuário autenticado que consulte a view. A migration `20260607000000` foi criada especificamente para corrigir este problema nas views pré-existentes.

#### Tabelas auxiliares confirmadas com RLS

| Tabela | Policy | Migration |
|--------|--------|-----------|
| `push_subscriptions` | `own_push_subscriptions` — via `usuario_id IN (SELECT id FROM usuarios WHERE auth_id = auth.uid())` | `20250317000000` |
| `yolo_feedback` | `yolo_feedback_isolamento` — via `cliente_id IN (SELECT ...)` | `20250317002000` |
| `levantamento_analise_ia` | `analise_ia_isolamento` — via `cliente_id IN (SELECT ...)` | `20250317002000` |
| `plano_acao_catalogo` | 4 policies (SELECT/INSERT/UPDATE/DELETE) via `usuario_pode_acessar_cliente` | `20250311110000` |
| `sla_feriados` | 4 policies via `usuario_pode_acessar_cliente` | `20250311130000` |
| `sla_config_regiao` | 4 policies via `usuario_pode_acessar_cliente` | `20250311180000` |
| `cliente_quotas` | SELECT via `usuario_pode_acessar_cliente`; escrita reservada a admin | `20250311190000` |
| `levantamento_item_recorrencia` | `lev_item_recorrencia_select` e outros | `20250311120000` |
| `levantamento_item_recorrencia_itens` | SELECT policy via join | `20250311120000` |
| `levantamento_item_evidencias` | 4 policies (SELECT/INSERT/UPDATE/DELETE) | `20250307120000` |
| `levantamento_item_status_historico` | SELECT + INSERT policies | `20250311100000` |

**Exceção conhecida — `spatial_ref_sys`:**
Tabela do PostGIS com ~8.500 linhas descrevendo sistemas de referência de coordenadas geográficas (EPSG codes). Dados públicos, estáticos, sem `cliente_id`, sem dados operacionais. Não representa risco de segurança nem quebra de multitenancy. Aparece no schema `public` porque o Supabase instala o PostGIS ali por padrão (`CREATE EXTENSION postgis` sem schema explícito). A correção estrutural (mover PostGIS para schema dedicado) tem custo e risco desproporcionais ao benefício — não está planejada.

---

## Controle de acesso por papel (RBAC)

### Os cinco papéis

| Papel | Acesso à interface | Acesso ao banco |
|-------|-------------------|-----------------|
| `admin` | Todo o sistema (todos os clientes) | `is_admin()` = true — acesso irrestrito via políticas |
| `supervisor` | Portal admin do próprio cliente | Tratado como `usuario` nas políticas do banco |
| `usuario` | Dashboard + análises | Acesso de leitura ao próprio cliente |
| `operador` | Portal `/operador/*` | `is_operador()` = true — restrições adicionais |
| `notificador` | Portal `/notificador/*` | Restrições específicas adicionadas em `20260605030000` |

**Observação importante:** no banco de dados, `supervisor` e `usuario` recebem as **mesmas permissões de RLS** — a distinção entre eles é feita apenas no frontend (guard de rota e menus). Um `usuario` que descobrisse as queries corretas poderia chamar métodos reservados a `supervisor` sem que o banco rejeitasse.

### Guards de rota no frontend

Implementados como componentes React reais que redirecionam para `/` se o papel não for adequado:

```typescript
// src/guards/AdminOrSupervisorGuard.tsx
// Redireciona para '/' se não for admin ou supervisor
if (!isAdminOrSupervisor) return <Navigate to="/" />;

// src/guards/OperadorGuard.tsx
// Redireciona para '/' se não for operador ou admin
```

**Limitação observada:** não existe um `SupervisorOnlyGuard`. A rota `/admin/clientes` (que lista todas as prefeituras) é protegida apenas pelo `AdminOrSupervisorGuard`, mas conceitualmente deveria ser acessível apenas a `admin`. Um `supervisor` que navegue diretamente para `/admin/clientes` pode ver a página, embora as queries do banco retornem apenas o seu próprio cliente.

---

## Funções SECURITY DEFINER — inventário

Funções `SECURITY DEFINER` executam com os privilégios do criador da função (geralmente `postgres`/superuser), não do usuário chamador. São necessárias para operações que precisam acessar dados além do que o RLS do chamador permitiria.

| Função | Onde definida | Por que SECURITY DEFINER |
|--------|---------------|--------------------------|
| `usuario_pode_acessar_cliente` | `20250302000000` | Precisa ler `papeis_usuarios` de qualquer usuário |
| `is_admin` | `20250302100000` | Lê `papeis_usuarios` para verificar papel |
| `usuario_cliente_id` | `20250306000000` | Lê `usuarios` para obter cliente_id |
| `is_operador` | `20250306000000` | Lê `papeis_usuarios` |
| `gerar_slas_para_run` | `20250303000000` | Cria SLAs em contexto de trigger, precisa ignorar RLS |
| `get_meu_papel` (RPC) | `20250306140000` | Lê `papeis_usuarios` do próprio usuário |
| `fn_transicionar_foco` (RPC) | `20260710000000` | Valida e executa state machine, grava histórico |
| `proximo_protocolo_notificacao` (RPC) | `20260401020000` | Incrementa sequencial de protocolo — acesso atômico com `ON CONFLICT DO UPDATE` |
| `canal_cidadao_denunciar` (RPC) | migration sprint4 | Permite inserção sem autenticação (cidadão anônimo) |
| `usuario_pode_acessar_risk_policy` | `20250302100000` | Lê tabela de políticas cruzando cliente |

**Risco das funções SECURITY DEFINER:** se uma dessas funções tiver um bug (SQL injection, lógica errada), o ataque operaria com privilégios elevados. As funções precisam ser auditadas periodicamente.

### Caso especial: `canal_cidadao_denunciar`

Esta é a única RPC que permite escrita **sem autenticação**. É acessada pela página pública `/denuncia/:slug/:bairroId`. O mecanismo de segurança é o `slug` — o cidadão precisa conhecer o slug da prefeitura (obtido via QR code físico).

**Risco:** o canal não tem rate limiting implementado. Um atacante com o slug poderia fazer flood de denúncias falsas. Esta é uma melhoria planejada (Etapa 2 do roadmap).

---

## Isolamento entre clientes — análise

### O que funciona bem

1. **RLS em todas as tabelas principais** — confirmado por migrations
2. **`cliente_id` em toda tabela** — padrão seguido consistentemente
3. **Função `usuario_pode_acessar_cliente`** — centraliza a lógica de verificação de acesso para admin
4. **Trigger de SLA e cruzamentos são SECURITY DEFINER** — operam corretamente em contexto de insert de qualquer usuário
5. **`foco_risco_historico`** tem `DELETE USING (false)` nas políticas RLS — registros são imutáveis mesmo para admin

### O que é incerto

**1. `notificacao_protocolo_seq` criada sem RLS — corrigida:**
Auditoria completa confirmou que todas as tabelas anteriormente incertas têm RLS. A única tabela encontrada sem RLS foi `notificacao_protocolo_seq`, corrigida pela migration `20260712010000`. Ver seção "Resultado da auditoria de RLS" acima.

**2. Service_role key nas Edge Functions:**
Todas as Edge Functions bypassam o RLS. Não há registro de auditoria de quais funções acessam dados de quais clientes. Se uma Edge Function errar o filtro de `cliente_id`, ela pode retornar ou modificar dados de uma prefeitura errada.

**3. Pipeline Python:**
Não está documentado se usa `anon key` (sujeito a RLS) ou `service_role` (bypassa RLS). Esta é a auditoria mais urgente — se usar `service_role`, tem acesso irrestrito a dados de todas as prefeituras.

**4. Supervisor pode ver `/admin/clientes`:**
A página que lista todas as prefeituras não tem proteção adicional além do `AdminOrSupervisorGuard`. A query do banco retornaria apenas o próprio cliente (pelo RLS), mas a experiência seria confusa. Além disso, se houver alguma query sem filtro de `cliente_id`, o RLS do banco seria a única proteção — e o supervisor não tem `is_admin()` = true, então verá apenas o próprio cliente pelos dados.

**5. `AdminSla.tsx` acessa `supabase` diretamente:**
Como documentado em `03-backend.md`, essa página importa `supabase` e faz queries diretamente, sem passar por `api.ts`. Essas queries não são auditadas centralmente para garantia de filtro por `cliente_id`.

---

## Riscos de segurança classificados

| Risco | Severidade | Probabilidade | Evidência |
|-------|-----------|---------------|-----------|
| Pipeline Python com `service_role` key (acesso irrestrito) | CRÍTICO | Média | Não documentado |
| Canal Cidadão sem rate limiting (flood de denúncias) | ALTO | Alta | Ausência de código de rate limit |
| `AdminSla.tsx` acessa banco diretamente (fora do padrão) | ALTO | Baixa (bug futuro) | `import { supabase }` na linha 5 |
| `notificacao_protocolo_seq` sem RLS | BAIXO | ~~Média~~ Resolvido | Corrigido em `20260712010000` — apenas contadores internos |
| Supervisor pode navegar para `/admin/clientes` | MÉDIO | Baixa | Ausência de guard específico |
| Funções SECURITY DEFINER não auditadas periodicamente | MÉDIO | Baixa (risco latente) | Volume de funções identificadas |
| ~~`payload` JSONB sobrescrito em caso de surto~~ | ~~ALTO~~ BAIXO | Inexistente | ✅ Resolvido (ADR-QW03) — ver `09-divida-tecnica.md` DT-12 |

---

## Políticas notáveis e correções de 2026

A sequência de patches de 2026 revela pontos onde as políticas iniciais estavam incorretas:

| Migration | O que corrigiu |
|-----------|----------------|
| `20260319233000` | RLS de vistoria não permitia que admin de uma prefeitura visse vistorias de seus operadores |
| `20260326133000` | Operadores não conseguiam ver outros operadores da mesma prefeitura |
| `20260326143000` | Supervisor não conseguia ver `papeis_usuarios` da sua própria equipe |
| `20260326170000` | RPC de denúncia não tinha grant correto para usuários autenticados |
| `20260605030000` | Papel `notificador` não tinha políticas adequadas no banco |
| `20260607000000` | Views com `SECURITY DEFINER` causavam problemas de permissão |
| `20260609000000` | Admin não conseguia ver `unidades_saude` de qualquer cliente |
| `20260712010000` | `notificacao_protocolo_seq` criada sem RLS — habilitado sem políticas (acesso via SECURITY DEFINER preservado) |

**Padrão observado:** as correções de RLS foram frequentes ao longo de 2026, indicando que as políticas foram testadas principalmente em campo, não com testes automatizados. Isso é esperado dado que não há suíte de testes para RLS.

---

## LGPD — controles implementados

| Medida | Implementação |
|--------|---------------|
| Sem PII em `casos_notificados` | Verificado: sem campos de nome, CPF, data de nascimento |
| Renomeação de campo sensível | `20260319242000` — renomeação de campo legado |
| Sem dados pessoais no canal cidadão | A denúncia captura localização e descrição, sem identificação |
| Dados de vistorias sem identificação de moradores | Apenas contagens (moradores_qtd, gravidas, idosos) |

**Ponto de atenção:** a tabela `vistorias` tem `lat_chegada` e `lng_chegada` (GPS do agente). Isso identifica a localização do agente, não do morador — mas combinar com `imovel_id` e `agente_id` poderia teoricamente rastrear o agente. Não é PII de cidadão, mas é dado sensível operacional.

---

*Documento baseado no código-fonte real. Versão 2.2.0, última atualização em 2026-07-12 (QW-04: auditoria completa de RLS, views security_invoker, tabelas filhas de vistoria e tabelas auxiliares — todos os itens confirmados como protegidos).*
