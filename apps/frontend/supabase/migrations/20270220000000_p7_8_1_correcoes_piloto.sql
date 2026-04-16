-- ============================================================
-- P7.8.1 — CORREÇÕES CRÍTICAS DO PILOTO
-- BLOCO 1: Territorialização automática no despacho (ST_Contains)
-- BLOCO 2: Correção de inconsistência de estado (em_triagem c/ historico despachado)
-- BLOCO 3: logEvento renomeado para despacho_lote (aplicado no frontend)
-- ============================================================

-- ── ÍNDICE GIST para inferência territorial ───────────────────────────────────
-- Garante performance em ST_Contains contra regioes.area durante o despacho
CREATE INDEX IF NOT EXISTS idx_regioes_area_gist
  ON public.regioes USING gist (area);


-- ── BLOCO 2: Correção de inconsistência de estado ─────────────────────────────
-- Focos que têm em_triagem como status atual mas possuem registro no historico
-- com status_novo = aguarda_inspecao (despacho ocorreu mas status não avançou)
DO $$
DECLARE
  v_row    record;
  v_count  int := 0;
BEGIN
  FOR v_row IN
    SELECT DISTINCT ON (f.id)
      f.id          AS foco_id,
      f.cliente_id,
      h.alterado_por
    FROM public.focos_risco f
    JOIN public.foco_risco_historico h
      ON h.foco_risco_id = f.id
     AND h.status_novo   = 'aguarda_inspecao'
    WHERE f.status = 'em_triagem'
    ORDER BY f.id, h.alterado_em DESC
  LOOP
    UPDATE public.focos_risco
       SET status     = 'aguarda_inspecao',
           updated_at = now()
     WHERE id = v_row.foco_id;

    INSERT INTO public.foco_risco_historico (
      foco_risco_id, cliente_id,
      status_anterior, status_novo,
      alterado_por, motivo
    ) VALUES (
      v_row.foco_id,
      v_row.cliente_id,
      'em_triagem',
      'aguarda_inspecao',
      v_row.alterado_por,
      'Correção P7.8.1: status inconsistente — historico indicava despacho '
      'mas status permanecia em_triagem. Corrigido automaticamente.'
    );

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'P7.8.1 BLOCO 2: % focos corrigidos (em_triagem → aguarda_inspecao)', v_count;
END;
$$;


-- ── BLOCO 1a: rpc_atribuir_agente_foco — inferência territorial ───────────────
CREATE OR REPLACE FUNCTION "public"."rpc_atribuir_agente_foco"(
  "p_foco_id"  "uuid",
  "p_agente_id" "uuid",
  "p_motivo"   "text" DEFAULT NULL::"text"
) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_usuario    usuarios%ROWTYPE;
  v_papel      text;
  v_foco       focos_risco%ROWTYPE;
  v_novo_status text;
  v_regiao_id  uuid;
