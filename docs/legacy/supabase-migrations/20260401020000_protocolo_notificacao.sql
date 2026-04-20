-- Sequencial de protocolos por cliente/mês para evitar colisão.
CREATE TABLE IF NOT EXISTS notificacao_protocolo_seq (
  cliente_id  uuid        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  ano_mes     char(6)     NOT NULL,
  ultimo_seq  integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (cliente_id, ano_mes)
);

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS codigo_ibge text;

CREATE OR REPLACE FUNCTION public.proximo_protocolo_notificacao(p_cliente_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano_mes  char(6)  := to_char(now(), 'YYYYMM');
  v_seq      integer;
  v_ibge     text;
BEGIN
  INSERT INTO notificacao_protocolo_seq (cliente_id, ano_mes, ultimo_seq)
  VALUES (p_cliente_id, v_ano_mes, 1)
  ON CONFLICT (cliente_id, ano_mes)
  DO UPDATE SET ultimo_seq = notificacao_protocolo_seq.ultimo_seq + 1
  RETURNING ultimo_seq INTO v_seq;

  SELECT codigo_ibge INTO v_ibge
  FROM clientes WHERE id = p_cliente_id;

  RETURN 'NOT-' || v_ano_mes || '-' || COALESCE(v_ibge, '000000') || '-' || lpad(v_seq::text, 4, '0');
END;
$$;
