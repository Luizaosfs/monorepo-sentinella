-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 1 — Parte 3: backfill, limpeza de payload e trigger de sincronização
--
-- PASSO 1 — Backfill imovel_id em focos_risco (dentro de transação)
-- PASSO 2 — Limpar chaves de negócio do payload de levantamento_itens
-- PASSO 3 — Trigger fn_sincronizar_casos_foco (caso_foco_cruzamento → focos_risco)
-- PASSO 4 — Backfill casos_ids nos focos existentes
-- PASSO 5 — COMMENT de depreciação nas colunas legadas
--
-- PASSO 6 — DROP COLUMN: POSTERGADO
--   Motivo: 95 referências ativas no frontend a status_atendimento, acao_aplicada,
--   data_resolucao, checkin_em, checkin_latitude, checkin_longitude,
--   observacao_atendimento. As colunas só podem ser removidas após migração
--   completa do frontend para usar focos_risco como fonte de verdade operacional.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── PASSO 1 — Backfill imovel_id ─────────────────────────────────────────────
-- Para cada foco sem imovel_id:
--   a) Se existe imóvel no mesmo cliente dentro de 30m → vincula
--   b) Senão → cria imóvel mínimo a partir dos dados do foco e vincula

DO $$
DECLARE
  r             record;
  v_imovel_id   uuid;
  v_novo_id     uuid;
BEGIN
  FOR r IN
    SELECT id, cliente_id, regiao_id, latitude, longitude, endereco_normalizado
      FROM focos_risco
     WHERE imovel_id IS NULL
       AND latitude  IS NOT NULL
       AND longitude IS NOT NULL
  LOOP
    -- Tenta encontrar imóvel próximo (30m)
    SELECT i.id INTO v_imovel_id
      FROM imoveis i
     WHERE i.cliente_id = r.cliente_id
       AND i.latitude  IS NOT NULL
       AND i.longitude IS NOT NULL
       AND ST_DWithin(
             geography(ST_SetSRID(ST_MakePoint(r.longitude,  r.latitude),  4326)),
             geography(ST_SetSRID(ST_MakePoint(i.longitude, i.latitude), 4326)),
             30
           )
     ORDER BY ST_Distance(
               geography(ST_SetSRID(ST_MakePoint(r.longitude, r.latitude), 4326)),
               geography(ST_SetSRID(ST_MakePoint(i.longitude, i.latitude), 4326))
              )
     LIMIT 1;

    -- Se não existe, cria imóvel mínimo
    IF v_imovel_id IS NULL THEN
      INSERT INTO imoveis (
        cliente_id, regiao_id, tipo_imovel,
        logradouro, latitude, longitude, ativo
      ) VALUES (
        r.cliente_id,
        r.regiao_id,
        'residencial',
        COALESCE(r.endereco_normalizado, 'Endereço não informado'),
        r.latitude,
        r.longitude,
        true
      )
      RETURNING id INTO v_novo_id;

      v_imovel_id := v_novo_id;
    END IF;

    UPDATE focos_risco
       SET imovel_id = v_imovel_id
     WHERE id = r.id;
  END LOOP;
END;
$$;

-- ── PASSO 2 — Limpar chaves de negócio do payload de levantamento_itens ───────
-- Remove chaves que foram absorvidas por focos_risco.

UPDATE levantamento_itens
   SET payload = payload
     - 'casos_notificados_proximidade'
     - 'caso_notificado_proximidade'
     - 'prioridade_original'
 WHERE payload IS NOT NULL
   AND (
     payload ? 'casos_notificados_proximidade'
     OR payload ? 'caso_notificado_proximidade'
     OR payload ? 'prioridade_original'
   );

-- ── PASSO 3 — Trigger fn_sincronizar_casos_foco ───────────────────────────────
-- Mantém focos_risco.casos_ids sincronizado quando um cruzamento é criado.

