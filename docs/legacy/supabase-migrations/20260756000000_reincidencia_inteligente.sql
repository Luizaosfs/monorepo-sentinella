-- =============================================================================
-- Reincidência com Inteligência
--
-- Adiciona camada analítica sobre os dois sistemas de recorrência existentes:
-- • Sistema A (levantamento_item_recorrencia): detecção operacional em tempo real
-- • Sistema B (focos_risco.foco_anterior_id): rastreio histórico de longo prazo
--
-- Esta migration NÃO altera o funcionamento dos sistemas existentes.
-- =============================================================================

-- 1. Janela de recorrência configurável por cliente
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS janela_recorrencia_dias int NOT NULL DEFAULT 30
    CHECK (janela_recorrencia_dias BETWEEN 7 AND 365);

COMMENT ON COLUMN public.clientes.janela_recorrencia_dias IS
  'Janela temporal em dias para detecção de reincidência no mesmo endereço. '
  'Default: 30 dias. Prefeituras com ciclos mais longos podem configurar até 365 dias.';

-- 2. View: imóveis com padrão confirmado de reincidência
CREATE OR REPLACE VIEW public.v_imoveis_reincidentes
WITH (security_invoker = true) AS
WITH cadeia_focos AS (
  SELECT
    fr.cliente_id,
    fr.imovel_id,
    COUNT(fr.id)                                              AS total_focos_historico,
    COUNT(fr.id) FILTER (WHERE fr.foco_anterior_id IS NOT NULL) AS focos_reincidentes,
    COUNT(fr.id) FILTER (
      WHERE fr.status NOT IN ('resolvido','descartado')
    )                                                         AS focos_ativos,
    MAX(fr.suspeita_em)                                       AS ultimo_foco_em,
    MIN(fr.suspeita_em)                                       AS primeiro_foco_em,
    CASE WHEN COUNT(fr.id) > 1
      THEN ROUND(
        EXTRACT(EPOCH FROM (MAX(fr.suspeita_em) - MIN(fr.suspeita_em)))
        / (COUNT(fr.id) - 1) / 86400, 0
      )::int
      ELSE NULL
    END                                                        AS intervalo_medio_dias,
    COUNT(DISTINCT fr.ciclo)                                  AS ciclos_com_foco,
    array_agg(DISTINCT fr.origem_tipo) FILTER (
      WHERE fr.origem_tipo IS NOT NULL
    )                                                         AS origens,
    ROUND(
      100.0 * COUNT(fr.id) FILTER (WHERE fr.status = 'resolvido')
      / NULLIF(COUNT(fr.id), 0), 1
    )                                                         AS taxa_resolucao_pct
  FROM public.focos_risco fr
  WHERE fr.imovel_id IS NOT NULL
    AND fr.deleted_at IS NULL
  GROUP BY fr.cliente_id, fr.imovel_id
  HAVING COUNT(fr.id) >= 2
),
contexto_imovel AS (
  SELECT
    v.cliente_id,
    v.imovel_id,
    (
      SELECT vd2.tipo
      FROM public.vistoria_depositos vd2
      JOIN public.vistorias v2 ON v2.id = vd2.vistoria_id
      WHERE v2.imovel_id = v.imovel_id
        AND v2.cliente_id = v.cliente_id
        AND vd2.qtd_com_focos > 0
        AND vd2.deleted_at IS NULL
      GROUP BY vd2.tipo
      ORDER BY SUM(vd2.qtd_com_focos) DESC
      LIMIT 1
    )                                                         AS deposito_predominante,
    COUNT(v.id) FILTER (WHERE v.acesso_realizado = false)    AS tentativas_sem_acesso,
    bool_or(vd.usou_larvicida)                               AS usou_larvicida_alguma_vez,
    MAX(v.data_visita) FILTER (WHERE v.acesso_realizado = true) AS ultima_vistoria_com_acesso
  FROM public.vistorias v
  LEFT JOIN public.vistoria_depositos vd ON vd.vistoria_id = v.id AND vd.deleted_at IS NULL
  WHERE v.deleted_at IS NULL
  GROUP BY v.cliente_id, v.imovel_id
)
SELECT
  cf.cliente_id,
  cf.imovel_id,
  im.logradouro,
  im.numero,
  im.bairro,
  im.quarteirao,
  im.regiao_id,
  im.latitude,
  im.longitude,
  im.historico_recusa,
  im.prioridade_drone,
  cf.total_focos_historico,
  cf.focos_reincidentes,
  cf.focos_ativos,
  cf.ultimo_foco_em,
  cf.primeiro_foco_em,
  cf.intervalo_medio_dias,
  cf.ciclos_com_foco,
  cf.origens,
  cf.taxa_resolucao_pct,
  ci.deposito_predominante,
  ci.tentativas_sem_acesso,
  ci.usou_larvicida_alguma_vez,
  ci.ultima_vistoria_com_acesso,
  CASE
    WHEN cf.total_focos_historico >= 5 AND cf.focos_reincidentes >= 3 THEN 'cronico'
    WHEN cf.total_focos_historico >= 3 AND cf.focos_reincidentes >= 1 THEN 'recorrente'
    ELSE 'pontual'
  END                                                         AS padrao,
  EXTRACT(DAY FROM now() - cf.ultimo_foco_em)::int           AS dias_desde_ultimo_foco
