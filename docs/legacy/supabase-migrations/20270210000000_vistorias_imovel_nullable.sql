-- migration: 20270202000000_vistorias_imovel_nullable
-- Permite vistorias sem imóvel vinculado (focos de risco sem imovel_id — ex: denúncia/drone sem match)
-- O FK continua (null é sempre válido em FK nullable). Triggers com WHEN (imovel_id IS NOT NULL) já são null-safe.

ALTER TABLE vistorias ALTER COLUMN imovel_id DROP NOT NULL;
