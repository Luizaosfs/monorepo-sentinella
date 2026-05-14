# Estado Real do Banco de Dados — Sentinella (NestJS prod)

> **Fonte única de verdade.** Documento gerado em 2026-05-14 a partir de consulta direta a `pg_trigger` e `pg_proc` no banco de produção (`177.7.37.14:5432/sentinella`, PostgreSQL 17.5). Substitui qualquer afirmação em documentação anterior sobre triggers/funções legadas.

## TL;DR

| | Schema Supabase legado | **Banco NestJS atual** |
|---|---|---|
| Triggers de aplicação (`trg_*`) | ~102 | **0** |
| Funções PL/pgSQL (`fn_*`, `rpc_*`) | ~100+ | **0** |
| Lógica de negócio | No banco | **No código TypeScript (NestJS)** |

**A migração Supabase → NestJS removeu inteiramente a lógica do banco.** O banco hoje só guarda dados e impõe integridade referencial via FKs/checks. Toda regra de negócio mora em `apps/backend/src/modules/*/use-cases/`.

## O que existe hoje no banco

```sql
-- consulta executada em 2026-05-14
SELECT
  COUNT(*) FILTER (WHERE NOT tgisinternal) AS usuario,   -- 1
  COUNT(*) FILTER (WHERE tgisinternal)     AS internas,  -- 400
  COUNT(*)                                 AS total      -- 401
FROM pg_trigger;
```

- **1 trigger de "usuário"**: `topology.layer.layer_integrity_checks → topology.layertrigger()`. Vem da extensão `postgis_topology`. Não é código Sentinella.
- **400 triggers internas** (`RI_ConstraintTrigger_*`): geradas automaticamente pelo PostgreSQL para implementar FK com `ON DELETE/UPDATE CASCADE/RESTRICT/SET NULL`. Existem em qualquer banco com FKs.
- **0 funções `fn_*`, `rpc_*`, `trg_*`** no schema `public`. As 809 funções em `public` são todas das extensões PostGIS/tiger/topology.

## O que mudou na migração

Toda essa lógica que **antes era trigger PL/pgSQL** hoje é **código TypeScript no NestJS**:

| Comportamento legado (trigger) | Onde mora hoje |
|---|---|
| `fn_registrar_historico_foco` (registrar transição em `foco_risco_historico`) | `apps/backend/src/modules/foco-risco/use-cases/*` — INSERT explícito em cada use-case que muda status |
| `trg_set_codigo_foco` / `fn_gerar_codigo_foco` (gerar `codigo_foco` YYYY-NNNNNNNN) | Use-case de criação de foco |
| `trg_iniciar_sla_ao_confirmar_foco`, `trg_fechar_sla_ao_resolver_foco`, `trg_vincular_sla_ao_confirmar` | Módulo `sla` — abertura/fechamento chamado dos use-cases de foco |
| `trg_cruzar_foco_novo_com_casos`, `trg_cruzar_caso_focos`, `trg_sincronizar_casos_foco` | Use-cases de criação de foco e de caso notificado |
| `trg_score_caso`, `trg_score_vistoria` | Módulo `score` chamado explicitamente |
| `trg_seed_cliente_plano_on_insert`, `trg_seed_cliente_quotas_on_insert`, `trg_seed_score_config`, `trg_seed_sla_*`, `trg_seed_plano_acao_catalogo_on_cliente`, `trg_seed_drone_risk_config_on_cliente` | Use-case `criar-cliente` faz os INSERTs em cascata |
| `trg_check_quota_*` (vistorias, voos, usuários, levantamentos, itens) | Módulo `quotas` — validação no use-case antes do INSERT |
| `trg_validar_transicao_foco_risco` | Validação no use-case `rpc_transicionar_foco_risco` (agora TS) |
| `trg_auto_classificar_foco`, `trg_auto_triagem_foco` | Use-cases de criação de foco |
| `trg_criar_foco_de_levantamento_item`, `trg_criar_foco_de_vistoria_deposito` | Use-case de salvar levantamento/vistoria gera foco explicitamente |
| `trg_consolidar_*` (calhas, depósitos, riscos, sintomas, vistoria) | Use-case de salvar vistoria consolida no agregado |
| `trg_atualizar_perfil_imovel` | Use-case de salvar vistoria atualiza `imoveis.perfil_*` |
| `trg_auto_em_inspecao_por_vistoria`, `trg_registrar_inspecao_em` | Use-case `iniciar-inspecao` (`apps/backend/src/modules/foco-risco/use-cases/iniciar-inspecao.ts:84` — comentário "paridade com fn_registrar_historico_foco") |
| `trg_bloquear_delete_*` (cliente, imóvel, vistoria) | Guard/validação no use-case de delete; soft-delete via `deleted_at` |
| `trg_audit_*` (integrações, plano, papeis_usuarios, sla_config, usuarios) | Módulo `audit` — INSERT em tabela de audit chamado dos use-cases |
| `trg_cancelar_reinspecoes_ao_fechar_foco`, `trg_criar_reinspecao_pos_tratamento` | Módulo `reinspecao` — use-cases acionados de foco |
| `trg_notif_foco_cidadao` | Módulo `notificacoes` — disparo explícito |
| `trg_*_updated_at` (em quase toda tabela) | TypeORM/Prisma `@UpdateDateColumn` ou equivalente |
| `trg_*_created_by`, `trg_set_updated_by`, `trg_*_set_cliente_id` | Interceptor/decorator NestJS preenche no momento do request |

