-- Remove assinatura legada da RPC pública para evitar ambiguidade no PostgREST.
-- Mantemos apenas a versão com 6 parâmetros (inclui p_foto_url).

DROP FUNCTION IF EXISTS denunciar_cidadao(
  text,
  uuid,
  text,
  double precision,
  double precision
);
