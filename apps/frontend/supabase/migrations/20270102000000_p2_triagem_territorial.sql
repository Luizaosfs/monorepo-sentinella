-- ═══════════════════════════════════════════════════════════════════════════════
-- P2 — Triagem territorial com agrupamento inteligente
--
-- Hierarquia de agrupamento:
--   1. quadra (quarteirao via imoveis)
--   2. bairro (via imoveis)
--   3. regiao (regiao_id via regioes)
--   4. item   (fallback — foco individual)
--
-- O sistema NUNCA trava por falta de um nível: fallback para item garante
-- que todo foco pertença a exatamente um grupo.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Índices de suporte ao agrupamento territorial ─────────────────────────

CREATE INDEX IF NOT EXISTS idx_focos_risco_regiao_id_ativo
  ON public.focos_risco (cliente_id, regiao_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_imoveis_bairro
  ON public.imoveis (bairro)
  WHERE bairro IS NOT NULL AND bairro <> '';

CREATE INDEX IF NOT EXISTS idx_imoveis_quarteirao
  ON public.imoveis (quarteirao)
  WHERE quarteirao IS NOT NULL AND quarteirao <> '';

-- ── 2. View de agrupamento territorial ───────────────────────────────────────
-- Agrupa focos ativos (não-terminais) pelo nível territorial mais granular
-- disponível. Garante fallback até item individual.

DROP VIEW IF EXISTS public.v_focos_risco_agrupados;

CREATE VIEW public.v_focos_risco_agrupados AS
SELECT
  f.cliente_id,

  -- Tipo do agrupamento (hierarquia: quadra > bairro > regiao > item)
  CASE
    WHEN i.quarteirao IS NOT NULL AND i.quarteirao <> '' THEN 'quadra'
    WHEN i.bairro     IS NOT NULL AND i.bairro     <> '' THEN 'bairro'
    WHEN r.id         IS NOT NULL                         THEN 'regiao'
    ELSE 'item'
  END::text AS agrupador_tipo,

  -- Valor legível do agrupamento
  CASE
    WHEN i.quarteirao IS NOT NULL AND i.quarteirao <> '' THEN i.quarteirao
    WHEN i.bairro     IS NOT NULL AND i.bairro     <> '' THEN i.bairro
    WHEN r.id         IS NOT NULL                         THEN COALESCE(r.regiao, r.id::text)
    ELSE f.id::text
  END AS agrupador_valor,

  -- Contagens
  count(*)::int                                                               AS quantidade_focos,
  count(*) FILTER (WHERE f.status IN ('em_triagem', 'aguarda_inspecao'))::int AS quantidade_elegivel,
  count(*) FILTER (WHERE f.status = 'em_triagem')::int                       AS ct_em_triagem,
  count(*) FILTER (WHERE f.status = 'aguarda_inspecao')::int                 AS ct_aguarda_inspecao,

  -- Prioridade máxima do grupo (menor ordinal = maior urgência: P1=1 … P5=5)
  min(CASE f.prioridade
    WHEN 'P1' THEN 1
    WHEN 'P2' THEN 2
    WHEN 'P3' THEN 3
    WHEN 'P4' THEN 4
    WHEN 'P5' THEN 5
    ELSE 99
  END)::int AS prioridade_max_ord,

  -- Array de IDs ordenado por prioridade (para distribuição em lote)
  array_agg(f.id ORDER BY f.score_prioridade DESC NULLS LAST) AS foco_ids,

  -- Centróide aproximado do grupo
  avg(f.latitude)  AS lat_media,
  avg(f.longitude) AS lng_media

FROM public.focos_risco f
LEFT JOIN public.imoveis i ON i.id = f.imovel_id
LEFT JOIN public.regioes r ON r.id = f.regiao_id

WHERE f.deleted_at IS NULL
  AND f.status NOT IN ('resolvido', 'descartado')

GROUP BY
  f.cliente_id,
  -- Expressão CASE deve ser idêntica à do SELECT
  CASE
    WHEN i.quarteirao IS NOT NULL AND i.quarteirao <> '' THEN 'quadra'
    WHEN i.bairro     IS NOT NULL AND i.bairro     <> '' THEN 'bairro'
    WHEN r.id         IS NOT NULL                         THEN 'regiao'
    ELSE 'item'
  END,
  CASE
    WHEN i.quarteirao IS NOT NULL AND i.quarteirao <> '' THEN i.quarteirao
    WHEN i.bairro     IS NOT NULL AND i.bairro     <> '' THEN i.bairro
    WHEN r.id         IS NOT NULL                         THEN COALESCE(r.regiao, r.id::text)
    ELSE f.id::text
  END;

-- ── 3. RPC de distribuição em lote por agrupamento territorial ───────────────
-- Distribui múltiplos focos para um agente respeitando as regras de status.
-- Apenas em_triagem e aguarda_inspecao são elegíveis.
-- Focos em execução (em_inspecao em diante) são ignorados.

CREATE OR REPLACE FUNCTION public.rpc_atribuir_agente_foco_lote(
  p_foco_ids  uuid[],
  p_agente_id uuid,
  p_motivo    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario    usuarios%ROWTYPE;
  v_foco       focos_risco%ROWTYPE;
  v_atribuidos int := 0;
  v_ignorados  int := 0;
  v_foco_id    uuid;
  v_novo_status text;
BEGIN
  -- Validar papel do chamador
  SELECT * INTO v_usuario FROM usuarios WHERE auth_id = auth.uid();
  IF NOT FOUND OR v_usuario.papel_app NOT IN ('admin', 'gestor') THEN
    RAISE EXCEPTION 'Apenas gestores e administradores podem distribuir focos em lote'
      USING ERRCODE = 'P0001';
  END IF;

  FOREACH v_foco_id IN ARRAY p_foco_ids LOOP
    SELECT * INTO v_foco FROM focos_risco WHERE id = v_foco_id;

    -- Pula: foco não encontrado
    IF NOT FOUND THEN
      v_ignorados := v_ignorados + 1;
      CONTINUE;
    END IF;

    -- Pula: foco de outro cliente
    IF NOT public.usuario_pode_acessar_cliente(v_foco.cliente_id) THEN
      v_ignorados := v_ignorados + 1;
      CONTINUE;
    END IF;

    -- Pula: status inelegível (em_inspecao ou além não são reatribuídos)
    IF v_foco.status NOT IN ('em_triagem', 'aguarda_inspecao') THEN
      v_ignorados := v_ignorados + 1;
      CONTINUE;
    END IF;

    v_novo_status := CASE v_foco.status
      WHEN 'em_triagem' THEN 'aguarda_inspecao'  -- avança + atribui
      ELSE v_foco.status                          -- aguarda_inspecao: troca responsável
    END;

    UPDATE public.focos_risco
    SET responsavel_id = p_agente_id,
        status         = v_novo_status,
        updated_at     = now()
    WHERE id = v_foco_id;

    -- Reatribuição: registrar histórico manual (trigger não dispara sem mudança de status)
    IF v_foco.status = 'aguarda_inspecao' THEN
      INSERT INTO foco_risco_historico (
        foco_risco_id, cliente_id, status_anterior, status_novo, alterado_por, motivo
      ) VALUES (
        v_foco_id,
        v_foco.cliente_id,
        'aguarda_inspecao',
        'aguarda_inspecao',
        v_usuario.id,
        COALESCE(p_motivo, 'Reatribuição em lote por agrupamento territorial')
      );
    END IF;

    v_atribuidos := v_atribuidos + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'atribuidos', v_atribuidos,
    'ignorados',  v_ignorados
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_atribuir_agente_foco_lote(uuid[], uuid, text) TO authenticated;

COMMENT ON VIEW public.v_focos_risco_agrupados IS
  'Agrega focos ativos por nível territorial (quadra > bairro > regiao > item). '
  'Hierarquia garante fallback: todo foco pertence a exatamente um grupo. '
  'Usado na triagem territorial do gestor.';

COMMENT ON FUNCTION public.rpc_atribuir_agente_foco_lote IS
  'Distribui múltiplos focos a um agente em lote. '
  'Elegíveis: em_triagem (avança para aguarda_inspecao) e aguarda_inspecao (reatribui). '
  'Inelegíveis (em_inspecao em diante) são ignorados. '
  'Retorna { atribuidos: int, ignorados: int }.';
