# AUDITORIA RLS — Sentinella Web
> Gerado em: 2026-04-02 | Base: schema.sql + migrations completas

---

## Contexto: modelo de segurança atual

O Sentinella usa duas camadas de segurança:

1. **RLS (banco)**: isolamento multi-tenant via `usuario_pode_acessar_cliente(cliente_id)`
2. **Guards (frontend)**: controle de papel via `isAdmin`, `isOperador`, etc.

O modelo atual aplica RLS **apenas para isolar tenants** — não diferencia papéis dentro do mesmo cliente. Controle de papel é responsabilidade do frontend. Isso é uma escolha de design válida, mas gera riscos se a API for acessada diretamente.

---

## Funções SQL de permissão

### Funções principais (todas SECURITY DEFINER, STABLE)

| Funcao | Logica | Problema |
|---|---|---|
| `is_admin()` | `papeis_usuarios.papel = 'admin'` | OK |
| `is_supervisor()` | `papel IN ('supervisor', 'moderador')` | OK |
| `is_operador()` | `papel = 'operador'` | OK |
| `usuario_pode_acessar_cliente(id)` | `usuario.cliente_id = id` OR `is_admin()` | OK — funcao central |
| `usuario_cliente_id()` | `SELECT cliente_id FROM usuarios WHERE auth_id = auth.uid()` | OK |
| `supervisor_pode_gerir_usuario(auth_id)` | `is_supervisor()` + mesmo cliente | OK |
| `operador_pode_gerir_usuario(auth_id)` | `is_operador()` + mesmo cliente | OK |
| `papel_permitido_para_supervisor(papel)` | `IN (supervisor, moderador, operador, notificador, usuario)` | supervisor pode criar supervisor |
| `papel_permitido_para_operador(papel)` | `IN (operador, usuario)` | OK |
| `get_meu_papel()` | CASE ordering, retorna papel mais alto | BUG: notificador tem prioridade 0 |
| `tem_papel(uid, papel)` | funcao legada | ainda referenciada por policies antigas |

### BUG em `get_meu_papel()`
```sql
-- CASE atual (sem notificador):
WHEN 'admin'      THEN 4
WHEN 'supervisor' THEN 3
WHEN 'moderador'  THEN 3
WHEN 'operador'   THEN 2
WHEN 'usuario'    THEN 1
ELSE 0   -- notificador cai aqui!
```
Usuario com papeis `notificador + usuario` retorna `usuario` (1 > 0). Frontend retornaria `notificador` (priority 2). **Comportamento divergente.**

---

## Matriz de permissoes por tabela

### Legenda
- `AC` = usuario_pode_acessar_cliente (admin + supervisor + operador + notificador do mesmo cliente)
- `ADM` = is_admin() apenas
- `ADM+SUP` = admin ou supervisor
- `true` = qualquer autenticado (cross-tenant!)
- `—` = sem policy (bloqueado por RLS se habilitado, ou sem RLS)

### Tabelas de dados principais

