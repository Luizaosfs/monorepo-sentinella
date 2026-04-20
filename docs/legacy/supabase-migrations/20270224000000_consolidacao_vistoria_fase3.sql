-- =============================================================================
-- Migration: 20270221000000_consolidacao_vistoria_fase3.sql
-- Fase 3 — Triggers de consolidação automática (versão refinada)
--
-- Especificação: V2 (aprovada)
-- Requer: Fase 1 (20270219000000) + Fase 2 (20270220000000)
--
-- Estratégia de disparo por tabela:
--   vistorias         : INSERT sempre | UPDATE OF colunas-input WHEN valor mudou
--   vistoria_sintomas : INSERT sempre | DELETE sempre | UPDATE OF colunas-input WHEN valor mudou
--   vistoria_riscos   : INSERT sempre | DELETE sempre | UPDATE OF colunas-input WHEN valor mudou
--   vistoria_depositos: INSERT sempre | DELETE sempre | UPDATE OF colunas-input WHEN valor mudou
--   vistoria_calhas   : INSERT sempre | DELETE sempre | UPDATE OF colunas-input WHEN valor mudou
--
-- Proteção contra recursão (3 camadas):
--   1. AFTER UPDATE OF <colunas-input>: não dispara quando fn_consolidar_vistoria()
--      atualiza colunas-output (prioridade_final, consolidacao_json etc.)
--   2. WHEN (OLD.col IS DISTINCT FROM NEW.col): não dispara em NOPs
--   3. IF pg_trigger_depth() > 1: guarda extra de profundidade
--
-- Motivo no histórico:
--   Triggers automáticos gravam motivo = 'automático — <OP> em <tabela>'
--   Permite distinguir no histórico re-consolidações automáticas de manuais.
--   Exemplo: 'automático — INSERT em vistoria_riscos'
--
-- Nota sobre ruído no histórico:
--   Em um fluxo completo (INSERT vistorias + 4 sub-tabelas), até 4 registros
--   intermediários são gerados no vistoria_consolidacao_historico.
--   Os intermediários representam estados parciais do formulário.
--   Filtrar com: WHERE motivo_reprocessamento NOT LIKE 'automático%'
--   para ver apenas reprocessamentos intencionais do gestor.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- PARTE A — Funções wrapper
-- ─────────────────────────────────────────────────────────────────────────────

-- ── A1. Wrapper para a tabela vistorias ────────────────────────────────────
--
-- Passa motivo explícito que identifica a origem no histórico.
-- NEVER FAIL: erros de consolidação viram WARNING, nunca cancelam a operação.

