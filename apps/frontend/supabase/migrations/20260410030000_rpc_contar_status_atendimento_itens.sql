-- Contagens globais de status de atendimento por cliente (sem limite de 1000 linhas do PostgREST).
CREATE OR REPLACE FUNCTION public.contar_status_atendimento_levantamento_itens(p_cliente_id uuid)
RETURNS TABLE(
  total bigint,
  pendente bigint,
  em_atendimento bigint,
  resolvido bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::bigint AS total,
    COUNT(*) FILTER (WHERE COALESCE(li.status_atendimento, 'pendente') = 'pendente')::bigint AS pendente,
    COUNT(*) FILTER (WHERE li.status_atendimento = 'em_atendimento')::bigint AS em_atendimento,
    COUNT(*) FILTER (WHERE li.status_atendimento = 'resolvido')::bigint AS resolvido
  FROM public.levantamento_itens li
  INNER JOIN public.levantamentos lv ON lv.id = li.levantamento_id
  WHERE lv.cliente_id = p_cliente_id;
$$;

COMMENT ON FUNCTION public.contar_status_atendimento_levantamento_itens(uuid) IS
  'Agrega status_atendimento de todos os levantamento_itens do cliente (evita truncagem do limite padrão do PostgREST).';

GRANT EXECUTE ON FUNCTION public.contar_status_atendimento_levantamento_itens(uuid) TO authenticated;
