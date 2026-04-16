-- =============================================================================
-- F-11: Alerta ao gestor quando imóvel recebe prioridade_drone = true
--
-- Problema: fn_atualizar_perfil_imovel() ativa prioridade_drone mas não
-- notifica o gestor. O fluxo quebra aqui — gestor só descobre ao abrir a tela.
--
-- Fix: ao elevar prioridade_drone pela primeira vez, insere job em job_queue
-- com tipo='notif_imovel_prioridade_drone' para processamento pela Edge Function.
-- A notif NÃO é repetida se prioridade_drone já estava true (evita spam).
--
-- Mantém: janela 60 dias para contagem de tentativas (R-26).
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_atualizar_perfil_imovel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sem_acesso int;
  v_ja_drone   boolean;
  v_cliente_id uuid;
BEGIN
  -- Só age em vistorias sem acesso
  IF NEW.acesso_realizado IS DISTINCT FROM false THEN
    RETURN NEW;
  END IF;

  -- Conta tentativas sem acesso nos últimos 60 dias (R-26)
  SELECT COUNT(*)
    INTO v_sem_acesso
  FROM public.vistorias
  WHERE imovel_id        = NEW.imovel_id
    AND acesso_realizado = false
    AND created_at       >= now() - interval '60 days';

  IF v_sem_acesso >= 3 THEN
    -- Lê estado atual antes do UPDATE para detectar primeira ativação
    SELECT prioridade_drone, cliente_id
      INTO v_ja_drone, v_cliente_id
    FROM public.imoveis
    WHERE id = NEW.imovel_id;

    -- Marca imóvel como recusante e candidato a drone
    UPDATE public.imoveis
    SET historico_recusa = true,
        prioridade_drone  = true
    WHERE id = NEW.imovel_id;

    -- Notifica gestor apenas na PRIMEIRA ativação (evita job duplicado)
    IF NOT COALESCE(v_ja_drone, false) THEN
      INSERT INTO public.job_queue (tipo, payload)
      VALUES (
        'notif_imovel_prioridade_drone',
        jsonb_build_object(
          'imovel_id',   NEW.imovel_id,
          'cliente_id',  v_cliente_id,
          'vistoria_id', NEW.id,
          'agente_id',   NEW.agente_id,
          'tentativas',  v_sem_acesso
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atualizar_perfil_imovel ON public.vistorias;
CREATE TRIGGER trg_atualizar_perfil_imovel
  AFTER INSERT OR UPDATE ON public.vistorias
  FOR EACH ROW
  EXECUTE FUNCTION fn_atualizar_perfil_imovel();

COMMENT ON FUNCTION fn_atualizar_perfil_imovel() IS
  'R-26 + F-11: janela 60 dias para tentativas sem acesso; na primeira vez que '
  'prioridade_drone é ativado insere job_queue(notif_imovel_prioridade_drone) '
  'para o gestor ser alertado via Edge Function.';
