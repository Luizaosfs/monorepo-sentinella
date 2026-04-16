import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';

export interface EficaciaTratamento {
  cliente_id: string;
  tipo_deposito: 'A1' | 'A2' | 'B' | 'C' | 'D1' | 'D2' | 'E';
  usou_larvicida: boolean;
  total_casos: number;
  sem_recorrencia: number;
  taxa_eficacia_pct: number;
  larvicida_medio_g: number | null;
  taxa_eliminacao_pct: number | null;
}

export const LABEL_DEPOSITO: Record<string, string> = {
  A1: "A1 — Caixa d'água exposta",
  A2: 'A2 — Poço / cisterna',
  B:  'B — Depósito nível do solo',
  C:  'C — Depósito fixo',
  D1: 'D1 — Pneu',
  D2: 'D2 — Lixo / entulho',
  E:  'E — Natural (planta etc.)',
};

export const DEPOSITO_ORDEM: string[] = ['A1', 'A2', 'B', 'C', 'D1', 'D2', 'E'];

export function useEficaciaTratamento() {
  const { clienteId } = useClienteAtivo();
  return useQuery({
    queryKey: ['eficacia-tratamento', clienteId],
    queryFn: () => api.eficacia.listPorDeposito(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.LONG,
  });
}
