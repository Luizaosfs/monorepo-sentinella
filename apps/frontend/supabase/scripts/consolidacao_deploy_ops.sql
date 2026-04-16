-- =============================================================================
-- consolidacao_deploy_ops.sql
-- Material operacional — Consolidação Automática de Vistoria (Fases 1-3)
--
-- NÃO executar como migration. Arquivo de referência operacional.
-- Seções:
--   A. Checklist de deploy (staging e produção)
--   B. Script de testes manuais pós-migration
--   C. Script de backfill em lotes para registros legados
--   D. Consultas de auditoria e validação contínua
-- =============================================================================


-- =============================================================================
-- A. CHECKLIST DE DEPLOY
-- =============================================================================

/*
──────────────────────────────────────────────────────────────────────────────
STAGING
──────────────────────────────────────────────────────────────────────────────

Pré-condições
  [ ] Banco de staging é cópia recente de produção (ou tem dados representativos)
  [ ] Supabase CLI configurado: npx supabase db push --dry-run sem erros

Aplicar migrations (ordem obrigatória)
  [ ] 20270219000000_consolidacao_vistoria_fase1.sql  — colunas + tabelas auxiliares
  [ ] 20270220000000_consolidacao_vistoria_fase2.sql  — fn_consolidar_vistoria()
  [ ] 20270221000000_consolidacao_vistoria_fase3.sql  — triggers automáticos

Validar estrutura após Fase 1
  [ ] SELECT column_name FROM information_schema.columns
      WHERE table_name = 'vistorias' AND column_name = 'prioridade_final';
      -- deve retornar 1 linha

  [ ] SELECT COUNT(*) FROM consolidacao_pesos_config;
      -- deve retornar 16 (seed v1.0.0)

  [ ] SELECT COUNT(*) FROM vistoria_consolidacao_historico;
      -- deve retornar 0

Validar função após Fase 2
  [ ] SELECT proname FROM pg_proc WHERE proname = 'fn_consolidar_vistoria';
      -- deve retornar 1 linha

  [ ] SELECT prosecdef FROM pg_proc WHERE proname = 'fn_consolidar_vistoria';
      -- deve retornar true (SECURITY DEFINER)

Validar triggers após Fase 3
  [ ] SELECT trigger_name FROM information_schema.triggers
      WHERE event_object_table IN (
        'vistorias','vistoria_sintomas','vistoria_riscos',
        'vistoria_depositos','vistoria_calhas'
      )
      ORDER BY event_object_table, trigger_name;
      -- deve listar todos os triggers criados (ver seção B para lista esperada)

Executar testes manuais (seção B deste arquivo)
  [ ] Todos os 9 cenários passaram

Backfill de staging (seção C deste arquivo)
  [ ] Executado e concluído sem erros críticos
  [ ] SELECT COUNT(*) FROM vistorias WHERE prioridade_final IS NULL retorna 0

──────────────────────────────────────────────────────────────────────────────
PRODUÇÃO
──────────────────────────────────────────────────────────────────────────────

Pré-condições
  [ ] Staging validado e aprovado
  [ ] Janela de manutenção definida (recomendado: fora do horário de operação de campo)
  [ ] Backup recente confirmado
  [ ] Responsável técnico disponível durante o deploy

Aplicar migrations
  [ ] npx supabase db push  (aplica as 3 migrations em sequência)
  [ ] Confirmar no log: nenhum erro, nenhum WARNING inesperado

Verificar pós-deploy imediato
  [ ] SELECT COUNT(*) FROM consolidacao_pesos_config WHERE ativo = true;
      -- deve retornar 16

  [ ] SELECT COUNT(*) FROM vistorias WHERE prioridade_final IS NOT NULL;
      -- deve retornar 0 (antes do backfill) ou > 0 se houver vistorias recém inseridas

  [ ] Inserir uma vistoria de teste (via app ou SQL) e confirmar que
      prioridade_final é preenchida automaticamente após INSERT

Backfill de produção (seção C deste arquivo)
  [ ] Verificar volume: SELECT COUNT(*) FROM vistorias WHERE prioridade_final IS NULL;
  [ ] Executar em horário de baixo uso, lotes de 200
  [ ] Monitorar pg_stat_activity durante execução
  [ ] Ao final: SELECT COUNT(*) FROM vistorias WHERE prioridade_final IS NULL = 0

Rollback (se necessário)
  -- Fase 3: DROP TRIGGER ... ON vistorias/sub-tabelas
  -- Fase 2: DROP FUNCTION fn_consolidar_vistoria
  -- Fase 1: colunas e tabelas foram criadas com IF NOT EXISTS — remoção manual
  --         apenas se estritamente necessário (dados serão perdidos)
  -- Não há migration de rollback automática — operação manual.
*/