FROM cadeia_focos cf
JOIN public.imoveis im ON im.id = cf.imovel_id AND im.deleted_at IS NULL
LEFT JOIN contexto_imovel ci
  ON ci.imovel_id = cf.imovel_id AND ci.cliente_id = cf.cliente_id
ORDER BY cf.total_focos_historico DESC, cf.ultimo_foco_em DESC;

GRANT SELECT ON public.v_imoveis_reincidentes TO authenticated;
COMMENT ON VIEW public.v_imoveis_reincidentes IS
  'Imóveis com padrão de reincidência (>= 2 focos históricos). '
  'Combina dados de focos_risco (Sistema B) com contexto de vistorias. '
  'Classificação: cronico (5+ focos, 3+ reincidentes) | recorrente | pontual. '
  'security_invoker = true.';

-- 3. View: tipos de depósito que mais reincidem por bairro
CREATE OR REPLACE VIEW public.v_reincidencia_por_deposito
WITH (security_invoker = true) AS
WITH depositos_com_foco AS (
  SELECT
    v.cliente_id,
    im.bairro,
    im.regiao_id,
    vd.tipo                                       AS tipo_deposito,
    COUNT(DISTINCT v.imovel_id)                   AS imoveis_afetados,
    SUM(vd.qtd_com_focos)                         AS total_focos_deposito,
    SUM(vd.qtd_eliminados)                        AS total_eliminados,
    COUNT(DISTINCT v.ciclo)                       AS ciclos_com_ocorrencia,
    ROUND(
      100.0 * SUM(vd.qtd_eliminados)
      / NULLIF(SUM(vd.qtd_com_focos), 0), 1
    )                                             AS taxa_eliminacao_pct,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE vd.usou_larvicida = true)
      / NULLIF(COUNT(*), 0), 1
    )                                             AS uso_larvicida_pct,
    COUNT(DISTINCT v.imovel_id) FILTER (
      WHERE EXISTS (
        SELECT 1
        FROM public.vistorias v2
        JOIN public.vistoria_depositos vd2 ON vd2.vistoria_id = v2.id
        WHERE v2.imovel_id = v.imovel_id
          AND v2.cliente_id = v.cliente_id
          AND v2.ciclo <> v.ciclo
          AND vd2.tipo = vd.tipo
          AND vd2.qtd_com_focos > 0
          AND vd2.deleted_at IS NULL
      )
    )                                             AS imoveis_multiciclo
  FROM public.vistorias v
  JOIN public.vistoria_depositos vd ON vd.vistoria_id = v.id
  JOIN public.imoveis im ON im.id = v.imovel_id
  WHERE vd.qtd_com_focos > 0
    AND v.deleted_at IS NULL
    AND vd.deleted_at IS NULL
    AND im.deleted_at IS NULL
  GROUP BY v.cliente_id, im.bairro, im.regiao_id, vd.tipo
)
SELECT
  *,
  ROUND(
    100.0 * imoveis_multiciclo / NULLIF(imoveis_afetados, 0), 1
  )                                               AS indice_reincidencia_pct
