import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';

export interface LiraaQuarteirao {
  cliente_id: string;
  ciclo: number;
  bairro: string | null;
  quarteirao: string | null;
  imoveis_inspecionados: number;
  imoveis_positivos: number;
  iip: number;
  ibp: number;
  total_focos: number;
  focos_a1: number;
  focos_a2: number;
  focos_b: number;
  focos_c: number;
  focos_d1: number;
  focos_d2: number;
  focos_e: number;
  larvicida_total_g: number;
}

export type ClassificacaoIIP = 'satisfatorio' | 'alerta' | 'risco';

export function classificarIIP(iip: number): ClassificacaoIIP {
  if (iip < 1.0) return 'satisfatorio';
  if (iip < 4.0) return 'alerta';
  return 'risco';
}

export const COR_IIP: Record<ClassificacaoIIP, string> = {
  satisfatorio: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30',
  alerta: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30',
  risco: 'text-red-600 bg-red-50 dark:bg-red-950/30',
};

export const LABEL_IIP: Record<ClassificacaoIIP, string> = {
  satisfatorio: 'Satisfatório',
  alerta: 'Alerta',
  risco: 'Risco',
};

export function useLiraa(ciclo?: number) {
  const { clienteId } = useClienteAtivo();
  return useQuery({
    queryKey: ['liraa', clienteId, ciclo ?? null],
    queryFn: () => api.liraa.listPorQuarteirao(clienteId!, ciclo),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });
}

export function useLiraaCiclos() {
  const { clienteId } = useClienteAtivo();
  return useQuery({
    queryKey: ['liraa-ciclos', clienteId],
    queryFn: () => api.liraa.listCiclosDisponiveis(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.LONG,
  });
}