-- =============================================================================
-- B. TESTES MANUAIS PÓS-MIGRATION
-- =============================================================================
-- Executar em staging após aplicar as 3 migrations.
-- Cada bloco é independente. Usar cliente_id e agente_id reais do ambiente.
-- Substituir '<cliente_id>' e '<agente_id>' pelos UUIDs corretos.
-- =============================================================================

-- ── Setup: variáveis de teste ─────────────────────────────────────────────
-- Executar primeiro para obter IDs válidos:
/*
SELECT id AS cliente_id FROM clientes LIMIT 1;
SELECT id AS agente_id  FROM usuarios WHERE papel_app = 'agente' LIMIT 1;
SELECT id AS imovel_id  FROM imoveis  LIMIT 1;
*/


-- ────────────────────────────────────────────────────────────────────────────
-- CENÁRIO 1: Sem acesso — 1ª tentativa → P4
-- ────────────────────────────────────────────────────────────────────────────
/*
INSERT INTO vistorias (cliente_id, imovel_id, agente_id, acesso_realizado, status)
VALUES ('<cliente_id>', '<imovel_id>', '<agente_id>', false, 'fechado')
RETURNING id, prioridade_final, resultado_operacional, consolidacao_resumo;

-- Esperado:
--   resultado_operacional = 'sem_acesso'
--   prioridade_final      = 'P4'
--   consolidacao_resumo   LIKE 'sem_acesso%'
*/


-- ────────────────────────────────────────────────────────────────────────────
-- CENÁRIO 2: Sem acesso recorrente — 3ª tentativa → P3
-- ────────────────────────────────────────────────────────────────────────────
/*
-- (Assumindo que já existem 2 vistorias com acesso_realizado=false para o mesmo imovel_id)
INSERT INTO vistorias (cliente_id, imovel_id, agente_id, acesso_realizado, status)
VALUES ('<cliente_id>', '<imovel_id>', '<agente_id>', false, 'fechado')
RETURNING id, prioridade_final, prioridade_motivo;

-- Esperado:
--   prioridade_final  = 'P3'
--   prioridade_motivo LIKE '%tentativas (≥3)%'
*/


-- ────────────────────────────────────────────────────────────────────────────
-- CENÁRIO 3: Visitado sem fichas — consolidacao_incompleta = true, P3
-- ────────────────────────────────────────────────────────────────────────────
/*
INSERT INTO vistorias (cliente_id, imovel_id, agente_id, acesso_realizado, status)
VALUES ('<cliente_id>', '<imovel_novo_id>', '<agente_id>', true, 'visitado')
RETURNING id, prioridade_final, consolidacao_incompleta, consolidacao_resumo;

-- Esperado:
--   prioridade_final        = 'P3'  (fallback — fichas ausentes)
--   consolidacao_incompleta = true
--   consolidacao_resumo     LIKE '%[INCOMPLETO]%'
*/


-- ────────────────────────────────────────────────────────────────────────────
-- CENÁRIO 4: Visitado com depósitos negativos — P4 conservador
-- ────────────────────────────────────────────────────────────────────────────
/*
DO $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO vistorias (cliente_id, imovel_id, agente_id, acesso_realizado, status)
  VALUES ('<cliente_id>', '<imovel_id>', '<agente_id>', true, 'visitado')
  RETURNING id INTO v_id;

  INSERT INTO vistoria_sintomas (vistoria_id, cliente_id, moradores_sintomas_qtd)
  VALUES (v_id, '<cliente_id>', 0);

  INSERT INTO vistoria_riscos (vistoria_id) VALUES (v_id);

  INSERT INTO vistoria_depositos (vistoria_id, tipo, qtd_inspecionados, qtd_com_focos)
  VALUES (v_id, 'A1', 3, 0);

  -- Verificar resultado após todos os INSERTs
  RAISE NOTICE 'Vistoria %: prioridade=%, risco_vetorial=%',
    v_id,
    (SELECT prioridade_final   FROM vistorias WHERE id = v_id),
    (SELECT risco_vetorial     FROM vistorias WHERE id = v_id);
END;
$$;

-- Esperado:
--   risco_vetorial   = 'medio'  (inspecionado e negativo — comportamento conservador)
--   prioridade_final = 'P4'
*/


