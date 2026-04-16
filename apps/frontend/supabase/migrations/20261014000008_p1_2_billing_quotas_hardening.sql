-- =============================================================================
-- P1-2: Billing / Quotas — comportamento real de produto
--
-- PROBLEMA:
--   1. cliente_plano.status não inclui 'trial'; sem campo data_trial_fim
--   2. Trigger de quota ausente em vistorias (voos ✓, levantamentos ✓, itens ✓)
--   3. cliente_verificar_quota ignora status suspenso/cancelado/trial expirado
--   4. Sem função pública que retorne contexto de tenant para o frontend
--
-- REGRAS DE ACESSO POR STATUS:
--   ativo        → normal; quotas aplicadas conforme plano
--   trial        → normal até data_trial_fim; após expirar → is_blocked=true
--   inadimplente → aviso frontend; sem bloqueio imediato (grace period)
--   suspenso     → is_blocked=true; cliente_verificar_quota retorna ok=false
--   cancelado    → is_blocked=true; cliente_verificar_quota retorna ok=false
--
-- ENTREGÁVEIS:
--   1. Adicionar 'trial' ao CHECK constraint; adicionar data_trial_fim
--   2. fn_check_quota_vistorias + trigger (150% grace, bypassa surto_ativo)
--   3. fn_get_tenant_context(uuid) → jsonb para o frontend (status, plano, is_blocked)
--   4. cliente_verificar_quota v2 — respeita status do tenant
-- =============================================================================

-- ── 1. Adicionar 'trial' ao CHECK constraint de cliente_plano.status ─────────
ALTER TABLE public.cliente_plano
  DROP CONSTRAINT IF EXISTS cliente_plano_status_check;
ALTER TABLE public.cliente_plano
  ADD CONSTRAINT cliente_plano_status_check
  CHECK (status IN ('ativo', 'trial', 'suspenso', 'cancelado', 'inadimplente'));

-- ── 2. Adicionar data_trial_fim ───────────────────────────────────────────────
ALTER TABLE public.cliente_plano
  ADD COLUMN IF NOT EXISTS data_trial_fim timestamptz;

COMMENT ON COLUMN public.cliente_plano.data_trial_fim IS
  'P1-2: Expiração do trial. NULL = sem prazo. '
  'Quando status=trial e data_trial_fim < now() → fn_get_tenant_context retorna is_blocked=true.';

-- ── 3. fn_check_quota_vistorias — bloqueio em 150% do limite ─────────────────
--
-- PADRÃO: igual a fn_check_quota_levantamentos (migration 20260734000000).
--   - Resolve limite via COALESCE(override individual, plano)
--   - Bypassa quando clientes.surto_ativo = true
--   - Bloqueia em 150% (grace period para não interromper vistorias em campo)
--   - NULL → sem limite configurado → libera
CREATE OR REPLACE FUNCTION public.fn_check_quota_vistorias()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limite  int;
  v_usado   int;
  v_surto   boolean;
BEGIN
  -- Bypass surto epidemiológico
  SELECT COALESCE(c.surto_ativo, false)
  INTO   v_surto
  FROM   public.clientes c
  WHERE  c.id = NEW.cliente_id;

  IF v_surto THEN RETURN NEW; END IF;

  -- Limite: COALESCE(override individual, limite do plano)
  SELECT COALESCE(
    (SELECT cq.vistorias_mes
     FROM   public.cliente_quotas cq
     WHERE  cq.cliente_id = NEW.cliente_id),
    (SELECT pl.limite_vistorias_mes
     FROM   public.cliente_plano cp
     JOIN   public.planos pl ON pl.id = cp.plano_id
     WHERE  cp.cliente_id = NEW.cliente_id
       AND  cp.status IN ('ativo', 'trial')
     LIMIT  1)
  ) INTO v_limite;

  IF v_limite IS NULL THEN RETURN NEW; END IF;  -- ilimitado

  -- Contagem do mês corrente (fuso: America/Sao_Paulo)
  SELECT COUNT(*)::int
  INTO   v_usado
  FROM   public.vistorias v
  WHERE  v.cliente_id = NEW.cliente_id
    AND  v.created_at >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')
                         AT TIME ZONE 'America/Sao_Paulo';

  -- Grace period: bloqueia apenas em 150% do limite
  IF v_usado >= (v_limite * 1.5)::int THEN
    RAISE EXCEPTION
      'quota_vistorias_excedida: limite % (grace 150%%) atingido no ciclo atual', v_limite
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_quota_vistorias ON public.vistorias;
CREATE TRIGGER trg_check_quota_vistorias
  BEFORE INSERT ON public.vistorias
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_check_quota_vistorias();

COMMENT ON FUNCTION public.fn_check_quota_vistorias() IS
  'P1-2: Quota de vistorias_mes; 150% grace; bypassa surto_ativo.';