## Implicações práticas

1. **INSERT/UPDATE direto via SQL bypassa toda a lógica.** Sempre passar pelos use-cases NestJS.
2. **Não confiar em COMMENTs nas tabelas** que mencionam triggers ou funções `fn_*`. Eles são lixo documental que sobreviveu à migração. Ex.:
   - `foco_risco_historico`: "INSERT apenas via trigger fn_registrar_historico_foco" → **falso**, a trigger não existe; o ledger é mantido pelo use-case.
   - `focos_risco.codigo_foco`: "Gerado automaticamente pelo trigger trg_set_codigo_foco via fn_gerar_codigo_foco" → **falso**, gerado em TS.
   - `clientes.deleted_at`: "DELETE físico bloqueado por trigger trg_bloquear_delete_cliente" → **falso**, bloqueio é no use-case.
   - `caso_foco_cruzamento`: "preenchida pelo trigger trg_cruzar_caso_focos" → **falso**.
3. **Schemas dump (`pg_dump --schema-only`) confirmam**: zero `CREATE TRIGGER` e zero `CREATE FUNCTION` em `public`. Apenas tabelas, índices, tipos e constraints.
4. **Documentos em `apps/frontend/docs/`, `apps/frontend/audit-*.md`, `apps/frontend/AUDIT*.md`, `apps/frontend/AUDITORIA*.md` etc. que descrevem comportamento de triggers**: foram escritos durante o período Supabase. **Descrevem corretamente o COMPORTAMENTO esperado** (ex.: "ao mudar status de foco, registra histórico") — só erram ao dizer que a mecânica é trigger. Hoje a mecânica é use-case TS, mas o resultado final precisa ser idêntico.

## Como reverificar o estado real

```bash
PG="/cygdrive/c/Program Files/PostgreSQL/17/bin/psql.exe"
export DATABASE_URL=$(grep '^DATABASE_URL=' apps/backend/.env | cut -d= -f2-)

# triggers de usuário
"$PG" "$DATABASE_URL" -c "
SELECT n.nspname, c.relname, t.tgname, p.proname
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal AND n.nspname NOT IN ('topology','tiger','tiger_data');
"

# funções de aplicação
"$PG" "$DATABASE_URL" -c "
SELECT n.nspname || '.' || p.proname
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prokind = 'f'
  AND p.proname NOT LIKE 'st_%' AND p.proname NOT LIKE '_st_%'
  AND p.proname NOT LIKE 'geometry%' AND p.proname NOT LIKE 'geography%'
  AND p.proname NOT LIKE 'pg%' AND p.proname NOT LIKE 'postgis%';
"
```

Se ambas as queries retornarem 0 linhas → o estado descrito aqui continua válido.

## Referências históricas

- Schema Supabase legacy completo (pré-migração): `apps/frontend/docs/legacy/schema-frontend-root.sql` e `schema-supabase-folder.sql`
- Dump live mais recente (schema-only): `D:/sentinella/schema_live_20260514_191840.sql`
- Projeto Supabase legacy (código pré-migração): `D:/sentinella/sentinelaweb`
