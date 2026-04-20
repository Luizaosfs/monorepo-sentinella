-- Migration: fix Security Definer Views apontadas pelo Supabase Security Advisor
-- Problema: views criadas sem security_invoker=on rodam com permissões do CRIADOR
--           (security definer), ignorando RLS do usuário que consulta.
-- Solução:  security_invoker=on faz a view rodar com as permissões do CALLER,
--           respeitando RLS corretamente.
-- Obs:      spatial_ref_sys é tabela do PostGIS — NÃO habilitar RLS nela.

ALTER VIEW public.v_cliente_uso_mensal      SET (security_invoker = on);
ALTER VIEW public.v_slas_iminentes          SET (security_invoker = on);
ALTER VIEW public.v_recorrencias_ativas     SET (security_invoker = on);
ALTER VIEW public.v_imovel_historico_acesso SET (security_invoker = on);

-- Estas duas foram criadas diretamente no dashboard (não via migration):
ALTER VIEW public.pluvio_operacional_latest SET (security_invoker = on);
ALTER VIEW public.view_rls_rules            SET (security_invoker = on);
