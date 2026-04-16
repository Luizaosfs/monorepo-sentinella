-- Adiciona origem_image_url à view v_focos_risco_ativos
-- Expõe image_url do levantamento_item de origem para exibição de miniatura na triagem.

CREATE OR REPLACE VIEW v_focos_risco_ativos
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
    WHEN sla.prazo_final IS NULL                                                       THEN 'sem_sla'
    WHEN sla.prazo_final < now()                                                       THEN 'vencido'
    WHEN sla.prazo_final < now() + (sla.prazo_final - sla.inicio) * 0.10              THEN 'critico'
    WHEN sla.prazo_final < now() + (sla.prazo_final - sla.inicio) * 0.30              THEN 'atencao'
    ELSE 'ok'
  END AS sla_status,
  li.image_url AS origem_image_url
FROM focos_risco fr
LEFT JOIN imoveis           i   ON i.id  = fr.imovel_id
LEFT JOIN regioes           r   ON r.id  = fr.regiao_id
LEFT JOIN usuarios          u   ON u.id  = fr.responsavel_id
LEFT JOIN sla_operacional   sla ON sla.foco_risco_id = fr.id
                                AND sla.status NOT IN ('concluido','vencido')
LEFT JOIN levantamento_itens li  ON li.id = fr.origem_levantamento_item_id
WHERE fr.status NOT IN ('resolvido','descartado');

COMMENT ON VIEW v_focos_risco_ativos IS
  'Focos em ciclo ativo (exclui resolvido e descartado). '
  'Inclui endereço do imóvel, nome da região, responsável, posição do SLA '
  'e image_url do item de origem (origem_image_url). '
  'security_invoker = true — RLS de focos_risco é aplicada automaticamente.';
