-- =============================================================================
-- CLEANUP-01: Consolidar denunciar_cidadao em uma única overload (7 params)
--
-- Problema: 3 overloads coexistem no banco:
--   5 params (S04)  — correta, cria foco_risco direto ✅
--   6 params (QW10B)— quebrada: insere em levantamento_itens com status_atendimento removida ❌
--   7 params (QW10B)— idem ❌
--
-- Fix: dropar 5 e 6 params; recriar versão única 7 params com DEFAULTs (todos os callers
-- continuam funcionando pois os 2 params extras têm DEFAULT NULL).
-- =============================================================================

-- 1. Dropar overloads quebradas (6 e 7 params) que referenciam status_atendimento
DROP FUNCTION IF EXISTS public.denunciar_cidadao(text, uuid, text, double precision, double precision, text);
DROP FUNCTION IF EXISTS public.denunciar_cidadao(text, uuid, text, double precision, double precision, text, text);

-- 2. Dropar a overload de 5 params (será coberta pela de 7 com DEFAULT NULL)
DROP FUNCTION IF EXISTS public.denunciar_cidadao(text, uuid, text, double precision, double precision);

-- 3. Versão única consolidada — 7 params, últimos 4 com DEFAULT NULL
CREATE OR REPLACE FUNCTION public.denunciar_cidadao(
  p_slug            text,
  p_bairro_id       uuid,
  p_descricao       text,
  p_latitude        double precision DEFAULT NULL,
  p_longitude       double precision DEFAULT NULL,
  p_foto_url        text             DEFAULT NULL,
  p_foto_public_id  text             DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cliente_id uuid;
  v_regiao_id  uuid;
  v_foco_id    uuid;
  v_ciclo      int;
BEGIN
  -- Resolver cliente pelo slug
  SELECT id INTO v_cliente_id
  FROM public.clientes
  WHERE slug = p_slug AND ativo = true;

  IF v_cliente_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cliente não encontrado');
  END IF;

  -- Rate limit: máx 5 denúncias por cliente por minuto
  IF (
    SELECT COUNT(*) FROM public.focos_risco
    WHERE cliente_id = v_cliente_id
      AND origem_tipo = 'cidadao'
      AND created_at > now() - interval '1 minute'
  ) >= 5 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Muitas denúncias recentes. Tente novamente em alguns minutos.'
    );
  END IF;

  -- Resolver região pelo bairro_id (opcional)
  IF p_bairro_id IS NOT NULL THEN
    SELECT id INTO v_regiao_id
    FROM public.regioes
    WHERE id = p_bairro_id AND cliente_id = v_cliente_id;
  END IF;

  -- Ciclo atual (1–6 por ano, 2 meses cada)
  v_ciclo := CEIL(EXTRACT(MONTH FROM now())::int / 2.0)::int;

  -- Criar foco_risco diretamente (sem depender de levantamento_itens)
  INSERT INTO public.focos_risco (
    cliente_id, regiao_id, origem_tipo, status, prioridade,
    ciclo, latitude, longitude, endereco_normalizado, suspeita_em
  ) VALUES (
    v_cliente_id, v_regiao_id, 'cidadao', 'suspeita', 'P3',
    v_ciclo, p_latitude, p_longitude,
    LEFT(p_descricao, 500), now()
  )
  RETURNING id INTO v_foco_id;

  RETURN jsonb_build_object(
    'ok',             true,
    'foco_id',        v_foco_id::text,
    'foto_url',       p_foto_url,
    'foto_public_id', p_foto_public_id
  );
END;
$$;

-- 4. Grants para acesso público (cidadão sem auth)
GRANT EXECUTE ON FUNCTION public.denunciar_cidadao(text, uuid, text, double precision, double precision, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.denunciar_cidadao(text, uuid, text, double precision, double precision, text, text) TO authenticated;

COMMENT ON FUNCTION public.denunciar_cidadao(text, uuid, text, double precision, double precision, text, text) IS
  'CLEANUP-01: Versão consolidada — única overload (7 params, últimos 4 com DEFAULT NULL). '
  'Cria foco_risco com origem_tipo=cidadao. Rate limit 5/min por cliente. '
  'Parâmetros: p_slug, p_bairro_id, p_descricao, p_latitude?, p_longitude?, p_foto_url?, p_foto_public_id?. '
  'Overloads de 5 e 6 params removidas.';
