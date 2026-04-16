-- =============================================================================
-- Quotas de uso por cliente
--
-- Permite que cada cliente tenha limites configuráveis de uso mensal:
--   voos_mes        — número máximo de voos por mês
--   levantamentos_mes — número máximo de levantamentos por mês
--   itens_mes       — número máximo de levantamento_itens por mês
--   usuarios_ativos — número máximo de usuários ativos (independe de mês)
--
-- NULL = ilimitado (padrão para todos os campos).
--
-- A view v_cliente_uso_mensal expõe uso atual vs. limite para o painel admin.
-- A função cliente_verificar_quota retorna { ok, usado, limite } para verificações
-- pontuais no código (ex: antes de criar um novo voo).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabela cliente_quotas
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cliente_quotas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id         uuid NOT NULL UNIQUE REFERENCES public.clientes(id) ON DELETE CASCADE,
  voos_mes           integer CHECK (voos_mes IS NULL OR voos_mes > 0),
  levantamentos_mes  integer CHECK (levantamentos_mes IS NULL OR levantamentos_mes > 0),
  itens_mes          integer CHECK (itens_mes IS NULL OR itens_mes > 0),
  usuarios_ativos    integer CHECK (usuarios_ativos IS NULL OR usuarios_ativos > 0),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cliente_quotas IS
  'Limites de uso por cliente. NULL = ilimitado. '
  'Gerenciado pelo admin da plataforma; não editável pelo admin da prefeitura.';

COMMENT ON COLUMN public.cliente_quotas.voos_mes          IS 'Máximo de voos por mês-calendário. NULL = ilimitado.';
COMMENT ON COLUMN public.cliente_quotas.levantamentos_mes IS 'Máximo de levantamentos por mês-calendário. NULL = ilimitado.';
COMMENT ON COLUMN public.cliente_quotas.itens_mes         IS 'Máximo de levantamento_itens por mês-calendário. NULL = ilimitado.';
COMMENT ON COLUMN public.cliente_quotas.usuarios_ativos   IS 'Máximo de usuários ativos simultâneos. NULL = ilimitado.';

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.trg_cliente_quotas_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_cliente_quotas_updated_at ON public.cliente_quotas;
CREATE TRIGGER trg_cliente_quotas_updated_at
  BEFORE UPDATE ON public.cliente_quotas
  FOR EACH ROW EXECUTE FUNCTION public.trg_cliente_quotas_updated_at();

-- -----------------------------------------------------------------------------
-- 2. RLS — somente admin da plataforma pode escrever; admin do cliente pode ler
-- -----------------------------------------------------------------------------
ALTER TABLE public.cliente_quotas ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário do cliente
CREATE POLICY "cliente_quotas_select" ON public.cliente_quotas
  FOR SELECT TO authenticated
  USING (public.usuario_pode_acessar_cliente(cliente_id));

-- Escrita: somente admin da plataforma (papel 'admin' + cliente_id NULL ou multi)
-- Usa check simples por papel: o frontend admin chama via service_role ou a RPC abaixo
CREATE POLICY "cliente_quotas_insert" ON public.cliente_quotas
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.papeis_usuarios pu
      WHERE pu.usuario_id = auth.uid()
        AND pu.papel = 'admin'
    )
  );

CREATE POLICY "cliente_quotas_update" ON public.cliente_quotas
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.papeis_usuarios pu
      WHERE pu.usuario_id = auth.uid()
        AND pu.papel = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.papeis_usuarios pu
      WHERE pu.usuario_id = auth.uid()
        AND pu.papel = 'admin'
    )
  );

