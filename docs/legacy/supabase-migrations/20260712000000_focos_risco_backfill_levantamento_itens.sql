-- ─────────────────────────────────────────────────────────────────────────────
-- BACKFILL: gerar focos_risco para levantamento_itens existentes
-- Executa a mesma lógica de fn_criar_foco_de_levantamento_item() para todos
-- os itens que ainda não possuem um foco correspondente.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_total   integer := 0;
  v_criados integer := 0;
BEGIN
  SELECT COUNT(*) INTO v_total
    FROM levantamento_itens li
   WHERE NOT EXISTS (
     SELECT 1 FROM focos_risco fr
      WHERE fr.origem_levantamento_item_id = li.id
   )
     AND (
       li.prioridade IN ('P1','P2','P3')
       OR lower(coalesce(li.risco,'')) IN ('alto','crítico','critico')
     );

  RAISE NOTICE 'Backfill focos_risco: % itens elegíveis sem foco.', v_total;

  INSERT INTO focos_risco (
    cliente_id,
    imovel_id,
    origem_tipo,
    origem_levantamento_item_id,
    prioridade,
    latitude,
    longitude,
    endereco_normalizado,
    suspeita_em
  )
  SELECT
    l.cliente_id,
    -- tenta vincular ao imóvel mais próximo (raio 30m)
    (
      SELECT i.id
        FROM imoveis i
       WHERE i.cliente_id = l.cliente_id
         AND li.latitude  IS NOT NULL
         AND li.longitude IS NOT NULL
         AND ST_DWithin(
               ST_MakePoint(li.longitude, li.latitude)::geography,
               ST_MakePoint(i.longitude,  i.latitude)::geography,
               30
             )
       ORDER BY ST_Distance(
                  ST_MakePoint(li.longitude, li.latitude)::geography,
                  ST_MakePoint(i.longitude,  i.latitude)::geography
                )
       LIMIT 1
    ) AS imovel_id,
    CASE
      WHEN upper(coalesce(l.tipo_entrada,'')) = 'DRONE' THEN 'drone'
      ELSE 'agente'
    END AS origem_tipo,
    li.id        AS origem_levantamento_item_id,
    li.prioridade,
    li.latitude,
    li.longitude,
    li.endereco_curto AS endereco_normalizado,
    li.created_at     AS suspeita_em
  FROM levantamento_itens li
  JOIN levantamentos l ON l.id = li.levantamento_id
  WHERE NOT EXISTS (
    SELECT 1 FROM focos_risco fr
     WHERE fr.origem_levantamento_item_id = li.id
  )
    AND (
      li.prioridade IN ('P1','P2','P3')
      OR lower(coalesce(li.risco,'')) IN ('alto','crítico','critico')
    );

  GET DIAGNOSTICS v_criados = ROW_COUNT;
  RAISE NOTICE 'Backfill concluído: % focos_risco criados.', v_criados;
END;
$$;