FROM depositos_com_foco
ORDER BY imoveis_multiciclo DESC, total_focos_deposito DESC;

GRANT SELECT ON public.v_reincidencia_por_deposito TO authenticated;
COMMENT ON VIEW public.v_reincidencia_por_deposito IS
  'Tipos de depósito que mais reincidem por bairro. '
  'indice_reincidencia_pct: % de imóveis afetados em múltiplos ciclos. '
  'security_invoker = true.';

-- 4. View: padrão de sazonalidade por ciclo e bairro
CREATE OR REPLACE VIEW public.v_reincidencia_sazonalidade
WITH (security_invoker = true) AS
SELECT
  fr.cliente_id,
  im.bairro,
  im.regiao_id,
  fr.ciclo,
  COUNT(fr.id)                                               AS focos_total,
  COUNT(fr.id) FILTER (WHERE fr.foco_anterior_id IS NOT NULL) AS focos_reincidentes,
  COUNT(fr.id) FILTER (WHERE fr.status = 'resolvido')        AS focos_resolvidos,
  COUNT(DISTINCT EXTRACT(YEAR FROM fr.suspeita_em))          AS anos_com_ocorrencia,
  ROUND(
    COUNT(fr.id)::numeric
    / NULLIF(COUNT(DISTINCT EXTRACT(YEAR FROM fr.suspeita_em)), 0), 1
  )                                                          AS media_focos_por_ano,
  ROUND(
    COUNT(fr.id) FILTER (
      WHERE fr.suspeita_em >= now() - interval '2 years'
    )::numeric / 2
    -
    COUNT(fr.id)::numeric
    / NULLIF(COUNT(DISTINCT EXTRACT(YEAR FROM fr.suspeita_em)), 0), 1
  )                                                          AS delta_tendencia
FROM public.focos_risco fr
JOIN public.imoveis im ON im.id = fr.imovel_id
WHERE fr.imovel_id IS NOT NULL
  AND fr.ciclo IS NOT NULL
  AND fr.deleted_at IS NULL
  AND im.deleted_at IS NULL
GROUP BY fr.cliente_id, im.bairro, im.regiao_id, fr.ciclo
HAVING COUNT(fr.id) >= 2
ORDER BY focos_reincidentes DESC;

GRANT SELECT ON public.v_reincidencia_sazonalidade TO authenticated;
COMMENT ON VIEW public.v_reincidencia_sazonalidade IS
  'Padrão sazonal de reincidência por bairro e ciclo bimestral. '
  'delta_tendencia > 0 indica piora nos últimos 2 anos vs. média histórica. '
  'security_invoker = true.';