| Tabela | SELECT | INSERT | UPDATE | DELETE | Obs |
|---|---|---|---|---|---|
| `clientes` | AC | ADM | ADM | ADM | duplicata legada ativa |
| `usuarios` | AC\* | ADM ou op/sup no cliente | ADM ou op/sup no cliente | ADM ou sup no cliente | \*regras complexas |
| `papeis_usuarios` | proprio + ADM + sup/op no cliente | ADM ou sup/op (papeis limitados) | ADM ou sup/op | ADM ou sup/op | correto |
| `regioes` | AC | AC | AC | AC | operador pode criar/deletar regioes |
| `levantamentos` | AC | AC | AC | AC | operador pode criar levantamentos |
| `levantamento_itens` | AC (via lev) | AC (via lev) | AC (via lev) | AC (via lev) | operador pode deletar itens |
| `planejamento` | AC | AC | AC | AC | operador pode criar planejamentos |
| `voos` | AC (via plan) | AC (via plan) | AC (via plan) | AC (via plan) | operador pode criar voos |
| `drones` | **true** | ADM | ADM | ADM | VAZAMENTO CROSS-TENANT no SELECT |
| `imoveis` | AC + soft-delete | AC | AC | AC | operador pode deletar imoveis |
| `vistorias` | AC + soft-delete | AC | AC | AC | notificador pode criar vistorias |
| `vistoria_depositos` | AC (via vistoria) | AC (via vistoria) | AC (via vistoria) | AC (via vistoria) | correto |
| `vistoria_sintomas` | AC | AC | AC | AC | correto |
| `vistoria_riscos` | AC (via vistoria) | AC (via vistoria) | AC (via vistoria) | AC (via vistoria) | correto |
| `vistoria_calhas` | AC (via vistoria) | AC (via vistoria) | AC (via vistoria) | AC (via vistoria) | correto |
| `focos_risco` | AC + soft-delete | AC | AC | AC | operador pode criar/deletar focos |
| `casos_notificados` | AC + soft-delete | AC | AC | AC | operador pode criar casos |
| `unidades_saude` | AC | AC | AC | AC | operador pode criar/deletar UBS |
| `sla_operacional` | AC + fallback NULL | AC | AC | AC | operador pode atualizar SLA |
| `score_config` | AC | ADM+SUP | ADM+SUP | ADM+SUP | correto — restricao por papel |
| `yolo_feedback` | AC | AC | AC | AC | correto |
| `levantamento_analise_ia` | AC | AC | AC | AC | correto |
| `pluvio_risco` | AC (via regioes) | AC (via regioes) | AC (via regioes) | AC (via regioes) | operador pode criar registros pluvio |
| `pluvio_operacional_run` | AC | AC | AC | AC | operador pode escrever dados meteorologicos |
| `pluvio_operacional_item` | AC (via run) | AC (via run) | AC (via run) | AC (via run) | idem |
| `resumos_diarios` | AC | AC | AC | AC | correto |
| `cliente_integracoes` | AC | AC | AC | AC | operador pode alterar integracoes e-SUS |
| `item_notificacoes_esus` | AC | AC | AC | AC | operador pode criar notificacoes SINAN |
| `vistoria_drone_correlacao` | AC | AC | AC | AC | correto |
| `unidades_saude_sync_controle` | AC | AC | AC | — | sem DELETE policy |
| `unidades_saude_sync_log` | AC | AC | — | — | append-only correto |

### Tabelas de plataforma (admin-only)

| Tabela | SELECT | INSERT | UPDATE | DELETE | Obs |
|---|---|---|---|---|---|
| `sentinela_drone_risk_config` | ADM | ADM | ADM | ADM | correto |
| `sentinela_yolo_class_config` | ADM | ADM | ADM | ADM | correto |
| `sentinela_risk_policy` e filhas | AC | AC | AC | AC | supervisor/operador podem alterar |
| `audit_log` | ADM | — | — | — | correto |
| `billing_ciclo` | ADM | — | — | — | correto |
| `billing_usage_snapshot` | ADM | — | — | — | correto |
| `cliente_plano` | ADM | — | — | — | correto |
| `system_health_log` | ADM | — | — | — | correto |
| `job_queue` | ADM+AC | ADM | ADM cancelar | — | operador pode ver fila de jobs |

---

## Falhas de segurança identificadas

### CRITICO

#### F1: `drones` com SELECT aberto cross-tenant
```sql
CREATE POLICY "drones_select" ON drones FOR SELECT USING (true);
```
Qualquer usuario autenticado ve todos os drones de todas as prefeituras.
Drones revealam capacidade operacional de outros municipios.