-- ────────────────────────────────────────────────────────────────────────────
-- CENÁRIO 5: Foco confirmado em depósito → risco_vetorial = critico, P3
-- ────────────────────────────────────────────────────────────────────────────
/*
DO $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO vistorias (cliente_id, imovel_id, agente_id, acesso_realizado, status)
  VALUES ('<cliente_id>', '<imovel_id>', '<agente_id>', true, 'visitado')
  RETURNING id INTO v_id;

  INSERT INTO vistoria_depositos (vistoria_id, tipo, qtd_inspecionados, qtd_com_focos)
  VALUES (v_id, 'B', 2, 1);

  RAISE NOTICE 'Vistoria %: prioridade=%, risco_vetorial=%',
    v_id,
    (SELECT prioridade_final FROM vistorias WHERE id = v_id),
    (SELECT risco_vetorial   FROM vistorias WHERE id = v_id);
END;
$$;

-- Esperado:
--   risco_vetorial   = 'critico'
--   prioridade_final = 'P3'
*/


-- ────────────────────────────────────────────────────────────────────────────
-- CENÁRIO 6: Alerta urgente com risco alto → P1 (override ativo)
-- ────────────────────────────────────────────────────────────────────────────
/*
DO $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO vistorias (
    cliente_id, imovel_id, agente_id, acesso_realizado, status, moradores_qtd
  ) VALUES ('<cliente_id>', '<imovel_id>', '<agente_id>', true, 'visitado', 4)
  RETURNING id INTO v_id;

  -- 3 de 4 moradores com febre = proporção 75% > 50% → urgente
  INSERT INTO vistoria_sintomas (vistoria_id, cliente_id, febre, moradores_sintomas_qtd)
  VALUES (v_id, '<cliente_id>', true, 3);

  -- Foco vetorial: risco alto
  INSERT INTO vistoria_depositos (vistoria_id, tipo, qtd_inspecionados, qtd_com_focos)
  VALUES (v_id, 'A2', 2, 1);

  RAISE NOTICE 'Vistoria %: prioridade=%, alerta=%, override=%',
    v_id,
    (SELECT prioridade_final FROM vistorias WHERE id = v_id),
    (SELECT alerta_saude     FROM vistorias WHERE id = v_id),
    (SELECT (consolidacao_json->>'override_ativado')::boolean FROM vistorias WHERE id = v_id);
END;
$$;

-- Esperado:
--   alerta_saude      = 'urgente'
--   prioridade_final  = 'P1'
--   override_ativado  = true
*/


-- ────────────────────────────────────────────────────────────────────────────
-- CENÁRIO 7: Vistoria completa sem riscos → P5
-- ────────────────────────────────────────────────────────────────────────────
/*
DO $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO vistorias (cliente_id, imovel_id, agente_id, acesso_realizado, status)
  VALUES ('<cliente_id>', '<imovel_id>', '<agente_id>', true, 'visitado')
  RETURNING id INTO v_id;

  INSERT INTO vistoria_sintomas (vistoria_id, cliente_id, moradores_sintomas_qtd)
  VALUES (v_id, '<cliente_id>', 0);

  INSERT INTO vistoria_riscos (vistoria_id) VALUES (v_id);  -- todos false por padrão

  INSERT INTO vistoria_depositos (vistoria_id, tipo, qtd_inspecionados, qtd_com_focos)
  VALUES (v_id, 'A1', 5, 0);

  RAISE NOTICE 'Vistoria %: prioridade=%, fallback=%, incompleta=%',
    v_id,
    (SELECT prioridade_final FROM vistorias WHERE id = v_id),
    (SELECT (consolidacao_json->>'fallback_aplicado')::boolean FROM vistorias WHERE id = v_id),
    (SELECT consolidacao_incompleta FROM vistorias WHERE id = v_id);
END;
$$;

-- Esperado:
--   prioridade_final        = 'P5'
--   fallback_aplicado       = true
--   consolidacao_incompleta = false
*/