-- 5. Função: score de risco de reincidência por imóvel (0–100)
CREATE OR REPLACE FUNCTION public.fn_risco_reincidencia_imovel(
  p_imovel_id  uuid,
  p_cliente_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_focos        int := 0;
  v_focos_reincidentes int := 0;
  v_focos_ativos       int := 0;
  v_ciclos_com_foco    int := 0;
  v_ultimo_foco_dias   int := 999;
  v_intervalo_medio    int := 999;
  v_sem_acesso         int := 0;
  v_tem_larvicida      bool := false;
  v_taxa_resolucao     numeric := 0;
  v_deposito_cronico   bool := false;
  v_score              numeric := 0;
  v_fatores            jsonb;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE foco_anterior_id IS NOT NULL),
    COUNT(*) FILTER (WHERE status NOT IN ('resolvido','descartado')),
    COUNT(DISTINCT ciclo),
    COALESCE(EXTRACT(DAY FROM now() - MAX(suspeita_em))::int, 999),
    CASE WHEN COUNT(*) > 1
      THEN (EXTRACT(EPOCH FROM (MAX(suspeita_em) - MIN(suspeita_em)))
            / (COUNT(*) - 1) / 86400)::int
      ELSE 999 END,
    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'resolvido') / NULLIF(COUNT(*), 0), 1)
  INTO
    v_total_focos, v_focos_reincidentes, v_focos_ativos,
    v_ciclos_com_foco, v_ultimo_foco_dias, v_intervalo_medio, v_taxa_resolucao
  FROM public.focos_risco
  WHERE imovel_id = p_imovel_id AND cliente_id = p_cliente_id AND deleted_at IS NULL;

  SELECT COUNT(*) INTO v_sem_acesso
  FROM public.vistorias
  WHERE imovel_id = p_imovel_id AND cliente_id = p_cliente_id
    AND acesso_realizado = false AND deleted_at IS NULL;

  SELECT bool_or(vd.usou_larvicida) INTO v_tem_larvicida
  FROM public.vistorias v
  JOIN public.vistoria_depositos vd ON vd.vistoria_id = v.id
  WHERE v.imovel_id = p_imovel_id AND v.cliente_id = p_cliente_id
    AND vd.qtd_com_focos > 0 AND vd.deleted_at IS NULL;

  SELECT EXISTS (
    SELECT vd.tipo
    FROM public.vistorias v
    JOIN public.vistoria_depositos vd ON vd.vistoria_id = v.id
    WHERE v.imovel_id = p_imovel_id AND v.cliente_id = p_cliente_id
      AND vd.qtd_com_focos > 0 AND vd.deleted_at IS NULL
    GROUP BY vd.tipo
    HAVING COUNT(DISTINCT v.ciclo) >= 3
  ) INTO v_deposito_cronico;

  v_score := v_score
    + LEAST(v_total_focos, 5) * 8
    + LEAST(v_focos_reincidentes, 3) * 10
    + LEAST(v_ciclos_com_foco, 4) * 5;

  IF v_focos_ativos > 0 THEN
    v_score := v_score + 20;
  END IF;

  IF v_intervalo_medio < 90 THEN
    v_score := v_score + 15;
  ELSIF v_intervalo_medio < 180 THEN
    v_score := v_score + 8;
  END IF;

  IF v_ultimo_foco_dias < 60 THEN
    v_score := v_score + 10;
  ELSIF v_ultimo_foco_dias < 120 THEN
    v_score := v_score + 5;
  END IF;

  v_score := v_score + LEAST(v_sem_acesso, 3) * 8;

  IF v_deposito_cronico THEN
    v_score := v_score + 15;
  END IF;

  IF NOT COALESCE(v_tem_larvicida, false) AND v_total_focos > 0 THEN
    v_score := v_score + 5;
  END IF;

  IF v_taxa_resolucao < 50 AND v_total_focos >= 2 THEN
    v_score := v_score + 10;
  END IF;

  v_score := GREATEST(0, LEAST(100, v_score));

  v_fatores := jsonb_build_object(
    'total_focos',          v_total_focos,
    'focos_reincidentes',   v_focos_reincidentes,
    'focos_ativos',         v_focos_ativos,
    'ciclos_com_foco',      v_ciclos_com_foco,
    'ultimo_foco_dias',     v_ultimo_foco_dias,
    'intervalo_medio_dias', v_intervalo_medio,
    'sem_acesso',           v_sem_acesso,
    'deposito_cronico',     v_deposito_cronico,
    'tem_larvicida',        COALESCE(v_tem_larvicida, false),
    'taxa_resolucao_pct',   v_taxa_resolucao
  );

  RETURN jsonb_build_object(
    'score',         v_score,
    'classificacao', CASE
      WHEN v_score >= 70 THEN 'alto'
      WHEN v_score >= 40 THEN 'medio'
      ELSE 'baixo'
    END,
    'fatores', v_fatores
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_risco_reincidencia_imovel(uuid, uuid) TO authenticated;
COMMENT ON FUNCTION public.fn_risco_reincidencia_imovel IS
  'Score 0–100 de risco de nova reincidência em um imóvel. '
  'Diferente do score territorial: foca em padrão histórico de REINCIDÊNCIA. '
  'Classificação: alto (>=70) | medio (>=40) | baixo.';
