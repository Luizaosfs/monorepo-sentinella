-- Corrige origem_image_url em v_focos_risco_ativos:
-- COALESCE(li.image_url, payload->>'foto_url') para cobrir focos de cidadão
-- (que não têm origem_levantamento_item_id mas têm payload.foto_url).

DROP VIEW IF EXISTS v_focos_risco_ativos CASCADE;

CREATE VIEW v_focos_risco_ativos
WITH (security_invoker = true)
AS
SELECT
  fr.*,
  i.logradouro,
  i.numero,
  i.bairro,
  i.quarteirao,
  i.tipo_imovel,
  r.regiao    AS regiao_nome,
  u.nome      AS responsavel_nome,
  sla.prazo_final AS sla_prazo_em,
  sla.violado     AS sla_violado,
  CASE
    WHEN sla.prazo_final IS NULL                                                THEN 'sem_sla'
    WHEN sla.prazo_final < now()                                                THEN 'vencido'
    WHEN sla.prazo_final < now() + (sla.prazo_final - sla.inicio) * 0.10       THEN 'critico'
    WHEN sla.prazo_final < now() + (sla.prazo_final - sla.inicio) * 0.30       THEN 'atencao'
    ELSE 'ok'
  END AS sla_status,
  COALESCE(li.image_url, fr.payload->>'foto_url') AS origem_image_url,
  li.item      AS origem_item,
  -- Dados mínimos inline
  (
    (fr.endereco_normalizado IS NOT NULL
     OR (fr.latitude IS NOT NULL AND fr.longitude IS NOT NULL)
     OR fr.imovel_id IS NOT NULL)
    AND (fr.imovel_id IS NOT NULL OR fr.regiao_id IS NOT NULL)
    AND (fr.classificacao_inicial IS NOT NULL)
    AND (fr.observacao IS NOT NULL AND length(trim(fr.observacao)) > 0)
    AND (
      fr.origem_levantamento_item_id IS NOT NULL
      OR fr.origem_vistoria_id IS NOT NULL
      OR array_length(fr.casos_ids, 1) > 0
      OR EXISTS (SELECT 1 FROM operacoes o WHERE o.foco_risco_id = fr.id)
    )
  )                                                                          AS tem_dados_minimos,
  ARRAY_REMOVE(ARRAY[
    CASE WHEN NOT (
      fr.endereco_normalizado IS NOT NULL
      OR (fr.latitude IS NOT NULL AND fr.longitude IS NOT NULL)
      OR fr.imovel_id IS NOT NULL
    ) THEN 'sem_localizacao' END,
    CASE WHEN NOT (fr.imovel_id IS NOT NULL OR fr.regiao_id IS NOT NULL)
      THEN 'sem_bairro' END,
    CASE WHEN NOT (fr.observacao IS NOT NULL AND length(trim(fr.observacao)) > 0)
      THEN 'sem_descricao' END,
    CASE WHEN NOT (
      fr.origem_levantamento_item_id IS NOT NULL
      OR fr.origem_vistoria_id IS NOT NULL
      OR array_length(fr.casos_ids, 1) > 0
      OR EXISTS (SELECT 1 FROM operacoes o WHERE o.foco_risco_id = fr.id)
    ) THEN 'sem_evidencia' END
  ], NULL)                                                                   AS pendencias
FROM focos_risco fr
LEFT JOIN imoveis           i   ON i.id  = fr.imovel_id
LEFT JOIN regioes           r   ON r.id  = fr.regiao_id
LEFT JOIN usuarios          u   ON u.id  = fr.responsavel_id
LEFT JOIN sla_operacional   sla ON sla.foco_risco_id = fr.id
                                AND sla.status NOT IN ('concluido','vencido')
LEFT JOIN levantamento_itens li  ON li.id = fr.origem_levantamento_item_id
WHERE fr.status     NOT IN ('resolvido','descartado')
  AND fr.deleted_at IS NULL;

COMMENT ON VIEW v_focos_risco_ativos IS
  'Focos em ciclo ativo + dados mínimos. '
  'origem_image_url = COALESCE(levantamento_itens.image_url, payload.foto_url) — cobre drone e cidadão. '
  'security_invoker = true — RLS de focos_risco aplicada automaticamente.';
