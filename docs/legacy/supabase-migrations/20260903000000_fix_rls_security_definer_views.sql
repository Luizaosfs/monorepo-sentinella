-- =============================================================================
-- B-03 + Seção 6: Corrigir SECURITY DEFINER sem tenant check + views sem security_invoker
--
-- Funções corrigidas (B-03):
--   rpc_resumo_regional    — plpgsql, sem IF NOT usuario_pode_acessar_cliente
--   rpc_calcular_liraa     — sql (convertida para plpgsql para suportar o check)
--   calcular_uso_mensal    — plpgsql, sem IF NOT usuario_pode_acessar_cliente
--
-- Views corrigidas (Seção 6 — security_invoker obrigatório):
--   v_retencao_logs_resumo, v_system_health_atual, v_billing_resumo,
--   v_cliente_uso_mensal, v_vistorias_deletadas
-- =============================================================================

-- ── 1. rpc_resumo_regional — adiciona tenant check ───────────────────────────

CREATE OR REPLACE FUNCTION rpc_resumo_regional(
  p_cliente_id uuid,
  p_ciclo      integer     DEFAULT NULL,
  p_de         timestamptz DEFAULT NULL,
  p_ate        timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.usuario_pode_acessar_cliente(p_cliente_id) THEN
    RAISE EXCEPTION 'Acesso negado ao cliente %', p_cliente_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN (
    WITH focos AS (
      SELECT
        fr.regiao_id,
        r.regiao AS regiao_nome,
        fr.status,
        fr.origem_tipo,
        fr.resolvido_em,
        fr.suspeita_em,
        fr.confirmado_em,
        sla.prazo_final,
        sla.violado AS sla_violado
      FROM focos_risco fr
      LEFT JOIN regioes r ON r.id = fr.regiao_id
      LEFT JOIN sla_operacional sla ON sla.foco_risco_id = fr.id
      WHERE fr.cliente_id = p_cliente_id
        AND (p_ciclo IS NULL OR fr.ciclo = p_ciclo)
        AND (p_de    IS NULL OR fr.suspeita_em >= p_de)
        AND (p_ate   IS NULL OR fr.suspeita_em <= p_ate)
    ),
    por_regiao AS (
      SELECT
        regiao_id,
        regiao_nome,
        COUNT(*) AS total_focos,
        COUNT(*) FILTER (WHERE status = 'resolvido') AS focos_resolvidos,
        COUNT(*) FILTER (WHERE status NOT IN ('resolvido','descartado')) AS focos_ativos,
        COUNT(*) FILTER (WHERE status = 'descartado') AS focos_descartados,
        ROUND(
          CASE WHEN COUNT(*) FILTER (WHERE origem_tipo = 'drone') > 0
            THEN COUNT(*) FILTER (WHERE origem_tipo = 'drone' AND status = 'descartado')::numeric
                 / COUNT(*) FILTER (WHERE origem_tipo = 'drone') * 100
            ELSE 0 END, 1
        ) AS taxa_falso_positivo_drone,
        ROUND(AVG(
          CASE WHEN resolvido_em IS NOT NULL
            THEN EXTRACT(EPOCH FROM (resolvido_em - COALESCE(confirmado_em, suspeita_em))) / 3600.0
          END
        )::numeric, 2) AS media_tempo_tratamento_horas,
        COUNT(*) FILTER (WHERE sla_violado = true) AS sla_violado_count
      FROM focos
      GROUP BY regiao_id, regiao_nome
    )
    SELECT jsonb_agg(
      jsonb_build_object(
        'regiao_id',                    regiao_id,
        'regiao_nome',                  regiao_nome,
        'total_focos',                  total_focos,
        'focos_resolvidos',             focos_resolvidos,
        'focos_ativos',                 focos_ativos,
        'focos_descartados',            focos_descartados,
        'taxa_falso_positivo_drone',    taxa_falso_positivo_drone,
        'media_tempo_tratamento_horas', media_tempo_tratamento_horas,
        'sla_violado_count',            sla_violado_count
      )
      ORDER BY total_focos DESC
    )
    FROM por_regiao
  );
END;
$$;

COMMENT ON FUNCTION rpc_resumo_regional IS
  'Resumo agregado por regiao: total/resolvidos/ativos/descartados, '
  'taxa de falso positivo drone, media de tempo de tratamento, SLA violados. '
  'Filtros: p_ciclo (opcional), p_de/p_ate (intervalo em suspeita_em). '
  'Fix 20260903000000: tenant check adicionado.';

-- ── 2. rpc_calcular_liraa — converte sql→plpgsql para suportar tenant check ──

CREATE OR REPLACE FUNCTION public.rpc_calcular_liraa(
  p_cliente_id uuid,
  p_ciclo      integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.usuario_pode_acessar_cliente(p_cliente_id) THEN
    RAISE EXCEPTION 'Acesso negado ao cliente %', p_cliente_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN (
    WITH base AS (
      SELECT
        v.id                                                    AS vistoria_id,
        v.imovel_id,
        v.data_visita,
        v.acesso_realizado,
        COALESCE(SUM(d.qtd_inspecionados), 0)                  AS total_recipientes,
        COALESCE(SUM(d.qtd_com_focos), 0)                      AS recipientes_com_foco,
        COALESCE(SUM(CASE WHEN d.qtd_com_focos > 0 THEN 1 ELSE 0 END), 0) AS tipos_foco
      FROM vistorias v
      LEFT JOIN vistoria_depositos d ON d.vistoria_id = v.id
      WHERE v.cliente_id = p_cliente_id
        AND v.ciclo = p_ciclo
        AND v.tipo_atividade = 'liraa'
      GROUP BY v.id
    ),
    por_tipo AS (
      SELECT
        v.id AS vistoria_id,
        d.tipo,
        SUM(d.qtd_inspecionados) AS inspecionados,
        SUM(d.qtd_com_focos)     AS com_foco
      FROM vistorias v
      JOIN vistoria_depositos d ON d.vistoria_id = v.id
      WHERE v.cliente_id = p_cliente_id
        AND v.ciclo = p_ciclo
        AND v.tipo_atividade = 'liraa'
      GROUP BY v.id, d.tipo
    ),
    totais AS (
      SELECT
        COUNT(*)                                                    AS total_imoveis,
        COUNT(*) FILTER (WHERE acesso_realizado = true)             AS inspecionados,
        COUNT(*) FILTER (WHERE acesso_realizado = false)            AS fechados,
        COUNT(*) FILTER (WHERE recipientes_com_foco > 0)           AS imoveis_com_foco,
        SUM(recipientes_com_foco)                                   AS total_recipientes_foco,
        SUM(total_recipientes)                                      AS total_recipientes
      FROM base
    ),
    por_deposito AS (
      SELECT
        tipo,
        SUM(inspecionados) AS inspecionados,
        SUM(com_foco)      AS com_foco,
        ROUND(
          CASE WHEN SUM(inspecionados) > 0
            THEN SUM(com_foco)::numeric / SUM(inspecionados) * 100
            ELSE 0 END, 2
        ) AS indice
      FROM por_tipo
      GROUP BY tipo
    ),
    focos AS (
      SELECT
        fr.id,
        fr.status,
        fr.prioridade,
        fr.origem_tipo
      FROM focos_risco fr
      WHERE fr.cliente_id = p_cliente_id
        AND fr.ciclo      = p_ciclo
    ),
    focos_totais AS (
      SELECT
        COUNT(*) FILTER (WHERE origem_tipo = 'drone')                               AS detectados_drone,
        COUNT(*) FILTER (WHERE status IN ('confirmado', 'em_tratamento'))           AS confirmados,
        COUNT(*) FILTER (WHERE status = 'resolvido')                                AS resolvidos,
        COUNT(*) FILTER (WHERE status = 'descartado')                               AS descartados,
        COUNT(*) FILTER (WHERE prioridade = 'P1')                                   AS p1,
        COUNT(*) FILTER (WHERE prioridade = 'P2')                                   AS p2,
        COUNT(*) FILTER (WHERE prioridade = 'P3')                                   AS p3,
        COUNT(*) FILTER (WHERE prioridade = 'P4')                                   AS p4,
        COUNT(*) FILTER (WHERE prioridade = 'P5')                                   AS p5
      FROM focos
    )
    SELECT jsonb_build_object(
      'ciclo',               p_ciclo,
      'total_imoveis',       t.total_imoveis,
      'inspecionados',       t.inspecionados,
      'fechados',            t.fechados,
      'iip',                 ROUND(CASE WHEN t.inspecionados > 0
                               THEN t.imoveis_com_foco::numeric / t.inspecionados * 100
                               ELSE 0 END, 2),
      'ib',                  ROUND(CASE WHEN t.inspecionados > 0
                               THEN t.total_recipientes_foco::numeric / t.inspecionados * 100
                               ELSE 0 END, 2),
      'imoveis_com_foco',    t.imoveis_com_foco,
      'total_recipientes_foco', t.total_recipientes_foco,
      'classificacao_risco', CASE
        WHEN ROUND(CASE WHEN t.inspecionados > 0
             THEN t.imoveis_com_foco::numeric / t.inspecionados * 100
             ELSE 0 END, 2) < 1   THEN 'satisfatório'
        WHEN ROUND(CASE WHEN t.inspecionados > 0
             THEN t.imoveis_com_foco::numeric / t.inspecionados * 100
             ELSE 0 END, 2) < 3.9 THEN 'alerta'
        ELSE 'risco'
      END,
      'por_deposito',        (SELECT jsonb_agg(row_to_json(d)) FROM por_deposito d),
      'focos_detectados_drone',   ft.detectados_drone,
      'focos_confirmados',        ft.confirmados,
      'focos_resolvidos',         ft.resolvidos,
      'focos_descartados',        ft.descartados,
      'taxa_resolucao_focos_pct', ROUND(
        CASE WHEN (ft.confirmados + ft.resolvidos) > 0
          THEN ft.resolvidos::numeric / (ft.confirmados + ft.resolvidos) * 100
          ELSE 0 END, 1
      ),
      'focos_por_prioridade', jsonb_build_object(
        'P1', ft.p1, 'P2', ft.p2, 'P3', ft.p3, 'P4', ft.p4, 'P5', ft.p5
      )
    )
    FROM totais t
    CROSS JOIN focos_totais ft
  );
END;
$$;

COMMENT ON FUNCTION public.rpc_calcular_liraa(uuid, integer) IS
  'Calcula LIRAa (IIP, IB, classificação, por depósito) + dados de focos_risco para o ciclo. '
  'Fix 20260903000000: convertida sql→plpgsql, tenant check adicionado.';

-- ── 3. calcular_uso_mensal — adiciona tenant check ───────────────────────────

CREATE OR REPLACE FUNCTION calcular_uso_mensal(
  p_cliente_id   uuid,
  p_inicio       date,
  p_fim          date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vistorias         int;
  v_levantamentos     int;
  v_itens_focos       int;
  v_voos              int;
  v_denuncias         int;
  v_ia_calls          int;
  v_relatorios        int;
  v_syncs_cnes        int;
  v_notif_esus        int;
  v_usuarios_ativos   int;
  v_imoveis_total     int;
BEGIN
  IF NOT public.usuario_pode_acessar_cliente(p_cliente_id) THEN
    RAISE EXCEPTION 'Acesso negado ao cliente %', p_cliente_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT COUNT(*) INTO v_vistorias
  FROM vistorias
  WHERE cliente_id = p_cliente_id
    AND created_at >= p_inicio AND created_at < p_fim + 1;

  SELECT COUNT(*) INTO v_levantamentos
  FROM levantamentos
  WHERE cliente_id = p_cliente_id
    AND created_at >= p_inicio AND created_at < p_fim + 1;

  SELECT COUNT(*) INTO v_itens_focos
  FROM levantamento_itens
  WHERE cliente_id = p_cliente_id
    AND created_at >= p_inicio AND created_at < p_fim + 1
    AND deleted_at IS NULL;

  SELECT COUNT(*) INTO v_voos
  FROM voos
  WHERE cliente_id = p_cliente_id
    AND created_at >= p_inicio AND created_at < p_fim + 1;

  SELECT COUNT(*) INTO v_denuncias
  FROM levantamento_itens li
  JOIN levantamentos lev ON lev.id = li.levantamento_id
  WHERE lev.cliente_id = p_cliente_id
    AND li.payload->>'fonte' = 'cidadao'
    AND li.created_at >= p_inicio AND li.created_at < p_fim + 1;

  SELECT COUNT(*) INTO v_ia_calls
  FROM levantamento_analise_ia
  WHERE cliente_id = p_cliente_id
    AND processado_em >= p_inicio AND processado_em < p_fim + 1;

  SELECT COUNT(*) INTO v_relatorios
  FROM job_queue
  WHERE payload->>'cliente_id' = p_cliente_id::text
    AND tipo = 'relatorio_semanal'
    AND status = 'concluido'
    AND concluido_em >= p_inicio AND concluido_em < p_fim + 1;

  SELECT COUNT(*) INTO v_syncs_cnes
  FROM unidades_saude_sync_log
  WHERE cliente_id = p_cliente_id
    AND created_at >= p_inicio AND created_at < p_fim + 1;

  SELECT COUNT(*) INTO v_notif_esus
  FROM item_notificacoes_esus
  WHERE cliente_id = p_cliente_id
    AND status = 'enviado'
    AND enviado_por IS NOT NULL
    AND created_at >= p_inicio AND created_at < p_fim + 1;

  SELECT COUNT(DISTINCT u.id) INTO v_usuarios_ativos
  FROM usuarios u
  WHERE u.cliente_id = p_cliente_id
    AND u.deleted_at IS NULL;

  SELECT COUNT(*) INTO v_imoveis_total
  FROM imoveis
  WHERE cliente_id = p_cliente_id AND ativo = true;

  RETURN jsonb_build_object(
    'cliente_id',            p_cliente_id,
    'periodo_inicio',        p_inicio,
    'periodo_fim',           p_fim,
    'vistorias_mes',         v_vistorias,
    'levantamentos_mes',     v_levantamentos,
    'itens_focos_mes',       v_itens_focos,
    'voos_mes',              v_voos,
    'denuncias_mes',         v_denuncias,
    'ia_calls_mes',          v_ia_calls,
    'relatorios_mes',        v_relatorios,
    'syncs_cnes_mes',        v_syncs_cnes,
    'notificacoes_esus_mes', v_notif_esus,
    'usuarios_ativos_mes',   v_usuarios_ativos,
    'imoveis_total',         v_imoveis_total,
    'calculado_em',          now()
  );
END;
$$;

REVOKE ALL ON FUNCTION calcular_uso_mensal(uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION calcular_uso_mensal(uuid, date, date) TO authenticated;

COMMENT ON FUNCTION calcular_uso_mensal(uuid, date, date) IS
  'Calcula métricas de uso mensal por cliente para billing snapshot. '
  'Fix 20260903000000: SET search_path + tenant check adicionado.';

-- ── 4. Views sem security_invoker — corrigir em lote ─────────────────────────

ALTER VIEW public.v_retencao_logs_resumo SET (security_invoker = on);
ALTER VIEW public.v_system_health_atual   SET (security_invoker = on);
ALTER VIEW public.v_billing_resumo        SET (security_invoker = on);
ALTER VIEW public.v_cliente_uso_mensal    SET (security_invoker = on);
ALTER VIEW public.v_vistorias_deletadas   SET (security_invoker = on);
