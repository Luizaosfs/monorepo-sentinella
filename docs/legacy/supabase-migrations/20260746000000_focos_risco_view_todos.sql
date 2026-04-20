-- Cria v_focos_risco_todos: mesma estrutura de v_focos_risco_ativos mas inclui
-- estados terminais (resolvido, descartado) para uso em filtros de histórico.
-- v_focos_risco_ativos permanece inalterada (exclui terminais — usada na triagem).

CREATE OR REPLACE VIEW v_focos_risco_todos
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
    WHEN sla.prazo_final IS NULL                                                  THEN 'sem_sla'
    WHEN sla.prazo_final < now()                                                  THEN 'vencido'
    WHEN sla.prazo_final < now() + (sla.prazo_final - sla.inicio) * 0.10         THEN 'critico'
    WHEN sla.prazo_final < now() + (sla.prazo_final - sla.inicio) * 0.30         THEN 'atencao'
    ELSE 'ok'
  END AS sla_status,
  li.image_url AS origem_image_url,
  li.item      AS origem_item
FROM focos_risco fr
LEFT JOIN imoveis           i   ON i.id  = fr.imovel_id
LEFT JOIN regioes           r   ON r.id  = fr.regiao_id
LEFT JOIN usuarios          u   ON u.id  = fr.responsavel_id
LEFT JOIN sla_operacional   sla ON sla.foco_risco_id = fr.id
                                AND sla.status NOT IN ('concluido','vencido')
LEFT JOIN levantamento_itens li  ON li.id = fr.origem_levantamento_item_id
WHERE fr.deleted_at IS NULL;

COMMENT ON VIEW v_focos_risco_todos IS
  'Todos os focos (inclui resolvido e descartado). Mesmos JOINs de v_focos_risco_ativos. '
  'Usar apenas quando filtros explícitos de status terminal são necessários (histórico, relatórios). '
  'security_invoker = true — RLS de focos_risco é aplicada automaticamente.';
