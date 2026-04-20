-- Corrige trigger de sintomas -> caso notificado para cenários
-- onde casos_notificados exige unidade_saude_id NOT NULL.
-- Se não houver unidade de saúde ativa para o cliente, não bloqueia a vistoria.

CREATE OR REPLACE FUNCTION fn_sintomas_para_caso()
RETURNS TRIGGER AS $$
DECLARE
  v_imovel      imoveis%ROWTYPE;
  v_caso_id     uuid;
  v_unidade_id  uuid;
  v_agente_id   uuid;
BEGIN
  IF NEW.moradores_sintomas_qtd <= 0 THEN
    RETURN NEW;
  END IF;

  -- Integração opcional: só tenta gerar caso se a tabela existir
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'casos_notificados'
  ) THEN
    RETURN NEW;
  END IF;

  -- Dados de imóvel e agente a partir da vistoria
  SELECT im.*
    INTO v_imovel
  FROM imoveis im
  JOIN vistorias v ON v.imovel_id = im.id
  WHERE v.id = NEW.vistoria_id;

  SELECT v.agente_id
    INTO v_agente_id
  FROM vistorias v
  WHERE v.id = NEW.vistoria_id;

  -- Seleciona uma unidade ativa do cliente como fallback.
  -- Prioriza registros manuais para manter alinhamento com operação local.
  SELECT us.id
    INTO v_unidade_id
  FROM unidades_saude us
  WHERE us.cliente_id = NEW.cliente_id
    AND us.ativo = true
  ORDER BY
    CASE WHEN us.origem = 'manual' THEN 0 ELSE 1 END,
    us.created_at ASC
  LIMIT 1;

  -- Sem unidade de saúde, não gera caso (mas também não quebra a vistoria)
  IF v_unidade_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO casos_notificados (
      cliente_id,
      unidade_saude_id,
      notificador_id,
      doenca,
      status,
      data_notificacao,
      endereco_paciente,
      bairro,
      latitude,
      longitude,
      observacao
    )
    VALUES (
      NEW.cliente_id,
      v_unidade_id,
      v_agente_id,
      'suspeito',
      'suspeito',
      CURRENT_DATE,
      COALESCE(v_imovel.logradouro || CASE WHEN v_imovel.numero IS NOT NULL THEN ' ' || v_imovel.numero ELSE '' END, ''),
      v_imovel.bairro,
      v_imovel.latitude,
      v_imovel.longitude,
      'Gerado automaticamente por vistoria de campo'
    )
    RETURNING id INTO v_caso_id;

    UPDATE vistoria_sintomas
    SET gerou_caso_notificado_id = v_caso_id
    WHERE id = NEW.id;
  EXCEPTION
    WHEN OTHERS THEN
      -- Não bloquear fluxo de vistoria em caso de erro na integração de casos.
      RETURN NEW;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