-- ────────────────────────────────────────────────────────────────────────────
-- CENÁRIO 8: Anti-recursão — confirmar que UPDATE das colunas-output
--             não dispara nova consolidação
-- ────────────────────────────────────────────────────────────────────────────
/*
DO $$
DECLARE
  v_id         uuid;
  v_consolidado timestamptz;
BEGIN
  -- Usar vistoria já existente com prioridade_final preenchida
  SELECT id, consolidado_em INTO v_id, v_consolidado
  FROM vistorias WHERE prioridade_final IS NOT NULL LIMIT 1;

  -- UPDATE direto em coluna-output (não deve disparar trigger)
  UPDATE vistorias SET consolidacao_resumo = consolidacao_resumo WHERE id = v_id;

  -- Verificar se consolidado_em mudou (não deveria)
  ASSERT (SELECT consolidado_em FROM vistorias WHERE id = v_id) = v_consolidado,
    'FALHA: consolidado_em mudou após UPDATE de coluna-output — trigger recursiva!';

  RAISE NOTICE 'PASSOU: sem recursão em UPDATE de coluna-output';
END;
$$;
*/


-- ────────────────────────────────────────────────────────────────────────────
-- CENÁRIO 9: Reprocessamento — verificar arquivamento no histórico
-- ────────────────────────────────────────────────────────────────────────────
/*
DO $$
DECLARE
  v_id uuid;
  v_hist_count int;
BEGIN
  -- Usar vistoria já consolidada
  SELECT id INTO v_id FROM vistorias WHERE prioridade_final IS NOT NULL LIMIT 1;

  SELECT COUNT(*) INTO v_hist_count
  FROM vistoria_consolidacao_historico WHERE vistoria_id = v_id;

  -- Forçar reprocessamento manual
  PERFORM fn_consolidar_vistoria(v_id, 'teste de reprocessamento manual');

  -- Deve ter 1 registro a mais no histórico
  ASSERT (
    SELECT COUNT(*) FROM vistoria_consolidacao_historico WHERE vistoria_id = v_id
  ) = v_hist_count + 1,
    'FALHA: histórico não foi arquivado';

  RAISE NOTICE 'PASSOU: arquivamento no histórico confirmado';
END;
$$;
*/


-- =============================================================================
-- C. BACKFILL DE REGISTROS LEGADOS
-- =============================================================================
-- Executar SEPARADAMENTE, fora do horário de pico.
-- NÃO incluir em migration automática.
-- =============================================================================

/*
-- Passo 1: verificar volume e estimar tempo
SELECT
  COUNT(*)                                                AS total_pendentes,
  ROUND(COUNT(*) / 200.0)::int                            AS lotes_estimados,
  MIN(created_at)                                         AS mais_antigo,
  MAX(created_at)                                         AS mais_recente
FROM vistorias
WHERE prioridade_final IS NULL;


-- Passo 2: executar backfill em lotes de 200
DO $$
DECLARE
  v_ids    uuid[];
  v_id     uuid;
  v_ok     int     := 0;
  v_err    int     := 0;
  v_total  int     := 0;
  v_lote   int     := 200;  -- ajustar: 100 em prod conservadora, 500 em staging
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM vistorias WHERE prioridade_final IS NULL;

  RAISE NOTICE 'Backfill iniciado: % registros pendentes', v_total;

  LOOP
    -- Próximo lote: mais recentes primeiro (maior relevância operacional)
    SELECT array_agg(id) INTO v_ids
    FROM (
      SELECT id FROM vistorias
      WHERE prioridade_final IS NULL
      ORDER BY created_at DESC
      LIMIT v_lote
    ) sub;

    EXIT WHEN v_ids IS NULL OR array_length(v_ids, 1) = 0;

    FOREACH v_id IN ARRAY v_ids LOOP
      BEGIN
        PERFORM fn_consolidar_vistoria(v_id);
        v_ok := v_ok + 1;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Backfill falhou para vistoria_id=%: %', v_id, SQLERRM;
        v_err := v_err + 1;
      END;
    END LOOP;

    RAISE NOTICE 'Lote: % ok / % erro | acumulado: % / %',
      v_ok, v_err, (v_ok + v_err), v_total;

    EXIT WHEN (v_ok + v_err) >= v_total;
  END LOOP;

  RAISE NOTICE '=== Backfill concluído: % consolidadas, % com erro ===', v_ok, v_err;
END;
$$;


-- Passo 3: verificar se restou algum pendente
SELECT COUNT(*) AS pendentes_restantes
FROM vistorias WHERE prioridade_final IS NULL;
-- Esperado: 0


-- Passo 4: verificar erros de backfill (vistorias com consolidado_em NULL
--          mas que não são novas — created_at antigo)
SELECT id, created_at, status, acesso_realizado
FROM vistorias
WHERE prioridade_final IS NULL
  AND created_at < now() - interval '1 hour'
ORDER BY created_at;
-- Esperado: vazio. Qualquer linha aqui requer investigação manual.
*/


