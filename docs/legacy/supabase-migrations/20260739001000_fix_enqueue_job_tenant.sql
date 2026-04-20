-- =============================================================================
-- Fix Security: fn_enqueue_job() — verificação de tenant no payload
-- Valida tipo mas não verifica se cliente_id pertence ao caller. (Fix S-08)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_enqueue_job(
  p_tipo    text,
  p_payload jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id          uuid;
  v_cliente_id  uuid;
  -- Jobs que operam em um cliente específico (verificam tenant)
  TIPOS_CLIENTE CONSTANT text[] := ARRAY['triagem_ia', 'relatorio_semanal', 'cnes_sync'];
  -- Jobs de plataforma que requerem papel admin
  TIPOS_ADMIN   CONSTANT text[] := ARRAY['limpeza_retencao', 'cloudinary_cleanup', 'health_check'];
BEGIN
  -- 1. Validação de tipo permitido
  IF p_tipo NOT IN (
    'triagem_ia', 'relatorio_semanal', 'cnes_sync',
    'limpeza_retencao', 'cloudinary_cleanup', 'health_check'
  ) THEN
    RAISE EXCEPTION 'Tipo de job inválido: %', p_tipo;
  END IF;

  -- 2. Jobs de plataforma: requerem papel admin
  IF p_tipo = ANY(TIPOS_ADMIN) THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION
        'fn_enqueue_job: job do tipo "%" requer papel admin', p_tipo;
    END IF;

  -- 3. Jobs de cliente: verificar que cliente_id pertence ao caller
  ELSIF p_tipo = ANY(TIPOS_CLIENTE) THEN
    v_cliente_id := (p_payload->>'cliente_id')::uuid;

    IF v_cliente_id IS NULL THEN
      RAISE EXCEPTION
        'fn_enqueue_job: cliente_id obrigatório no payload para jobs do tipo "%"', p_tipo;
    END IF;

    IF NOT public.usuario_pode_acessar_cliente(v_cliente_id) THEN
      RAISE EXCEPTION
        'fn_enqueue_job: acesso negado — cliente_id não pertence ao usuário autenticado';
    END IF;
  END IF;

  -- 4. Inserir job
  INSERT INTO public.job_queue (tipo, payload)
  VALUES (p_tipo, p_payload)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.fn_enqueue_job IS
  'Enfileira um job de forma segura. '
  'Jobs de cliente: valida tenant. Jobs de plataforma: requer papel admin. (QW-13 + Fix S-08)';

GRANT EXECUTE ON FUNCTION public.fn_enqueue_job(text, jsonb) TO authenticated;
