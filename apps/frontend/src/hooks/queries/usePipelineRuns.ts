import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';

export interface PipelineRun {
  id: string;
  cliente_id: string;
  voo_id: string | null;
  levantamento_id: string | null;
  status: 'em_andamento' | 'concluido' | 'erro' | 'parcial';
  total_imagens: number | null;
  imagens_processadas: number | null;
  itens_gerados: number | null;
  focos_criados: number | null;
  erro_mensagem: string | null;
  erro_detalhe: Record<string, unknown> | null;
  versao_pipeline: string | null;
  iniciado_em: string;
  concluido_em: string | null;
  duracao_s: number | null;
  created_at: string;
  levantamento?: { titulo: string; data_voo: string | null; total_itens: number | null } | null;
}

export function usePipelineRuns(limit = 20) {
  const { clienteId } = useClienteAtivo();
  return useQuery({
    queryKey: ['pipeline-runs', clienteId, limit],
    queryFn: () => api.pipeline.listRuns(clienteId!, limit),
    enabled: !!clienteId,
    staleTime: STALE.SHORT,
    refetchInterval: 30_000,
  });
}

export function usePipelineRunAtivo() {
  const { clienteId } = useClienteAtivo();
  return useQuery({
    queryKey: ['pipeline-run-ativo', clienteId],
    queryFn: () => api.pipeline.getRunAtivo(clienteId!),
    enabled: !!clienteId,
    staleTime: 10_000,
    refetchInterval: 10_000,
  });
}