-- =============================================================================
-- D. CONSULTAS DE AUDITORIA E VALIDAÇÃO CONTÍNUA
-- =============================================================================


-- ── D1. Visão geral da consolidação ──────────────────────────────────────
SELECT
  COUNT(*)                                                        AS total_vistorias,
  COUNT(*) FILTER (WHERE prioridade_final IS NOT NULL)            AS consolidadas,
  COUNT(*) FILTER (WHERE prioridade_final IS NULL)                AS pendentes,
  ROUND(
    COUNT(*) FILTER (WHERE prioridade_final IS NOT NULL)::numeric
    / NULLIF(COUNT(*), 0) * 100, 1
  )                                                               AS pct_consolidado,
  COUNT(*) FILTER (WHERE consolidacao_incompleta = true)          AS com_incompleta,
  MIN(consolidado_em)                                             AS primeira_consolidacao,
  MAX(consolidado_em)                                             AS ultima_consolidacao
FROM vistorias;


-- ── D2. Distribuição de prioridade_final ──────────────────────────────────
SELECT
  prioridade_final,
  COUNT(*)                                                        AS qtd,
  ROUND(COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER (), 0) * 100, 1) AS pct
FROM vistorias
WHERE prioridade_final IS NOT NULL
GROUP BY prioridade_final
ORDER BY prioridade_final;


-- ── D3. Vistorias com consolidacao_incompleta = true ─────────────────────
-- Motivos de incompletude extraídos do JSON (cobertura de dados)
SELECT
  COUNT(*)                                                        AS total_incompletas,
  COUNT(*) FILTER (
    WHERE (consolidacao_json->'cobertura_dados'->>'tem_sintomas')::boolean = false
  )                                                               AS sem_sintomas,
  COUNT(*) FILTER (
    WHERE (consolidacao_json->'cobertura_dados'->>'tem_riscos')::boolean = false
  )                                                               AS sem_riscos,
  COUNT(*) FILTER (
    WHERE (consolidacao_json->'cobertura_dados'->>'tem_depositos')::boolean = false
  )                                                               AS sem_depositos,
  COUNT(*) FILTER (
    WHERE (consolidacao_json->>'dado_inconsistente')::boolean = true
  )                                                               AS flags_sem_peso
FROM vistorias
WHERE consolidacao_incompleta = true;


-- ── D4. Vistorias que usaram fallback de prioridade ───────────────────────
SELECT
  prioridade_final,
  COUNT(*)                                                        AS qtd,
  prioridade_motivo
FROM vistorias
WHERE (consolidacao_json->>'fallback_aplicado')::boolean = true
GROUP BY prioridade_final, prioridade_motivo
ORDER BY prioridade_final;


-- ── D5. Vistorias com override de alerta_saude ────────────────────────────
SELECT
  prioridade_final,
  COUNT(*)                                                        AS qtd,
  ROUND(AVG(
    (consolidacao_json->'alerta_saude'->>'proporcao_sintomas')::numeric
  ), 3)                                                           AS media_proporcao_sintomas