**Correcao:**
```sql
DROP POLICY IF EXISTS "drones_select" ON drones;
-- drones nao tem cliente_id — ou adicionar cliente_id ou restringir a admin
CREATE POLICY "drones_select" ON drones FOR SELECT TO authenticated
  USING (public.is_admin());
-- se drones sao recursos da plataforma, apenas admin ve; supervisores veem seus drones via voos
```

#### F2: Politicas duplicadas legadas nao removidas (CLEANUP-03 incompleto)
O schema.sql ainda contem AMBAS:
- Policies antigas usando `tem_papel()`: "Admins atualizam clientes", "Admins gerenciam todos os papeis", "Admins full access sla", "Operadores update own sla", "Users read own client sla", "Usuarios veem regioes do seu cliente", etc.
- Policies novas usando `is_admin()`/`usuario_pode_acessar_cliente()`

Em PostgreSQL, duas policies PERMISSIVE na mesma tabela/operacao fazem OR — o acesso e concedido se QUALQUER uma permitir. Resultado: redundancia garantida, mas:
- Depende de `tem_papel()` existir e funcionar corretamente
- Confunde auditoria futura
- Desempenho adicional (duas avaliacoes por query)

**Tabelas afetadas pelos duplicados:**
- `clientes`: 4 ops com policy legada + nova
- `levantamentos`: 4 ops
- `levantamento_itens`: 4 ops
- `sla_operacional`: SELECT/UPDATE legados + novos
- `regioes`: multiplas policies antigas + novas (5+ policies ativas no SELECT)
- `usuarios`: legadas + novas
- `papeis_usuarios`: "Admins gerenciam todos os papeis" (tem_papel) + novas

**Correcao:** Criar migration CLEANUP-04 que dropa todas as policies com nome em portugues/old-style.

#### F3: `notificador` com prioridade 0 em `get_meu_papel()`
Descrito na secao de funcoes. Pode levar usuario a receber papel errado.

**Correcao:**
```sql
CREATE OR REPLACE FUNCTION public.get_meu_papel() RETURNS text AS $$
  SELECT LOWER(pu.papel::text)
  FROM papeis_usuarios pu
  WHERE pu.usuario_id = auth.uid()
  ORDER BY CASE LOWER(pu.papel::text)
    WHEN 'admin'       THEN 5
    WHEN 'supervisor'  THEN 4
    WHEN 'moderador'   THEN 4
    WHEN 'operador'    THEN 3
    WHEN 'notificador' THEN 2  -- ADICIONAR
    WHEN 'usuario'     THEN 1
    WHEN 'cliente'     THEN 1
    ELSE 0
  END DESC
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;
```

### ALTO

#### F4: Operador pode criar e deletar entidades administrativas
`usuario_pode_acessar_cliente()` e verdadeiro para operador. Portanto operador pode:
- INSERT em `regioes` — criar regioes falsas
- INSERT/DELETE em `planejamento` — criar/destruir planejamentos
- INSERT/DELETE em `levantamentos` — manipular levantamentos
- DELETE em `imoveis` — excluir imoveis (soft-delete presente mas operador pode acionar)
- DELETE em `casos_notificados` — destruir registros epidemiologicos
- DELETE em `focos_risco` — manipular estado de focos

**Impacto:** Via chamada direta a API Supabase (sem UI), operador de campo pode corromper dados administrativos.

**Correcao recomendada:** Adicionar verificacao de papel nas policies de INSERT/UPDATE/DELETE das tabelas criticas:
```sql
-- Exemplo para planejamento:
CREATE POLICY "planejamento_insert" ON planejamento FOR INSERT TO authenticated
  WITH CHECK (
    usuario_pode_acessar_cliente(cliente_id)
    AND EXISTS (
      SELECT 1 FROM papeis_usuarios pu
      WHERE pu.usuario_id = auth.uid()
        AND pu.papel IN ('admin', 'supervisor')
    )
  );
```