-- -----------------------------------------------------------------------------
-- 3. Auto-seed: cria linha de quota (tudo NULL = ilimitado) ao criar cliente
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_seed_cliente_quotas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.cliente_quotas (cliente_id)
  VALUES (NEW.id)
  ON CONFLICT (cliente_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_cliente_quotas_on_insert ON public.clientes;
CREATE TRIGGER trg_seed_cliente_quotas_on_insert
  AFTER INSERT ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_seed_cliente_quotas();

-- Backfill: cria entrada para clientes existentes
INSERT INTO public.cliente_quotas (cliente_id)
SELECT id FROM public.clientes
ON CONFLICT (cliente_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. View v_cliente_uso_mensal — uso atual do mês-calendário corrente
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_cliente_uso_mensal AS
SELECT
  c.id                                                            AS cliente_id,
  c.nome                                                          AS cliente_nome,

  -- Voos no mês corrente
  (
    SELECT count(*)
    FROM public.voos v
    JOIN public.planejamento p ON p.id = v.planejamento_id
    WHERE p.cliente_id = c.id
      AND date_trunc('month', v.inicio) = date_trunc('month', now())
  )::integer                                                      AS voos_mes_usado,
  q.voos_mes                                                      AS voos_mes_limite,

  -- Levantamentos no mês corrente
  (
    SELECT count(*)
    FROM public.levantamentos l
    WHERE l.cliente_id = c.id
      AND date_trunc('month', l.created_at) = date_trunc('month', now())
  )::integer                                                      AS levantamentos_mes_usado,
  q.levantamentos_mes                                             AS levantamentos_mes_limite,

  -- Itens no mês corrente
  (
    SELECT count(*)
    FROM public.levantamento_itens li
    JOIN public.levantamentos l ON l.id = li.levantamento_id
    WHERE l.cliente_id = c.id
      AND date_trunc('month', li.created_at) = date_trunc('month', now())
  )::integer                                                      AS itens_mes_usado,
  q.itens_mes                                                     AS itens_mes_limite,

  -- Usuários cadastrados para o cliente (independe de mês)
  (
    SELECT count(*)
    FROM public.usuarios u
    WHERE u.cliente_id = c.id
  )::integer                                                      AS usuarios_ativos_usado,
  q.usuarios_ativos                                               AS usuarios_ativos_limite,

  -- Flags de violação (NULL limite = nunca violado)
  (q.voos_mes           IS NOT NULL AND
   (SELECT count(*) FROM public.voos v
    JOIN public.planejamento p ON p.id = v.planejamento_id
    WHERE p.cliente_id = c.id
      AND date_trunc('month', v.inicio) = date_trunc('month', now())
   ) >= q.voos_mes)                                              AS voos_excedido,

  (q.levantamentos_mes  IS NOT NULL AND
   (SELECT count(*) FROM public.levantamentos l
    WHERE l.cliente_id = c.id
      AND date_trunc('month', l.created_at) = date_trunc('month', now())
   ) >= q.levantamentos_mes)                                     AS levantamentos_excedido,

  (q.itens_mes          IS NOT NULL AND
   (SELECT count(*) FROM public.levantamento_itens li
    JOIN public.levantamentos l ON l.id = li.levantamento_id
    WHERE l.cliente_id = c.id
      AND date_trunc('month', li.created_at) = date_trunc('month', now())
   ) >= q.itens_mes)                                             AS itens_excedido,

  (q.usuarios_ativos    IS NOT NULL AND
   (SELECT count(*) FROM public.usuarios u
    WHERE u.cliente_id = c.id
   ) >= q.usuarios_ativos)                                       AS usuarios_excedido

FROM public.clientes c
LEFT JOIN public.cliente_quotas q ON q.cliente_id = c.id;

COMMENT ON VIEW public.v_cliente_uso_mensal IS
  'Uso do mês corrente vs. limites de quota por cliente. '
  'NULL em *_limite = ilimitado. *_excedido = true quando uso >= limite.';

GRANT SELECT ON public.v_cliente_uso_mensal TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Função cliente_verificar_quota — verificação pontual antes de criar registros
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cliente_verificar_quota(
  p_cliente_id uuid,
  p_metrica    text   -- 'voos_mes' | 'levantamentos_mes' | 'itens_mes' | 'usuarios_ativos'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usado   integer := 0;
  v_limite  integer;
BEGIN
  IF p_metrica = 'voos_mes' THEN
    SELECT q.voos_mes INTO v_limite
    FROM public.cliente_quotas q WHERE q.cliente_id = p_cliente_id;

    SELECT count(*)::integer INTO v_usado
    FROM public.voos v
    JOIN public.planejamento p ON p.id = v.planejamento_id
    WHERE p.cliente_id = p_cliente_id
      AND date_trunc('month', v.inicio) = date_trunc('month', now());

  ELSIF p_metrica = 'levantamentos_mes' THEN
    SELECT q.levantamentos_mes INTO v_limite
    FROM public.cliente_quotas q WHERE q.cliente_id = p_cliente_id;

    SELECT count(*)::integer INTO v_usado
    FROM public.levantamentos l
    WHERE l.cliente_id = p_cliente_id
      AND date_trunc('month', l.created_at) = date_trunc('month', now());

  ELSIF p_metrica = 'itens_mes' THEN
    SELECT q.itens_mes INTO v_limite
    FROM public.cliente_quotas q WHERE q.cliente_id = p_cliente_id;

    SELECT count(*)::integer INTO v_usado
    FROM public.levantamento_itens li
    JOIN public.levantamentos l ON l.id = li.levantamento_id
    WHERE l.cliente_id = p_cliente_id
      AND date_trunc('month', li.created_at) = date_trunc('month', now());

  ELSIF p_metrica = 'usuarios_ativos' THEN
    SELECT q.usuarios_ativos INTO v_limite
    FROM public.cliente_quotas q WHERE q.cliente_id = p_cliente_id;

    SELECT count(*)::integer INTO v_usado
    FROM public.usuarios u
    WHERE u.cliente_id = p_cliente_id AND u.ativo = true;

  ELSE
    RAISE EXCEPTION 'Métrica desconhecida: %. Use: voos_mes, levantamentos_mes, itens_mes, usuarios_ativos', p_metrica;
  END IF;

  RETURN jsonb_build_object(
    'ok',     v_limite IS NULL OR v_usado < v_limite,
    'usado',  v_usado,
    'limite', v_limite  -- NULL = ilimitado
  );
END;
$$;

COMMENT ON FUNCTION public.cliente_verificar_quota(uuid, text) IS
  'Verifica uso atual vs. limite de quota para a métrica informada. '
  'Retorna { ok: bool, usado: int, limite: int|null }. '
  'ok=true quando abaixo do limite ou limite é NULL (ilimitado).';

GRANT EXECUTE ON FUNCTION public.cliente_verificar_quota(uuid, text) TO authenticated;