BEGIN
  -- Obter dados do chamador
  SELECT u.* INTO v_usuario FROM usuarios u WHERE u.auth_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = 'P0001';
  END IF;

  -- Obter papel canônico do chamador (papeis_usuarios, não usuarios.papel_app)
  SELECT pu.papel INTO v_papel
    FROM papeis_usuarios pu
   WHERE pu.usuario_id = auth.uid();

  IF v_papel IS NULL THEN
    RAISE EXCEPTION 'Usuário sem papel definido — acesso negado' USING ERRCODE = 'P0001';
  END IF;

  IF NOT COALESCE(v_usuario.ativo, false) THEN
    RAISE EXCEPTION 'Usuário inativo — acesso negado' USING ERRCODE = 'P0001';
  END IF;

  IF v_papel != 'supervisor' THEN
    RAISE EXCEPTION 'Apenas supervisores podem distribuir focos para agentes'
      USING ERRCODE = 'P0001';
  END IF;

  -- Obter foco
  SELECT * INTO v_foco FROM focos_risco WHERE id = p_foco_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Foco não encontrado: %', p_foco_id USING ERRCODE = 'P0002';
  END IF;

  -- Validar acesso de tenant
  IF NOT public.usuario_pode_acessar_cliente(v_foco.cliente_id) THEN
    RAISE EXCEPTION 'Acesso negado ao foco' USING ERRCODE = 'P0003';
  END IF;

  -- Só permite distribuição nos estados corretos
  IF v_foco.status NOT IN ('em_triagem', 'aguarda_inspecao') THEN
    RAISE EXCEPTION 'Distribuição só é permitida nos estados em_triagem ou aguarda_inspecao. Estado atual: %',
      v_foco.status USING ERRCODE = 'P0004';
  END IF;

  -- Validar que o agente alvo pertence ao mesmo cliente, está ativo e tem papel agente
  IF NOT EXISTS (
    SELECT 1
    FROM usuarios u
    JOIN papeis_usuarios pu ON pu.usuario_id = u.auth_id
    WHERE u.id = p_agente_id
      AND u.cliente_id = v_foco.cliente_id
      AND pu.papel = 'agente'
      AND u.ativo = true
  ) THEN
    RAISE EXCEPTION 'Agente inválido ou inativo para este cliente'
      USING ERRCODE = 'P0005';
  END IF;

  -- BLOCO 1: Inferir regiao_id via ST_Contains se foco sem região e com coordenadas
  v_regiao_id := v_foco.regiao_id;
  IF v_regiao_id IS NULL
     AND v_foco.latitude  IS NOT NULL
     AND v_foco.longitude IS NOT NULL
  THEN
    SELECT r.id INTO v_regiao_id
      FROM regioes r
     WHERE r.cliente_id = v_foco.cliente_id
       AND r.area IS NOT NULL
       AND ST_Contains(
             r.area,
             ST_SetSRID(ST_MakePoint(v_foco.longitude, v_foco.latitude), 4326)
           )
     LIMIT 1;
  END IF;

  IF v_foco.status = 'em_triagem' THEN
    v_novo_status := 'aguarda_inspecao';
    UPDATE focos_risco
       SET status         = v_novo_status,
           responsavel_id = p_agente_id,
           regiao_id      = COALESCE(v_regiao_id, v_foco.regiao_id),
           updated_at     = now()
     WHERE id = p_foco_id;

    INSERT INTO foco_risco_historico (
      foco_risco_id, cliente_id, status_anterior, status_novo, alterado_por, motivo
    ) VALUES (
      p_foco_id, v_foco.cliente_id,
      'em_triagem', 'aguarda_inspecao',
      v_usuario.id, COALESCE(p_motivo, 'Atribuição de agente pelo supervisor')
    );
  ELSE
    UPDATE focos_risco
       SET responsavel_id = p_agente_id,
           regiao_id      = COALESCE(v_regiao_id, v_foco.regiao_id),
           updated_at     = now()
     WHERE id = p_foco_id;

    INSERT INTO foco_risco_historico (
      foco_risco_id, cliente_id, status_anterior, status_novo, alterado_por, motivo
    ) VALUES (
      p_foco_id, v_foco.cliente_id,
      'aguarda_inspecao', 'aguarda_inspecao',
      v_usuario.id, COALESCE(p_motivo, 'Reatribuição de agente pelo supervisor')
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION "public"."rpc_atribuir_agente_foco"("uuid","uuid","text") IS
  'Distribui ou reatribui um foco_risco para um agente. Exclusivo para supervisores. '
  'Papel verificado via papeis_usuarios.papel. Estados permitidos: em_triagem → aguarda_inspecao (primeira atribuição) '
  'ou aguarda_inspecao (reatribuição). '
  'P7.8.1: auto-infere regiao_id via ST_Contains(regioes.area, ponto) quando lat/lng disponível e regiao_id ausente.';


-- ── BLOCO 1b: rpc_atribuir_agente_foco_lote — inferência territorial ──────────
CREATE OR REPLACE FUNCTION "public"."rpc_atribuir_agente_foco_lote"(
  "p_foco_ids"  "uuid"[],
  "p_agente_id" "uuid",
  "p_motivo"    "text" DEFAULT NULL::"text"
) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_usuario    usuarios%ROWTYPE;
  v_papel      text;
  v_ativo      boolean;
  v_foco       focos_risco%ROWTYPE;
  v_atribuidos int := 0;
  v_ignorados  int := 0;
  v_foco_id    uuid;
  v_novo_status text;
  v_regiao_id  uuid;
BEGIN
  -- Obter dados do chamador
  SELECT * INTO v_usuario FROM usuarios u WHERE u.auth_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = 'P0001';
  END IF;
  v_ativo := v_usuario.ativo;

  -- Obter papel canônico via papeis_usuarios (não usuarios.papel_app — removida)
  SELECT pu.papel INTO v_papel
    FROM papeis_usuarios pu
   WHERE pu.usuario_id = auth.uid();

  IF v_papel IS NULL THEN
    RAISE EXCEPTION 'Usuário sem papel definido — acesso negado' USING ERRCODE = 'P0001';
  END IF;

  IF NOT COALESCE(v_ativo, false) THEN
    RAISE EXCEPTION 'Usuário inativo — acesso negado' USING ERRCODE = 'P0001';
  END IF;

  -- SOMENTE supervisor pode distribuir focos
  IF v_papel != 'supervisor' THEN
    RAISE EXCEPTION 'Apenas supervisores podem distribuir focos em lote. Papel atual: %', v_papel
      USING ERRCODE = 'P0001';
  END IF;

  -- Validar agente destino: mesmo cliente, ativo, papel agente — via papeis_usuarios
  IF NOT EXISTS (
    SELECT 1
    FROM usuarios u
    JOIN papeis_usuarios pu ON pu.usuario_id = u.auth_id
    JOIN focos_risco f ON f.id = p_foco_ids[1] AND f.cliente_id = u.cliente_id
    WHERE u.id = p_agente_id
      AND pu.papel = 'agente'
      AND u.ativo = true
  ) THEN
    RAISE EXCEPTION 'Agente inválido ou inativo para este cliente' USING ERRCODE = 'P0005';
  END IF;

  FOREACH v_foco_id IN ARRAY p_foco_ids LOOP
    SELECT * INTO v_foco FROM focos_risco WHERE id = v_foco_id;

    IF NOT FOUND
       OR NOT public.usuario_pode_acessar_cliente(v_foco.cliente_id)
       OR v_foco.status NOT IN ('em_triagem', 'aguarda_inspecao')
    THEN
      v_ignorados := v_ignorados + 1;
      CONTINUE;
    END IF;

    -- BLOCO 1: Inferir regiao_id via ST_Contains se foco sem região e com coordenadas
    v_regiao_id := v_foco.regiao_id;
    IF v_regiao_id IS NULL
       AND v_foco.latitude  IS NOT NULL
       AND v_foco.longitude IS NOT NULL
    THEN
      SELECT r.id INTO v_regiao_id
        FROM regioes r
       WHERE r.cliente_id = v_foco.cliente_id
         AND r.area IS NOT NULL
         AND ST_Contains(
               r.area,
               ST_SetSRID(ST_MakePoint(v_foco.longitude, v_foco.latitude), 4326)
             )
       LIMIT 1;
    END IF;

    IF v_foco.status = 'em_triagem' THEN
      v_novo_status := 'aguarda_inspecao';
      UPDATE focos_risco
         SET status         = v_novo_status,
             responsavel_id = p_agente_id,
             regiao_id      = COALESCE(v_regiao_id, v_foco.regiao_id),
             updated_at     = now()
       WHERE id = v_foco_id;

      INSERT INTO foco_risco_historico (
        foco_risco_id, cliente_id, status_anterior, status_novo, alterado_por, motivo
      ) VALUES (
        v_foco_id, v_foco.cliente_id,
        'em_triagem', 'aguarda_inspecao',
        v_usuario.id, COALESCE(p_motivo, 'Atribuição em lote pelo supervisor')
      );
    ELSE
      UPDATE focos_risco
         SET responsavel_id = p_agente_id,
             regiao_id      = COALESCE(v_regiao_id, v_foco.regiao_id),
             updated_at     = now()
       WHERE id = v_foco_id;

      INSERT INTO foco_risco_historico (
        foco_risco_id, cliente_id, status_anterior, status_novo, alterado_por, motivo
      ) VALUES (
        v_foco_id, v_foco.cliente_id,
        'aguarda_inspecao', 'aguarda_inspecao',
        v_usuario.id, COALESCE(p_motivo, 'Reatribuição em lote pelo supervisor')
      );
    END IF;

    v_atribuidos := v_atribuidos + 1;
  END LOOP;

  RETURN jsonb_build_object('atribuidos', v_atribuidos, 'ignorados', v_ignorados);
END;
$$;

COMMENT ON FUNCTION "public"."rpc_atribuir_agente_foco_lote"("uuid"[],"uuid","text") IS
  'Distribui múltiplos focos a um agente. Exclusivo para supervisores ativos. '
  'Papel verificado via papeis_usuarios.papel (papel_app removida). '
  'Guards: NULL papel, ativo=false, papel != supervisor, agente inválido. '
  'P7.8.1: auto-infere regiao_id via ST_Contains(regioes.area, ponto) quando lat/lng disponível e regiao_id ausente.';