#### F5: Notificador pode criar vistorias, focos e imoveis
`usuario_pode_acessar_cliente()` e verdadeiro para notificador. Notificador pode INSERT em:
- `focos_risco` — criar focos sem inspecao real
- `vistorias` — criar vistorias sem ter ido a campo
- `imoveis` — criar imoveis no cadastro
- `planejamento`, `levantamentos` — idem operador

**Impacto:** Notificador de UBS pode inserir dados de campo que deveriam ser exclusivos de agentes.

#### F6: Operador pode alterar SLA
`sla_operacional` tem policy `sla_operacional_update` usando apenas `usuario_pode_acessar_cliente()`. Operador pode UPDATE em qualquer registro SLA do cliente, incluindo `status`, `data_resolucao`, `escalado_em`.

**Correcao:**
```sql
DROP POLICY IF EXISTS "sla_operacional_update" ON sla_operacional;
CREATE POLICY "sla_operacional_update" ON sla_operacional FOR UPDATE TO authenticated
  USING (
    cliente_id IS NOT NULL AND usuario_pode_acessar_cliente(cliente_id)
    AND EXISTS (
      SELECT 1 FROM papeis_usuarios pu
      WHERE pu.usuario_id = auth.uid()
        AND pu.papel IN ('admin', 'supervisor')
    )
  );
-- Operador pode apenas UPDATE seus proprios registros (status de atendimento)
```

#### F7: Operador pode alterar cliente_integracoes (configuracao e-SUS)
`cliente_integracoes` usa apenas `usuario_pode_acessar_cliente()`. Operador pode alterar API key, IBGE, ambiente (homolog/prod) da integracao com e-SUS Notifica.

**Correcao:**
```sql
DROP POLICY IF EXISTS "cliente_integracoes_insert" ON cliente_integracoes;
DROP POLICY IF EXISTS "cliente_integracoes_update" ON cliente_integracoes;
DROP POLICY IF EXISTS "cliente_integracoes_delete" ON cliente_integracoes;

CREATE POLICY "cliente_integracoes_insert" ON cliente_integracoes FOR INSERT TO authenticated
  WITH CHECK (usuario_pode_acessar_cliente(cliente_id) AND public.is_admin_or_supervisor());
CREATE POLICY "cliente_integracoes_update" ON cliente_integracoes FOR UPDATE TO authenticated
  USING (usuario_pode_acessar_cliente(cliente_id) AND public.is_admin_or_supervisor())
  WITH CHECK (usuario_pode_acessar_cliente(cliente_id) AND public.is_admin_or_supervisor());
CREATE POLICY "cliente_integracoes_delete" ON cliente_integracoes FOR DELETE TO authenticated
  USING (usuario_pode_acessar_cliente(cliente_id) AND public.is_admin_or_supervisor());
```

#### F8: Operador pode escrever dados meteorologicos (pluvio)
`pluvio_operacional_run` e `pluvio_operacional_item` tem policies `usuario_pode_acessar_cliente()` para INSERT/UPDATE/DELETE. Esses dados sao gerados por processo automatico Python — nenhum usuario deveria inserir manualmente.

**Correcao:** Restringir INSERT/UPDATE/DELETE a `is_admin()` ou service_role.

### MEDIO

#### F9: `sentinela_risk_policy` e filhas acessiveis por todos no cliente
As tabelas de politica de risco (`sentinela_risk_policy`, `sentinela_risk_defaults`, `sentinela_risk_rule`, etc.) usam `usuario_pode_acessar_cliente()` para TODAS as operacoes. Operador pode alterar parametros do modelo de risco pluvial.

#### F10: `supervisor_pode_gerir_usuario` permite supervisor criar supervisor
`papel_permitido_para_supervisor` inclui `supervisor` na lista. Um supervisor pode escalar qualquer usuario do proprio cliente para supervisor — inclusive sem auditoria especifica.

#### F11: `job_queue` visivel para todos os usuarios do cliente
A policy `job_queue_leitura` permite qualquer usuario do cliente ver a fila de jobs. Inclui payloads internos de processamento (score, CNES sync, etc.).

