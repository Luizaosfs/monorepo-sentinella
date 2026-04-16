-- =============================================================================
-- Trigger: enfileira Web Push ao criar foco com origem_tipo = 'cidadao'
-- Usa a tabela job_queue existente (QW-13, migration 20260726000000)
-- A Edge Function notif-canal-cidadao drena jobs do tipo 'notif_canal_cidadao'
-- =============================================================================

-- Trigger: enfileira Web Push ao criar foco de cidadão
CREATE OR REPLACE FUNCTION fn_notificar_foco_cidadao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.origem_tipo <> 'cidadao' THEN
    RETURN NEW;
  END IF;

  INSERT INTO job_queue (
    tipo, status, payload
  ) VALUES (
    'notif_canal_cidadao',
    'pendente',
    jsonb_build_object(
      'foco_id',        NEW.id,
      'cliente_id',     NEW.cliente_id,
      'latitude',       NEW.latitude,
      'longitude',      NEW.longitude,
      'endereco',       NEW.endereco_normalizado,
      'suspeita_em',    NEW.suspeita_em,
      'origem_item_id', NEW.origem_levantamento_item_id
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_foco_cidadao ON public.focos_risco;
CREATE TRIGGER trg_notif_foco_cidadao
  AFTER INSERT ON public.focos_risco
  FOR EACH ROW
  EXECUTE FUNCTION fn_notificar_foco_cidadao();

COMMENT ON FUNCTION fn_notificar_foco_cidadao() IS
  'Enfileira job de Web Push ao criar foco com origem_tipo=cidadao. '
  'Processado pela Edge Function notif-canal-cidadao.';