CREATE OR REPLACE FUNCTION public.trg_fn_consolidar_vistoria_auto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Guarda de profundidade (3ª camada anti-recursão)
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Motivo identificável no histórico: distingue trigger de reprocessamento manual
  PERFORM public.fn_consolidar_vistoria(
    NEW.id,
    'automático — ' || TG_OP || ' em vistorias'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING
    '[consolidação automática] fn_consolidar_vistoria falhou: vistoria_id=%, op=%, erro: %',
    NEW.id, TG_OP, SQLERRM;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_fn_consolidar_vistoria_auto() IS
  'Wrapper de trigger para vistorias. '
  'Motivo gravado no histórico: "automático — <OP> em vistorias". '
  'Nunca cancela a operação original — erros viram WARNING.';


-- ── A2. Wrapper para sub-tabelas ──────────────────────────────────────────
--
-- Extrai vistoria_id de NEW (INSERT/UPDATE) ou OLD (DELETE).
-- TG_TABLE_NAME e TG_OP são injetados automaticamente pelo PostgreSQL.

CREATE OR REPLACE FUNCTION public.trg_fn_consolidar_subtabela()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vistoria_id uuid;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_vistoria_id := COALESCE(NEW.vistoria_id, OLD.vistoria_id);

  IF v_vistoria_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Motivo identificável no histórico por tabela e operação
  PERFORM public.fn_consolidar_vistoria(
    v_vistoria_id,
    'automático — ' || TG_OP || ' em ' || TG_TABLE_NAME
  );

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING
    '[consolidação automática] fn_consolidar_vistoria falhou: vistoria_id=%, tabela=%, op=%, erro: %',
    v_vistoria_id, TG_TABLE_NAME, TG_OP, SQLERRM;
  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION public.trg_fn_consolidar_subtabela() IS
  'Wrapper de trigger para sub-tabelas. '
  'Motivo gravado no histórico: "automático — <OP> em <tabela>". '
  'Nunca cancela a operação original — erros viram WARNING.';


-- ─────────────────────────────────────────────────────────────────────────────
-- PARTE B — Triggers na tabela vistorias (sem alteração de estratégia)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── B1. INSERT em vistorias — sempre ──────────────────────────────────────
DROP TRIGGER IF EXISTS trg_consolidar_vistoria_insert ON vistorias;

CREATE TRIGGER trg_consolidar_vistoria_insert
  AFTER INSERT ON vistorias
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_consolidar_vistoria_auto();


-- ── B2. UPDATE em vistorias — apenas colunas-input relevantes ─────────────
--
-- Colunas monitoradas (e por quê cada uma):
--   acesso_realizado → muda resultado_operacional e sem_acesso_count
--   status           → finalização da vistoria pelo agente
--   moradores_qtd    → denominador de proporcao_sintomas
--   gravidas         → vulnerabilidade_domiciliar
--   idosos           → vulnerabilidade_domiciliar
--   criancas_7anos   → vulnerabilidade_domiciliar
--
-- NÃO monitoradas (colunas-output escritas por fn_consolidar_vistoria):
--   prioridade_final, consolidacao_json, consolidacao_resumo,
--   vulnerabilidade_domiciliar, alerta_saude, risco_socioambiental,
--   risco_vetorial, resultado_operacional, prioridade_motivo,
--   dimensao_dominante, consolidacao_incompleta, versao_regra_consolidacao,
--   versao_pesos_consolidacao, consolidado_em, reprocessado_em, reprocessado_por

DROP TRIGGER IF EXISTS trg_consolidar_vistoria_update ON vistorias;

CREATE TRIGGER trg_consolidar_vistoria_update
  AFTER UPDATE OF
    acesso_realizado,
    status,
    moradores_qtd,
    gravidas,
    idosos,
    criancas_7anos
  ON vistorias
  FOR EACH ROW
  WHEN (
    OLD.acesso_realizado IS DISTINCT FROM NEW.acesso_realizado
    OR OLD.status         IS DISTINCT FROM NEW.status
    OR OLD.moradores_qtd  IS DISTINCT FROM NEW.moradores_qtd
    OR OLD.gravidas        IS DISTINCT FROM NEW.gravidas
    OR OLD.idosos          IS DISTINCT FROM NEW.idosos
    OR OLD.criancas_7anos  IS DISTINCT FROM NEW.criancas_7anos
  )
  EXECUTE FUNCTION public.trg_fn_consolidar_vistoria_auto();


-- ─────────────────────────────────────────────────────────────────────────────
-- PARTE C — Triggers nas sub-tabelas (refinadas)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── C1. vistoria_sintomas ─────────────────────────────────────────────────
--
-- Colunas relevantes para consolidação:
--   febre, manchas_vermelhas, dor_articulacoes, dor_cabeca
--     → determinam presença de sintoma (alerta_saude = atencao ou urgente)
--   moradores_sintomas_qtd
--     → numerador de proporcao_sintomas (urgente quando >= 50%)
--
-- NÃO monitoradas em UPDATE:
--   cliente_id  → metadado, não lido pela função
--   created_at  → imutável

DROP TRIGGER IF EXISTS trg_consolidar_vistoria_sintomas ON vistoria_sintomas;

-- INSERT: qualquer registro novo de sintomas impacta alerta_saude
CREATE TRIGGER trg_consolidar_sintomas_insert
  AFTER INSERT ON vistoria_sintomas
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_consolidar_subtabela();

-- DELETE: remoção de registro de sintomas muda alerta_saude
CREATE TRIGGER trg_consolidar_sintomas_delete
  AFTER DELETE ON vistoria_sintomas
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_consolidar_subtabela();

-- UPDATE: apenas quando campos que afetam alerta_saude mudam
CREATE TRIGGER trg_consolidar_sintomas_update
  AFTER UPDATE OF
    febre,
    manchas_vermelhas,
    dor_articulacoes,
    dor_cabeca,
    moradores_sintomas_qtd
  ON vistoria_sintomas
  FOR EACH ROW
  WHEN (
    OLD.febre                  IS DISTINCT FROM NEW.febre
    OR OLD.manchas_vermelhas   IS DISTINCT FROM NEW.manchas_vermelhas
    OR OLD.dor_articulacoes    IS DISTINCT FROM NEW.dor_articulacoes
    OR OLD.dor_cabeca          IS DISTINCT FROM NEW.dor_cabeca
    OR OLD.moradores_sintomas_qtd IS DISTINCT FROM NEW.moradores_sintomas_qtd
  )
  EXECUTE FUNCTION public.trg_fn_consolidar_subtabela();


-- ── C2. vistoria_riscos ───────────────────────────────────────────────────
--
-- Colunas relevantes para consolidação:
--   Social (→ vulnerabilidade_domiciliar + score socioambiental):
--     menor_incapaz, idoso_incapaz, dep_quimico, risco_alimentar, risco_moradia
--   Sanitário (→ score socioambiental):
--     criadouro_animais, lixo, residuos_organicos, residuos_quimicos, residuos_medicos
--   Vetorial (→ risco_vetorial):
--     acumulo_material_organico, animais_sinais_lv, caixa_destampada, outro_risco_vetorial
--
-- NÃO monitoradas em UPDATE:
--   created_at → imutável

DROP TRIGGER IF EXISTS trg_consolidar_vistoria_riscos ON vistoria_riscos;

CREATE TRIGGER trg_consolidar_riscos_insert
  AFTER INSERT ON vistoria_riscos
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_consolidar_subtabela();

CREATE TRIGGER trg_consolidar_riscos_delete
  AFTER DELETE ON vistoria_riscos
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_consolidar_subtabela();

CREATE TRIGGER trg_consolidar_riscos_update
  AFTER UPDATE OF
    -- Social
    menor_incapaz,
    idoso_incapaz,
    dep_quimico,
    risco_alimentar,
    risco_moradia,
    -- Sanitário
    criadouro_animais,
    lixo,
    residuos_organicos,
    residuos_quimicos,
    residuos_medicos,
    -- Vetorial
    acumulo_material_organico,
    animais_sinais_lv,
    caixa_destampada,
    outro_risco_vetorial
  ON vistoria_riscos
  FOR EACH ROW
  WHEN (
    OLD.menor_incapaz            IS DISTINCT FROM NEW.menor_incapaz
    OR OLD.idoso_incapaz         IS DISTINCT FROM NEW.idoso_incapaz
    OR OLD.dep_quimico           IS DISTINCT FROM NEW.dep_quimico
    OR OLD.risco_alimentar       IS DISTINCT FROM NEW.risco_alimentar
    OR OLD.risco_moradia         IS DISTINCT FROM NEW.risco_moradia
    OR OLD.criadouro_animais     IS DISTINCT FROM NEW.criadouro_animais
    OR OLD.lixo                  IS DISTINCT FROM NEW.lixo
    OR OLD.residuos_organicos    IS DISTINCT FROM NEW.residuos_organicos
    OR OLD.residuos_quimicos     IS DISTINCT FROM NEW.residuos_quimicos
    OR OLD.residuos_medicos      IS DISTINCT FROM NEW.residuos_medicos
    OR OLD.acumulo_material_organico IS DISTINCT FROM NEW.acumulo_material_organico
    OR OLD.animais_sinais_lv     IS DISTINCT FROM NEW.animais_sinais_lv
    OR OLD.caixa_destampada      IS DISTINCT FROM NEW.caixa_destampada
    OR OLD.outro_risco_vetorial  IS DISTINCT FROM NEW.outro_risco_vetorial
  )
  EXECUTE FUNCTION public.trg_fn_consolidar_subtabela();


-- ── C3. vistoria_depositos ────────────────────────────────────────────────
--
-- Colunas relevantes para consolidação:
--   qtd_com_focos    → SUM > 0 → risco_vetorial = 'critico'
--   qtd_inspecionados → SUM > 0 → v_tem_depositos_record = true → risco_vetorial = 'medio'
--                       (comportamento conservador documentado na Fase 2)
--
-- NÃO monitoradas em UPDATE:
--   tipo            → determina categoria do depósito, mas a função faz SUM de todas
--   qtd_eliminados  → não lido pela função de consolidação
--   usou_larvicida  → não lido pela função de consolidação
--   qtd_larvicida_g → não lido pela função de consolidação

DROP TRIGGER IF EXISTS trg_consolidar_vistoria_depositos ON vistoria_depositos;

CREATE TRIGGER trg_consolidar_depositos_insert
  AFTER INSERT ON vistoria_depositos
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_consolidar_subtabela();

CREATE TRIGGER trg_consolidar_depositos_delete
  AFTER DELETE ON vistoria_depositos
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_consolidar_subtabela();

CREATE TRIGGER trg_consolidar_depositos_update
  AFTER UPDATE OF
    qtd_com_focos,
    qtd_inspecionados
  ON vistoria_depositos
  FOR EACH ROW
  WHEN (
    OLD.qtd_com_focos     IS DISTINCT FROM NEW.qtd_com_focos
    OR OLD.qtd_inspecionados IS DISTINCT FROM NEW.qtd_inspecionados
  )
  EXECUTE FUNCTION public.trg_fn_consolidar_subtabela();


-- ── C4. vistoria_calhas ───────────────────────────────────────────────────
--
-- Colunas relevantes para consolidação:
--   com_foco  → true → risco_vetorial = 'critico' (via bool_or)
--   condicao  → 'com_agua_parada' → risco_vetorial = 'alto' (via bool_or)
--
-- NÃO monitoradas em UPDATE:
--   posicao             → localização da calha, não lida pela função
--   acessivel           → não lida pela função de consolidação
--   tratamento_realizado→ não lido pela função de consolidação
--   foto_url            → metadado
--   observacao          → metadado

DROP TRIGGER IF EXISTS trg_consolidar_vistoria_calhas ON vistoria_calhas;

CREATE TRIGGER trg_consolidar_calhas_insert
  AFTER INSERT ON vistoria_calhas
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_consolidar_subtabela();

CREATE TRIGGER trg_consolidar_calhas_delete
  AFTER DELETE ON vistoria_calhas
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_consolidar_subtabela();

CREATE TRIGGER trg_consolidar_calhas_update
  AFTER UPDATE OF
    com_foco,
    condicao
  ON vistoria_calhas
  FOR EACH ROW
  WHEN (
    OLD.com_foco  IS DISTINCT FROM NEW.com_foco
    OR OLD.condicao IS DISTINCT FROM NEW.condicao
  )
  EXECUTE FUNCTION public.trg_fn_consolidar_subtabela();


-- ─────────────────────────────────────────────────────────────────────────────
-- PARTE D — Script de backfill (NÃO executado automaticamente)
--
-- Rollout seguro:
--   1. Aplicar Fase 1 → Fase 2 → Fase 3 em staging.
--   2. Testar fluxo completo: INSERT vistorias + sub-tabelas → verificar prioridade.
--   3. Verificar em prod: SELECT COUNT(*) FROM vistorias WHERE prioridade_final IS NULL;
--   4. Aplicar migrations em prod (novas vistorias passam a auto-consolidar).
--   5. Executar script de backfill SEPARADAMENTE, fora do horário de pico.
--      O script abaixo processa em lotes de 200, isola erros por linha e loga progresso.
-- ─────────────────────────────────────────────────────────────────────────────

/*
=== BACKFILL LEGADO — executar SEPARADAMENTE, nunca dentro desta migration ===

-- Verificar volume pendente antes de iniciar:
SELECT COUNT(*) AS pendentes FROM vistorias WHERE prioridade_final IS NULL;

DO $$
DECLARE
  v_ids    uuid[];
  v_id     uuid;
  v_ok     int := 0;
  v_err    int := 0;
  v_total  int := 0;
  v_lote   int := 200;  -- ajustar conforme ambiente (100–500)
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM vistorias WHERE prioridade_final IS NULL;
  RAISE NOTICE 'Backfill iniciado: % vistorias pendentes', v_total;

  LOOP
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
        -- Sem motivo: fn_consolidar_vistoria() usa COALESCE → 'reprocessamento automático sem motivo explícito'
        PERFORM fn_consolidar_vistoria(v_id);
        v_ok := v_ok + 1;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Backfill falhou para %: %', v_id, SQLERRM;
        v_err := v_err + 1;
      END;
    END LOOP;

    RAISE NOTICE 'Lote: % ok, % erro | acumulado: %/%',
      v_ok, v_err, (v_ok + v_err), v_total;

    EXIT WHEN (v_ok + v_err) >= v_total;
  END LOOP;

  RAISE NOTICE 'Backfill concluído: % consolidadas, % erros', v_ok, v_err;
END;
$$;

*/
