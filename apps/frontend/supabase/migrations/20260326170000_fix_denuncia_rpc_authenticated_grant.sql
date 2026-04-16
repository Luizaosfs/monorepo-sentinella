-- Permite uso das RPCs públicas do canal cidadão também para sessões autenticadas.
-- Cenário: usuário logado abre rota pública /denuncia no mesmo navegador.
-- Sem esse GRANT, a chamada rpc('denunciar_cidadao') falha por permissão.
-- O bloco abaixo é resiliente para bancos com assinatura antiga (5 args)
-- e para bancos com assinatura atual (6 args com foto).

DO $$
BEGIN
  -- assinatura nova (com p_foto_url)
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'denunciar_cidadao'
      AND oid::regprocedure::text LIKE 'denunciar_cidadao(text,uuid,text,double precision,double precision,text)%'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION denunciar_cidadao(text, uuid, text, double precision, double precision, text) TO anon, authenticated';
  END IF;

  -- assinatura legada (sem p_foto_url)
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'denunciar_cidadao'
      AND oid::regprocedure::text LIKE 'denunciar_cidadao(text,uuid,text,double precision,double precision)%'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION denunciar_cidadao(text, uuid, text, double precision, double precision) TO anon, authenticated';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'consultar_denuncia_cidadao'
      AND oid::regprocedure::text LIKE 'consultar_denuncia_cidadao(text)%'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION consultar_denuncia_cidadao(text) TO anon, authenticated';
  END IF;
END $$;