FROM vistorias
WHERE (consolidacao_json->>'override_ativado')::boolean = true
GROUP BY prioridade_final
ORDER BY prioridade_final;


-- ── D6. Histórico: automático vs. manual ─────────────────────────────────
SELECT
  CASE
    WHEN motivo_reprocessamento LIKE 'automático%' THEN 'automático'
    ELSE 'manual'
  END                                                             AS tipo,
  motivo_reprocessamento,
  COUNT(*)                                                        AS qtd
FROM vistoria_consolidacao_historico
GROUP BY tipo, motivo_reprocessamento
ORDER BY tipo, COUNT(*) DESC;


-- ── D7. Flags sem peso cadastrado (dado_inconsistente) ────────────────────
-- Lista quais flags estão causando dado_inconsistente = true
SELECT
  flag                                                            AS flag_sem_peso,
  COUNT(*)                                                        AS ocorrencias
FROM vistorias,
  jsonb_array_elements_text(
    consolidacao_json->'risco_socioambiental'->'flags_sem_peso'
  ) AS flag
WHERE (consolidacao_json->>'dado_inconsistente')::boolean = true
GROUP BY flag
ORDER BY ocorrencias DESC;
-- Resultado vazio = configuração completa em consolidacao_pesos_config


-- ── D8. Vistorias com prioridade P1 ou P2 ativas (painel de risco crítico) ─
SELECT
  v.id                                                            AS vistoria_id,
  v.cliente_id,
  v.imovel_id,
  v.prioridade_final,
  v.dimensao_dominante,
  v.prioridade_motivo,
  v.alerta_saude,
  v.risco_vetorial,
  v.vulnerabilidade_domiciliar,
  v.consolidado_em
FROM vistorias v
WHERE v.prioridade_final IN ('P1', 'P2')
  AND v.prioridade_final IS NOT NULL
ORDER BY v.cliente_id, v.prioridade_final, v.consolidado_em DESC;


-- ── D9. Saúde dos triggers (confirmar que todos estão ativos) ─────────────
SELECT
  event_object_table                                              AS tabela,
  trigger_name,
  event_manipulation                                              AS evento,
  action_timing                                                   AS timing,
  action_condition IS NOT NULL                                    AS tem_when
FROM information_schema.triggers
WHERE event_object_table IN (
  'vistorias','vistoria_sintomas','vistoria_riscos',
  'vistoria_depositos','vistoria_calhas'
)
  AND trigger_schema = 'public'
ORDER BY event_object_table, trigger_name, event_manipulation;

-- Esperado: 13 linhas
--   vistorias              : trg_consolidar_vistoria_insert (INSERT)
--                            trg_consolidar_vistoria_update (UPDATE)
--   vistoria_sintomas      : trg_consolidar_sintomas_insert  (INSERT)
--                            trg_consolidar_sintomas_delete  (DELETE)
--                            trg_consolidar_sintomas_update  (UPDATE)
--   vistoria_riscos        : trg_consolidar_riscos_insert    (INSERT)
--                            trg_consolidar_riscos_delete    (DELETE)
--                            trg_consolidar_riscos_update    (UPDATE)
--   vistoria_depositos     : trg_consolidar_depositos_insert (INSERT)
--                            trg_consolidar_depositos_delete (DELETE)
--                            trg_consolidar_depositos_update (UPDATE)
--   vistoria_calhas        : trg_consolidar_calhas_insert    (INSERT)
--                            trg_consolidar_calhas_delete    (DELETE)
--                            trg_consolidar_calhas_update    (UPDATE)


-- ── D10. Versão de pesos em uso (rastrear migração de pesos) ──────────────
SELECT
  versao_pesos_consolidacao                                       AS versao_pesos,
  COUNT(*)                                                        AS qtd_vistorias,
  MAX(consolidado_em)                                             AS ultima_consolidacao
FROM vistorias
WHERE prioridade_final IS NOT NULL
GROUP BY versao_pesos_consolidacao
ORDER BY ultima_consolidacao DESC;
-- 'fallback' = vistorias consolidadas sem config de pesos no banco