#### F12: `sentinela_risk_policy` sem restricao de papel para write
Supervisores e operadores podem modificar a configuracao de risco pluvial que afeta todo o planejamento operacional do municipio.

### BAIXO

#### F13: `unidades_saude` — operador pode criar/deletar postos de saude
INSERT e DELETE em `unidades_saude` usa apenas `usuario_pode_acessar_cliente()`. Operador pode adicionar ou inativar UBSs do municipio.

#### F14: `voo_correlacao` sem restricao — append-only esperado
`vistoria_drone_correlacao` tem UPDATE e DELETE policies abertas para todos do cliente. Correlacoes deveriam ser append-only (criadas por trigger).

---

## Tabelas sem RLS habilitado (risco se acessadas diretamente)

> Verificar se estas tabelas tem RLS habilitado no banco atual:

| Tabela | Risco |
|---|---|
| `push_subscriptions` | dados de endpoint de notificacao push por usuario |
| `canal_cidadao_rate_limit` | controle de spam do canal cidadao |
| `sla_erros_criacao` | log de erros internos de SLA |
| `cloudinary_orfaos` | fila de limpeza de arquivos |
| `pipeline_runs` | historico de runs do pipeline drone |
| `territorio_score` | scores territoriais calculados |
| `quarteiroes` | cadastro de quarteiraos |
| `distribuicao_quarteirao` | alocacao de quarteiraos por agente |
| `protocolo_notificacao` | protocolos emitidos ao cidadao |
| `alerta_retorno_imovel` | alertas de retorno pendentes |

---

## Resumo de conformidade por papel

### admin (plataforma SaaS)
| Operacao | Status |
|---|---|
| CRUD em clientes | OK (is_admin) |
| Ver todos os clientes | OK |
| Gerenciar usuarios (todos) | OK |
| Acessar logs/billing/saude | OK (ADM only) |
| Modificar configuracoes de plataforma | OK |
| **Problemas** | Dependencia de `tem_papel()` legada; duplicatas de policy |

### supervisor (gestor municipal)
| Operacao | Status |
|---|---|
| CRUD dentro do proprio cliente | OK |
| Gerenciar usuarios do proprio cliente | OK |
| Modificar score_config | OK (ADM+SUP restricao) |
| Ver dados de outros clientes | BLOQUEADO pelo banco |
| Alterar configuracoes de plataforma | BLOQUEADO pelo banco |
| Modificar integracao e-SUS | PERMITIDO (deveria ser ADM+SUP) |
| Criar supervisor para outro usuario | PERMITIDO (pode ser excessivo) |
| **Problemas** | F7, F10, F12 acima |

### operador / agente
| Operacao | Status |
|---|---|
| Realizar vistoria (CRUD vistorias) | OK |
| Ver imoveis do cliente | OK |
| Criar/deletar regioes | PERMITIDO INDEVIDAMENTE |
| Criar/deletar planejamentos | PERMITIDO INDEVIDAMENTE |
| Criar/deletar levantamentos | PERMITIDO INDEVIDAMENTE |
| Alterar SLA | PERMITIDO INDEVIDAMENTE |
| Alterar integracao e-SUS | PERMITIDO INDEVIDAMENTE |
| Ver fila de jobs | PERMITIDO (baixo risco) |
| Gerenciar usuarios (banco) | PERMITIDO (bloqueado na UI) |
| **Problemas** | F4, F6, F7, F8, F9 acima |

### notificador
| Operacao | Status |
|---|---|
| Registrar casos notificados | OK |
| Consultar casos do cliente | OK |
| Criar vistorias | PERMITIDO INDEVIDAMENTE |
| Criar focos de risco | PERMITIDO INDEVIDAMENTE |
| Criar imoveis | PERMITIDO INDEVIDAMENTE |
| Criar planejamentos | PERMITIDO INDEVIDAMENTE |
| **Problemas** | F5 acima |

