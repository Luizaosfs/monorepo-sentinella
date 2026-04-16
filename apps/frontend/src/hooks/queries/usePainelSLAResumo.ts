import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';

export interface PainelSLAResumoData {
  suspeitas: number;
  confirmados: number;
  em_tratamento: number;
  sla_vencidos: number;
}

export function usePainelSLAResumo() {
  const { clienteId } = useClienteAtivo();

  return useQuery({
    queryKey: ['painel_sla_resumo', clienteId],
    queryFn: async (): Promise<PainelSLAResumoData> => {
      const { data: focos } = await api.focosRisco.list(clienteId!, {
        status: ['suspeita', 'em_triagem', 'aguarda_inspecao', 'em_inspecao', 'confirmado', 'em_tratamento'],
        pageSize: 1000,
      });

      let suspeitas = 0;
      let confirmados = 0;
      let em_tratamento = 0;
      let sla_vencidos = 0;

      for (const f of focos) {
        if (f.status === 'suspeita') suspeitas++;
        if (f.status === 'confirmado') confirmados++;
        if (f.status === 'em_tratamento') em_tratamento++;
        if (f.sla_status === 'vencido') sla_vencidos++;
      }

      return { suspeitas, confirmados, em_tratamento, sla_vencidos };
    },
    enabled: !!clienteId,
    staleTime: STALE.SHORT,
    refetchInterval: 60_000,
  });
}
