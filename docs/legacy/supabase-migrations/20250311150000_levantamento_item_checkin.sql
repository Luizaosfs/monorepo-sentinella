-- =============================================================================
-- Levantamento Item — Checkpoint de Chegada ao Local
-- Adiciona rastreabilidade do momento em que o operador chegou ao local,
-- separando "assumiu o item" de "chegou fisicamente ao endereço".
-- =============================================================================

ALTER TABLE public.levantamento_itens
  ADD COLUMN IF NOT EXISTS checkin_em         timestamptz,
  ADD COLUMN IF NOT EXISTS checkin_latitude   double precision,
  ADD COLUMN IF NOT EXISTS checkin_longitude  double precision;

COMMENT ON COLUMN public.levantamento_itens.checkin_em IS
  'Timestamp de quando o operador registrou chegada ao local. '
  'NULL = operador ainda não chegou ou não registrou. '
  'Preenche automaticamente ao chamar api.itens.registrarCheckin().';

COMMENT ON COLUMN public.levantamento_itens.checkin_latitude IS
  'Latitude do GPS no momento do check-in. Pode diferir de latitude (posição do foco).';

COMMENT ON COLUMN public.levantamento_itens.checkin_longitude IS
  'Longitude do GPS no momento do check-in. Pode diferir de longitude (posição do foco).';

-- Índice para consultas por operador em campo (quais itens tiveram checkin hoje)
CREATE INDEX IF NOT EXISTS lev_itens_checkin_em_idx
  ON public.levantamento_itens (checkin_em)
  WHERE checkin_em IS NOT NULL;

-- Registra o checkin no histórico de status via trigger existente
-- (o trigger dispara apenas em mudanças de status_atendimento, não checkin —
-- o checkin é um campo independente, não muda o status)
