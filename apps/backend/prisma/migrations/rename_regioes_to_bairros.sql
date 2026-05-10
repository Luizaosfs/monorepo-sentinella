BEGIN;

-- 1. Renomeia tabela principal
ALTER TABLE regioes RENAME TO bairros;

-- 2. Renomeia coluna identificadora interna da tabela
ALTER TABLE bairros RENAME COLUMN regiao TO bairro;

-- 3. Renomeia regiao_id → bairro_id em todas as tabelas que possuem essa FK
ALTER TABLE imoveis                 RENAME COLUMN regiao_id TO bairro_id;
ALTER TABLE focos_risco             RENAME COLUMN regiao_id TO bairro_id;
ALTER TABLE casos_notificados       RENAME COLUMN regiao_id TO bairro_id;
ALTER TABLE planejamento            RENAME COLUMN regiao_id TO bairro_id;
ALTER TABLE operacoes               RENAME COLUMN regiao_id TO bairro_id;
ALTER TABLE pluvio_risco            RENAME COLUMN regiao_id TO bairro_id;
ALTER TABLE pluvio_operacional_item RENAME COLUMN regiao_id TO bairro_id;
ALTER TABLE distribuicao_quarteirao RENAME COLUMN regiao_id TO bairro_id;
ALTER TABLE quarteiroes             RENAME COLUMN regiao_id TO bairro_id;
ALTER TABLE sla_config_regiao       RENAME COLUMN regiao_id TO bairro_id;

COMMIT;