-- ── 4. fn_get_tenant_context(uuid) — contexto de tenant para o frontend ───────
--
-- SEGURANÇA: SECURITY DEFINER; não expõe dados financeiros.
--   Retorna apenas: status, plano_nome, is_blocked, is_inadimplente, trial_days_left.
--   Em caso de erro (cliente sem plano): retorna estado seguro (ativo, não bloqueado).
CREATE OR REPLACE FUNCTION public.fn_get_tenant_context(p_cliente_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_status         text;
  v_plano_nome     text;
  v_trial_fim      timestamptz;
  v_is_blocked     boolean;
  v_trial_days     int;
BEGIN
  SELECT cp.status, pl.nome, cp.data_trial_fim
  INTO   v_status, v_plano_nome, v_trial_fim
  FROM   public.cliente_plano cp
  JOIN   public.planos pl ON pl.id = cp.plano_id
  WHERE  cp.cliente_id = p_cliente_id
  LIMIT  1;

  -- Sem plano cadastrado → estado seguro padrão
  IF v_status IS NULL THEN
    RETURN jsonb_build_object(
      'status',          'ativo',
      'plano_nome',      null,
      'is_blocked',      false,
      'is_inadimplente', false,
      'is_trialing',     false,
      'trial_days_left', null
    );
  END IF;

  -- Tenant bloqueado: suspenso, cancelado ou trial expirado
  v_is_blocked := CASE
    WHEN v_status IN ('suspenso', 'cancelado')              THEN true
    WHEN v_status = 'trial'
      AND v_trial_fim IS NOT NULL
      AND v_trial_fim < now()                               THEN true
    ELSE false
  END;

  -- Dias restantes de trial (0 se já expirou)
  v_trial_days := CASE
    WHEN v_status = 'trial' AND v_trial_fim IS NOT NULL
    THEN GREATEST(0, EXTRACT(DAY FROM (v_trial_fim - now()))::int)
    ELSE null
  END;

  RETURN jsonb_build_object(
    'status',          v_status,
    'plano_nome',      v_plano_nome,
    'is_blocked',      v_is_blocked,
    'is_inadimplente', v_status = 'inadimplente',
    'is_trialing',     v_status = 'trial' AND NOT v_is_blocked,
    'trial_days_left', v_trial_days
  );

EXCEPTION WHEN OTHERS THEN
  -- Fail-safe: nunca bloquear por erro de função
  RETURN jsonb_build_object(
    'status',          'ativo',
    'plano_nome',      null,
    'is_blocked',      false,
    'is_inadimplente', false,
    'is_trialing',     false,
    'trial_days_left', null
  );
END;
$$;

-- Admins e usuários autenticados podem consultar o contexto do próprio tenant
REVOKE ALL ON FUNCTION public.fn_get_tenant_context(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_get_tenant_context(uuid) TO authenticated;

COMMENT ON FUNCTION public.fn_get_tenant_context(uuid) IS
  'P1-2: Retorna status do tenant (status, plano_nome, is_blocked, trial_days_left). '
  'Usado pelo frontend para banners e guards. Fail-safe: retorna ativo em caso de erro.';

-- ── 5. Atualizar cliente_verificar_quota — respeita status do tenant ──────────
--
-- NOVA LÓGICA (v2):
--   0. Verificar status do tenant: suspenso/cancelado/trial expirado → ok=false, limite=0
--   1. COALESCE(override individual, limite do plano)
--   2. Contagem do mês corrente por métrica
--   Métricas suportadas: voos_mes, levantamentos_mes, itens_mes, usuarios_ativos,
--                         vistorias_mes, ia_calls_mes, storage_gb
CREATE OR REPLACE FUNCTION public.cliente_verificar_quota(
  p_cliente_id uuid,
  p_metrica    text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_status     text;
  v_trial_fim  timestamptz;
  v_limite     int;
  v_usado      int;
BEGIN
  -- ── 0. Status do tenant ──────────────────────────────────────────────────────
  SELECT cp.status, cp.data_trial_fim
  INTO   v_status, v_trial_fim
  FROM   public.cliente_plano cp
  WHERE  cp.cliente_id = p_cliente_id
  LIMIT  1;

  -- Tenant bloqueado → todas as quotas bloqueadas
  IF v_status IN ('suspenso', 'cancelado')
     OR (v_status = 'trial'
         AND v_trial_fim IS NOT NULL
         AND v_trial_fim < now()) THEN
    RETURN jsonb_build_object(
      'ok',     false,
      'usado',  0,
      'limite', 0,
      'motivo', 'tenant_bloqueado'
    );
  END IF;

  -- ── 1. Limite: COALESCE(override individual, plano) ─────────────────────────
  SELECT COALESCE(
    -- Override individual
    (SELECT CASE p_metrica
       WHEN 'voos_mes'          THEN cq.voos_mes
       WHEN 'levantamentos_mes' THEN cq.levantamentos_mes
       WHEN 'itens_mes'         THEN cq.itens_mes
       WHEN 'usuarios_ativos'   THEN cq.usuarios_ativos
       WHEN 'vistorias_mes'     THEN cq.vistorias_mes
       WHEN 'ia_calls_mes'      THEN cq.ia_calls_mes
       WHEN 'storage_gb'        THEN cq.storage_gb
       ELSE NULL
     END
     FROM public.cliente_quotas cq
     WHERE cq.cliente_id = p_cliente_id),
    -- Limite do plano
    (SELECT CASE p_metrica
       WHEN 'voos_mes'          THEN pl.limite_voos_mes
       WHEN 'levantamentos_mes' THEN pl.limite_levantamentos_mes
       WHEN 'itens_mes'         THEN NULL  -- não controlado a nível de plano (só quota)
       WHEN 'usuarios_ativos'   THEN pl.limite_usuarios
       WHEN 'vistorias_mes'     THEN pl.limite_vistorias_mes
       WHEN 'ia_calls_mes'      THEN pl.limite_ia_calls_mes
       WHEN 'storage_gb'        THEN pl.limite_storage_gb
       ELSE NULL
     END
     FROM   public.cliente_plano cp
     JOIN   public.planos pl ON pl.id = cp.plano_id
     WHERE  cp.cliente_id = p_cliente_id
     LIMIT  1)
  ) INTO v_limite;

  -- ── 2. Uso atual do mês ──────────────────────────────────────────────────────
  SELECT CASE p_metrica
    WHEN 'voos_mes' THEN (
      SELECT COUNT(*)::int FROM public.voos v
      WHERE  v.cliente_id = p_cliente_id
        AND  v.created_at >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')
                             AT TIME ZONE 'America/Sao_Paulo'
    )
    WHEN 'levantamentos_mes' THEN (
      SELECT COUNT(*)::int FROM public.levantamentos l
      WHERE  l.cliente_id = p_cliente_id
        AND  l.created_at >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')
                             AT TIME ZONE 'America/Sao_Paulo'
    )
    WHEN 'itens_mes' THEN (
      SELECT COUNT(*)::int FROM public.levantamento_itens li
      WHERE  li.cliente_id = p_cliente_id
        AND  li.created_at >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')
                             AT TIME ZONE 'America/Sao_Paulo'
    )
    WHEN 'usuarios_ativos' THEN (
      SELECT COUNT(*)::int FROM public.usuarios u
      WHERE  u.cliente_id = p_cliente_id
        AND  u.ativo = true
    )
    WHEN 'vistorias_mes' THEN (
      SELECT COUNT(*)::int FROM public.vistorias v
      WHERE  v.cliente_id = p_cliente_id
        AND  v.created_at >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')
                             AT TIME ZONE 'America/Sao_Paulo'
    )
    WHEN 'ia_calls_mes' THEN (
      SELECT COUNT(*)::int
      FROM   public.levantamento_analise_ia la
      JOIN   public.levantamentos lev ON lev.id = la.levantamento_id
      WHERE  lev.cliente_id = p_cliente_id
        AND  la.created_at >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')
                             AT TIME ZONE 'America/Sao_Paulo'
    )
    -- storage_gb: estimativa via snapshots; sem contagem em tempo real
    WHEN 'storage_gb' THEN COALESCE((
      SELECT (bss.storage_gb)::int
      FROM   public.billing_usage_snapshot bss
      WHERE  bss.cliente_id = p_cliente_id
      ORDER  BY bss.criado_em DESC
      LIMIT  1
    ), 0)
    ELSE 0
  END INTO v_usado;

  RETURN jsonb_build_object(
    'ok',     v_limite IS NULL OR v_usado < v_limite,
    'usado',  COALESCE(v_usado, 0),
    'limite', v_limite
  );

EXCEPTION WHEN OTHERS THEN
  -- Fail-safe: erro interno não deve bloquear operações
  RETURN jsonb_build_object('ok', true, 'usado', 0, 'limite', null);
END;
$$;

COMMENT ON FUNCTION public.cliente_verificar_quota(uuid, text) IS
  'P1-2 v2: Verifica quota de uma métrica. '
  'Respeita status do tenant (suspenso/cancelado/trial expirado → ok=false). '
  'COALESCE(override individual, limite do plano). '
  'Fail-safe: retorna ok=true em caso de erro interno.';

-- ── 6. Adicionar data_trial_fim ao tipo ClientePlano no schema ────────────────
-- (comentário de referência — o tipo TypeScript é atualizado no frontend)

-- =============================================================================
-- CHECKLIST DE COMPORTAMENTO POR STATUS DE TENANT
--
-- STATUS       | DB bloqueia? | Frontend banner          | Dismissable?
-- -------------|--------------|--------------------------|-------------
-- ativo        | via triggers | nenhum (ou quota aviso)  | —
-- trial >7d    | não          | azul info "X dias"       | sim
-- trial ≤7d    | não          | laranja "X dias restantes"| não
-- trial expirado| todas quotas | vermelho "Acesso expirado"| não
-- inadimplente | não          | amarelo "Pagamento pendente"| não
-- suspenso     | todas quotas | vermelho "Acesso suspenso" | não
-- cancelado    | todas quotas | vermelho "Acesso cancelado" | não
-- =============================================================================