CREATE OR REPLACE FUNCTION fn_sincronizar_casos_foco()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualiza casos_ids no foco vinculado via levantamento_item
  UPDATE focos_risco
     SET casos_ids = array_append(
           array_remove(casos_ids, NEW.caso_id),  -- deduplicar
           NEW.caso_id
         )
   WHERE origem_levantamento_item_id = NEW.levantamento_item_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sincronizar_casos_foco
  AFTER INSERT ON caso_foco_cruzamento
  FOR EACH ROW
  EXECUTE FUNCTION fn_sincronizar_casos_foco();

-- ── PASSO 4 — Backfill casos_ids ─────────────────────────────────────────────

UPDATE focos_risco fr
   SET casos_ids = COALESCE((
     SELECT array_agg(DISTINCT cfc.caso_id)
       FROM caso_foco_cruzamento cfc
      WHERE cfc.levantamento_item_id = fr.origem_levantamento_item_id
   ), '{}')
 WHERE fr.origem_levantamento_item_id IS NOT NULL;

-- ── PASSO 5 — COMMENT de depreciação ─────────────────────────────────────────

COMMENT ON COLUMN levantamento_itens.endereco_curto IS
  'DEPRECATED — usar imoveis.logradouro via focos_risco.imovel_id. '
  'Mantido para compatibilidade com pipeline Python até migração completa.';

COMMENT ON COLUMN levantamento_itens.endereco_completo IS
  'DEPRECATED — usar imoveis via focos_risco.imovel_id. '
  'Mantido para compatibilidade com pipeline Python até migração completa.';

COMMENT ON COLUMN levantamento_itens.status_atendimento IS
  'DEPRECATED — campo somente-leitura derivado de focos_risco.status. '
  'Atualizado automaticamente pelo trigger trg_sincronizar_status_atendimento. '
  'Não atualizar diretamente — use rpc_transicionar_foco_risco().';

COMMENT ON COLUMN levantamento_itens.acao_aplicada IS
  'DEPRECATED — usar focos_risco.desfecho + operacoes. '
  'Mantido temporariamente enquanto frontend é migrado.';

COMMENT ON COLUMN levantamento_itens.data_resolucao IS
  'DEPRECATED — usar focos_risco.resolvido_em. '
  'Mantido temporariamente enquanto frontend é migrado.';

COMMENT ON COLUMN levantamento_itens.checkin_em IS
  'DEPRECATED — o check-in operacional passou para vistorias.checkin_em. '
  'Mantido temporariamente enquanto frontend é migrado.';

COMMENT ON COLUMN levantamento_itens.checkin_latitude IS
  'DEPRECATED — usar vistorias.lat_chegada. Mantido temporariamente.';

COMMENT ON COLUMN levantamento_itens.checkin_longitude IS
  'DEPRECATED — usar vistorias.lng_chegada. Mantido temporariamente.';

COMMENT ON COLUMN levantamento_itens.observacao_atendimento IS
  'DEPRECATED — usar focos_risco.desfecho. Mantido temporariamente.';

-- ── VALIDAÇÃO (intenção — executar manualmente antes de commitar) ─────────────
-- SELECT COUNT(*) FROM focos_risco WHERE imovel_id IS NULL;
--   → deve ser 0 (ou apenas focos sem lat/lng)
--
-- SELECT COUNT(*) FROM levantamento_itens WHERE payload ? 'casos_notificados_proximidade';
--   → deve ser 0
--
-- SELECT COUNT(*) FROM sla_operacional WHERE foco_risco_id IS NULL AND levantamento_item_id IS NOT NULL;
--   → deve ser 0 ou próximo
--
-- SELECT COUNT(*) FROM focos_risco fr
-- WHERE fr.casos_ids = '{}' AND EXISTS (
--   SELECT 1 FROM caso_foco_cruzamento cfc
--   WHERE cfc.levantamento_item_id = fr.origem_levantamento_item_id
-- );
--   → deve ser 0
