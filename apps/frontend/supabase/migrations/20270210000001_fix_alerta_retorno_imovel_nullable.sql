-- Corrige trigger trg_criar_alerta_retorno para não disparar quando imovel_id é NULL
-- (vistorias vinculadas a focos sem imóvel cadastrado, após 20270210000000)
DROP TRIGGER IF EXISTS trg_criar_alerta_retorno ON vistorias;
CREATE TRIGGER trg_criar_alerta_retorno
  AFTER INSERT ON vistorias
  FOR EACH ROW
  WHEN (NEW.acesso_realizado = false AND NEW.imovel_id IS NOT NULL)
  EXECUTE FUNCTION fn_criar_alerta_retorno();
