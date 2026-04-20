-- =============================================================================
-- FIX: Recriar canal_cidadao_rate_limit com schema correto
--
-- Problema: tabela no banco tem schema de 20260410 (latitude/longitude/total)
-- mas a função denunciar_cidadao (20260928) usa ip_hash/janela_hora/contagem.
-- A tabela é puramente transiente (rate limiting), seguro dropar e recriar.
-- =============================================================================

DROP TABLE IF EXISTS public.canal_cidadao_rate_limit CASCADE;

CREATE TABLE public.canal_cidadao_rate_limit (
  ip_hash     text        NOT NULL,
  cliente_id  uuid        NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  janela_hora timestamptz NOT NULL DEFAULT date_trunc('hour', now()),
  contagem    integer     NOT NULL DEFAULT 1,
  CONSTRAINT canal_cidadao_rate_limit_pkey PRIMARY KEY (ip_hash, cliente_id, janela_hora)
);

CREATE INDEX idx_canal_rate_limit_cliente ON public.canal_cidadao_rate_limit (cliente_id);

ALTER TABLE public.canal_cidadao_rate_limit ENABLE ROW LEVEL SECURITY;

-- Apenas SECURITY DEFINER pode acessar (função denunciar_cidadao)
CREATE POLICY "rate_limit_deny_all" ON public.canal_cidadao_rate_limit
  FOR ALL TO authenticated, anon USING (false);
