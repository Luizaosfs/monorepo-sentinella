-- =============================================================================
-- F-08: Auto-escalação de focos em 'suspeita' por tempo (> 48h sem ação)
--
-- Regra: foco em estado 'suspeita' por mais de 48 horas sem qualquer triagem
-- eleva automaticamente a prioridade para P1, garantindo visibilidade imediata.
-- O status permanece 'suspeita' — apenas a prioridade sobe.
-- O gestor pode então agir (triagem, confirmação) com urgência P1.
--
-- Implementação:
--   1. fn_auto_escalar_focos_suspeita() — varre e eleva prioridade
--   2. pg_cron job a cada hora (minuto 0 UTC)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_auto_escalar_focos_suspeita()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
BEGIN
  -- Eleva para P1 todos os focos em 'suspeita' criados há > 48h
  -- que ainda não estão em P1.
  -- Não altera status — apenas prioridade (visibilidade imediata no painel).
  UPDATE public.focos_risco
  SET
    prioridade = 'P1',
    updated_at = now()
  WHERE
    status    = 'suspeita'
    AND prioridade <> 'P1'
    AND created_at  < now() - interval '48 hours';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    RAISE NOTICE 'fn_auto_escalar_focos_suspeita: % foco(s) elevado(s) para P1', v_count;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.fn_auto_escalar_focos_suspeita() IS
  'F-08: Eleva para P1 focos em "suspeita" sem triagem após 48h. '
  'Executada pelo pg_cron a cada hora. Não altera status — apenas prioridade.';

-- ── pg_cron: hora em hora, minuto 0 UTC ──────────────────────────────────────
-- Desagenda versão anterior se existir (idempotente)
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname = 'auto-escalar-focos-suspeita';

SELECT cron.schedule(
  'auto-escalar-focos-suspeita',
  '0 * * * *',
  $$SELECT public.fn_auto_escalar_focos_suspeita();$$
);
