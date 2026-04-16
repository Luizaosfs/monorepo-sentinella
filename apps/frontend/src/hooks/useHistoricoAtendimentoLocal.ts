import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';

const TOLERANCE = 0.0001;

export interface HistoricoAtendimentoRow {
  levantamento_item_id: string;
  levantamento_id: string;
  latitude: number;
  longitude: number;
  item: string | null;
  risco: string | null;
  prioridade: string | null;
  acao: string | null;
  endereco_curto: string | null;
  endereco_completo: string | null;
  item_data_hora: string | null;
  item_created_at: string;
  cliente_id: string;
  levantamento_tipo_entrada: string | null;
  operacao_id: string | null;
  operacao_status: string | null;
  operacao_iniciado_em: string | null;
  operacao_concluido_em: string | null;
  operacao_observacao: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  responsavel_email: string | null;
}

export function useHistoricoAtendimentoLocal(
  clienteId: string | null,
  latitude: number | null,
  longitude: number | null
) {
  const [data, setData] = useState<HistoricoAtendimentoRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistorico = useCallback(async () => {
    if (!clienteId || latitude == null || longitude == null) {
      setData([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await api.historicoAtendimento.listByClienteELocalizacao(
        clienteId, latitude, longitude, TOLERANCE,
      );
      setData((rows as HistoricoAtendimentoRow[]) || []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [clienteId, latitude, longitude]);

  useEffect(() => {
    fetchHistorico();
  }, [fetchHistorico]);

  return { historico: data, loading, refetch: fetchHistorico };
}