### usuario
| Operacao | Status |
|---|---|
| Leitura de dados do cliente | OK (usuario_pode_acessar_cliente) |
| Qualquer escrita | PERMITIDO INDEVIDAMENTE (mesmo que operador) |
| **Problemas** | Sem restricao de escrita via banco |

---

## O que corrigir ANTES de producao

### Obrigatorio (bloqueia implantacao segura)

| # | Falha | Correcao |
|---|---|---|
| 1 | F1: `drones` SELECT cross-tenant | Restringir SELECT a is_admin() ou adicionar cliente_id |
| 2 | F3: `get_meu_papel()` sem notificador no CASE | Adicionar `WHEN 'notificador' THEN 2` |
| 3 | F2: Policies duplicadas legadas ativas | Criar migration CLEANUP-04 para dropar todas as old-style |
| 4 | F6: Operador pode alterar SLA | Restringir UPDATE em sla_operacional a admin+supervisor |
| 5 | F7: Operador pode alterar cliente_integracoes | Restringir INSERT/UPDATE/DELETE a admin+supervisor |

### Recomendado (risco real mas mitigado pela UI)

| # | Falha | Correcao |
|---|---|---|
| 6 | F4: Operador pode deletar regioes/planejamentos/levantamentos | Restringir DELETE critico a admin+supervisor |
| 7 | F5: Notificador pode criar focos/vistorias | Restringir INSERT em focos_risco/vistorias a papel IN (admin,supervisor,operador) |
| 8 | F8: Operador pode escrever dados pluvio | Restringir INSERT/UPDATE/DELETE pluvio a is_admin() |
| 9 | F9: Operador pode alterar parametros de risco | Restringir sentinela_risk_policy write a admin+supervisor |
| 10 | F10: Supervisor pode criar supervisor | Remover 'supervisor' de papel_permitido_para_supervisor, ou exigir confirmacao |

### Housekeeping

| # | Falha | Correcao |
|---|---|---|
| 11 | F11: job_queue visivel para todos do cliente | Restringir SELECT a admin+supervisor |
| 12 | F12: risk_policy write sem restricao de papel | Restringir a admin+supervisor |
| 13 | F13: UBS pode ser criada/deletada por operador | Restringir DELETE a admin+supervisor |
| 14 | F14: vistoria_drone_correlacao com UPDATE/DELETE | Tornar append-only (apenas INSERT) |
| 15 | Tabelas sem RLS listadas na secao anterior | Habilitar RLS e criar policies adequadas |

---

## Funcao auxiliar sugerida

Para simplificar as correcoes F4-F12, criar uma funcao helper:

```sql
CREATE OR REPLACE FUNCTION public.is_admin_or_supervisor()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM papeis_usuarios pu
    WHERE pu.usuario_id = auth.uid()
      AND LOWER(pu.papel::text) IN ('admin', 'supervisor', 'moderador')
  );
$$;
```

Depois aplicar em todas as policies de INSERT/UPDATE/DELETE das tabelas administrativas:
```sql
WITH CHECK (
  usuario_pode_acessar_cliente(cliente_id)
  AND public.is_admin_or_supervisor()
)
```

---

## Conclusao geral

O sistema esta multi-tenant seguro: nenhum usuario pode ver dados de outro cliente.

Os riscos existentes sao de **privilegio excessivo dentro do proprio cliente**:
operador e notificador podem escrever dados que deveriam ser exclusivos de supervisor.
Na pratica, o frontend bloqueia esse acesso via guards — mas a API Supabase fica exposta.

Para producao, o minimo necessario e:
1. Corrigir o vazamento cross-tenant de `drones`
2. Corrigir `get_meu_papel()` para incluir notificador
3. Limpar policies duplicadas legadas
4. Restringir `sla_operacional` e `cliente_integracoes` a admin+supervisor
