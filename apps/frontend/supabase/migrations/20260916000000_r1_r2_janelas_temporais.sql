-- =============================================================================
-- R1 + R2: Correção de janelas temporais — tentativas sem acesso e reincidência
--
-- R1 — fn_atualizar_perfil_imovel:
--   ANTES: janela de 60 dias (R-26), nunca reseta prioridade_drone
--   DEPOIS: janela de 90 dias, reseta prioridade_drone se janela passa
--
-- R2 — v_imovel_resumo:
--   ANTES: focos_recorrentes conta TODOS os focos com foco_anterior_id IS NOT NULL
--          tentativas_sem_acesso conta TODAS as tentativas sem acesso (sem janela)
--   DEPOIS: focos_recorrentes → apenas últimos 180 dias
--           tentativas_sem_acesso → apenas últimos 90 dias (consistente com R1)
--
-- Impacto em score territorial e SLA: NENHUM
--   fn_calcular_score_imovel usa territorio_score (tabela separada),
--   não lê focos_recorrentes nem tentativas_sem_acesso da view diretamente.
--   SLA é vinculado a foco_risco_id, independente dessas colunas.
-- =============================================================================


-- =============================================================================
-- PARTE 1: fn_atualizar_perfil_imovel — janela 90 dias + reset automático
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_atualizar_perfil_imovel()
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
  -- Conta tentativas sem acesso nos últimos 90 dias (R1 — janela corrigida de 60→90 dias)
  SELECT COUNT(*)
    INTO v_sem_acesso
  FROM public.vistorias
  WHERE imovel_id        = NEW.imovel_id
    AND acesso_realizado = false
    AND deleted_at       IS NULL
    AND created_at       >= now() - interval '90 days';

  -- Lê estado atual do imóvel para detectar primeira ativação
  SELECT prioridade_drone, cliente_id
    INTO v_ja_drone, v_cliente_id
  FROM public.imoveis
  WHERE id = NEW.imovel_id;

  IF v_sem_acesso >= 3 THEN
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

  ELSE
    -- Janela de 90 dias sem atingir 3 tentativas consecutivas:
    -- reseta prioridade_drone se estava ativo.
    -- NOTA: historico_recusa permanece true — é registro histórico permanente
    --       e não deve ser apagado mesmo com a janela vazia.
    UPDATE public.imoveis
    SET prioridade_drone = false
    WHERE id             = NEW.imovel_id
      AND prioridade_drone = true; -- só escreve se estava true (evita write desnecessário)
  END IF;

  RETURN NEW;
END;
$$;

-- Recria trigger (DROP + CREATE para garantir evento correto)
DROP TRIGGER IF EXISTS trg_atualizar_perfil_imovel ON public.vistorias;
CREATE TRIGGER trg_atualizar_perfil_imovel
  AFTER INSERT OR UPDATE ON public.vistorias
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_atualizar_perfil_imovel();

COMMENT ON FUNCTION public.fn_atualizar_perfil_imovel() IS
  'R1 (20260916): janela 90 dias para tentativas sem acesso. '
  'Ativa prioridade_drone=true ao atingir 3 tentativas na janela; '
  'reseta para false se janela passa sem atingir o limiar (historico_recusa permanece). '
  'F-11: notifica gestor via job_queue apenas na primeira ativação.';


-- =============================================================================
-- PARTE 2: v_imovel_resumo — janelas temporais em focos_recorrentes e tentativas
-- =============================================================================
-- Usa DROP + CREATE porque a view tem security_invoker e colunas calculadas
-- que não são alteráveis via CREATE OR REPLACE sem recriar.

DROP VIEW IF EXISTS public.v_imovel_resumo;

CREATE VIEW public.v_imovel_resumo
WITH (security_invoker = true)
AS
SELECT
  im.id,
  im.cliente_id,
  im.regiao_id,
  im.bairro,
  im.quarteirao,
  im.logradouro,
  im.numero,
  im.complemento,
  im.tipo_imovel,
  im.latitude,
  im.longitude,
  im.ativo,
  im.historico_recusa,
  im.prioridade_drone,
  im.tem_calha,
  im.calha_acessivel,
  im.created_at,
  im.updated_at,

  -- Vistorias — total histórico
  COUNT(DISTINCT v.id)                                                        AS total_vistorias,
  MAX(v.data_visita)                                                          AS ultima_visita,

  -- Tentativas sem acesso nos últimos 90 dias (R1 — consistente com o trigger)
  COUNT(DISTINCT CASE
    WHEN v.acesso_realizado = false
     AND v.created_at >= now() - interval '90 days'
    THEN v.id
  END)                                                                        AS tentativas_sem_acesso,

  -- Focos — total histórico (sem filtro temporal — apenas para referência)
  COUNT(DISTINCT fr.id)                                                       AS total_focos_historico,

  -- Focos ativos (não resolvidos/descartados)
  COUNT(DISTINCT CASE
    WHEN fr.status NOT IN ('resolvido','descartado')
    THEN fr.id
  END)                                                                        AS focos_ativos,

  MAX(fr.created_at)                                                          AS ultimo_foco_em,

  -- SLA em aberto
  COUNT(DISTINCT CASE
    WHEN sla.status IN ('pendente','em_atendimento')
    THEN sla.id
  END)                                                                        AS slas_abertos,

  -- Reincidência nos últimos 180 dias (R2 — janela corrigida)
  -- Conta focos com foco_anterior_id IS NOT NULL criados nos últimos 180 dias
  COUNT(DISTINCT CASE
    WHEN fr.foco_anterior_id IS NOT NULL
     AND fr.created_at >= now() - interval '180 days'
    THEN fr.id
  END)                                                                        AS focos_recorrentes,

  -- Score territorial
  ts.score         AS score_territorial,
  ts.classificacao AS score_classificacao,
  ts.fatores       AS score_fatores,
  ts.calculado_em  AS score_calculado_em

FROM public.imoveis im
LEFT JOIN public.vistorias v
       ON v.imovel_id = im.id
      AND v.deleted_at IS NULL
LEFT JOIN public.focos_risco fr
       ON fr.imovel_id = im.id
      AND fr.deleted_at IS NULL
LEFT JOIN public.sla_operacional sla
       ON sla.foco_risco_id = fr.id
LEFT JOIN public.territorio_score ts
       ON ts.imovel_id  = im.id
      AND ts.cliente_id = im.cliente_id
WHERE im.deleted_at IS NULL
GROUP BY
  im.id, im.cliente_id, im.regiao_id, im.bairro, im.quarteirao,
  im.logradouro, im.numero, im.complemento, im.tipo_imovel,
  im.latitude, im.longitude, im.ativo, im.historico_recusa,
  im.prioridade_drone, im.tem_calha, im.calha_acessivel,
  im.created_at, im.updated_at,
  ts.score, ts.classificacao, ts.fatores, ts.calculado_em;

GRANT SELECT ON public.v_imovel_resumo TO authenticated;

COMMENT ON VIEW public.v_imovel_resumo IS
  'Resumo territorial do imóvel: vistorias, focos históricos, SLA ativo, recorrência e score territorial. '
  'R1 (20260916): tentativas_sem_acesso filtra últimos 90 dias (consistente com trigger). '
  'R2 (20260916): focos_recorrentes filtra últimos 180 dias (evita badge eterno). '
  'Base do módulo Imóvel 360°. security_invoker=true herda RLS do usuário.';
