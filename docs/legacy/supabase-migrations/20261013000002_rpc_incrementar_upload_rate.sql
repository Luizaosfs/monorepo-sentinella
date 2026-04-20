-- =============================================================================
-- RPC: incrementar_upload_rate
--
-- Usada por cloudinary-upload-image (Edge Function) para rate-limiting de
-- uploads anônimos de cidadãos. Reutiliza canal_cidadao_rate_limit.
--
-- Retorna: { bloqueado: boolean }
--   true  → request deve ser rejeitado (429)
--   false → request dentro do limite
-- =============================================================================
CREATE OR REPLACE FUNCTION public.incrementar_upload_rate(
  p_ip_hash    text,
  p_cliente_id uuid,
  p_janela     timestamptz,
  p_limite     int DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contagem int;
BEGIN
  INSERT INTO public.canal_cidadao_rate_limit (ip_hash, cliente_id, janela_hora, contagem)
  VALUES (p_ip_hash, p_cliente_id, p_janela, 1)
  ON CONFLICT (ip_hash, cliente_id, janela_hora)
  DO UPDATE SET contagem = canal_cidadao_rate_limit.contagem + 1
  RETURNING contagem INTO v_contagem;

  IF v_contagem > p_limite THEN
    -- Reverter ao limite para não crescer indefinidamente
    UPDATE public.canal_cidadao_rate_limit
    SET contagem = p_limite
    WHERE ip_hash = p_ip_hash AND cliente_id = p_cliente_id AND janela_hora = p_janela;

    RETURN jsonb_build_object('bloqueado', true);
  END IF;

  RETURN jsonb_build_object('bloqueado', false);
END;
$$;

-- Executado pelo service role da Edge Function (não por usuários finais)
REVOKE ALL ON FUNCTION public.incrementar_upload_rate(text, uuid, timestamptz, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.incrementar_upload_rate(text, uuid, timestamptz, int)
  TO service_role;

COMMENT ON FUNCTION public.incrementar_upload_rate(text, uuid, timestamptz, int) IS
  'Rate limit de uploads anônimos para cloudinary-upload-image. '
  'Reutiliza canal_cidadao_rate_limit. Executada apenas pelo service_role da Edge Function.';
