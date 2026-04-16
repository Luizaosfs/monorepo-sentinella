-- =============================================================================
-- VIEW — Histórico de atendimento por local (coordenada)
-- Une levantamento_itens, operacoes e usuarios para consultar todas as
-- ocorrências de uma mesma coordenada (latitude/longitude) ao longo do tempo.
-- Acesso sujeito ao RLS das tabelas base (levantamento_itens, operacoes, etc.).
-- =============================================================================

-- security_invoker = true: RLS das tabelas base é avaliado para o usuário que consulta a view
CREATE OR REPLACE VIEW public.v_historico_atendimento_local
  WITH (security_invoker = true)
AS
SELECT
  li.id AS levantamento_item_id,
  li.levantamento_id,
  li.latitude,
  li.longitude,
  li.item,
  li.risco,
  li.prioridade,
  li.acao,
  li.endereco_curto,
  li.endereco_completo,
  li.data_hora AS item_data_hora,
  li.created_at AS item_created_at,
  l.cliente_id,
  l.tipo_entrada AS levantamento_tipo_entrada,
  o.id AS operacao_id,
  o.status AS operacao_status,
  o.iniciado_em AS operacao_iniciado_em,
  o.concluido_em AS operacao_concluido_em,
  o.observacao AS operacao_observacao,
  resp.id AS responsavel_id,
  resp.nome AS responsavel_nome,
  resp.email AS responsavel_email
FROM public.levantamento_itens li
JOIN public.levantamentos l ON l.id = li.levantamento_id
LEFT JOIN public.operacoes o ON o.item_levantamento_id = li.id
LEFT JOIN public.usuarios resp ON resp.id = o.responsavel_id
WHERE li.latitude IS NOT NULL
  AND li.longitude IS NOT NULL;

COMMENT ON VIEW public.v_historico_atendimento_local IS
  'Histórico por coordenada: itens de levantamento (drone/manual) com operações de atendimento e responsável. Consultar por latitude/longitude para ver ocorrências no mesmo local ao longo do tempo.';

-- Permissão para autenticados (RLS das tabelas base aplica-se ao consultar a view)
GRANT SELECT ON public.v_historico_atendimento_local TO authenticated;
