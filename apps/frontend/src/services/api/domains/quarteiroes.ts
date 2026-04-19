import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, deepToSnake, type Ret } from '../shared/case-mappers';

export const quarteiroes = {
  listByCliente: async (clienteId: string) => {
    const raw = await http.get(`/quarteiroes${qs({ clienteId })}`);
    return deepToSnake(raw) as Ret<typeof _sb.quarteiroes.listByCliente>;
  },
};

export const distribuicaoQuarteirao = {
  listByCiclo: async (clienteId: string, ciclo: number) => {
    const raw = await http.get(`/quarteiroes/distribuicoes${qs({ clienteId, ciclo })}`);
    return deepToSnake(raw) as Ret<typeof _sb.distribuicaoQuarteirao.listByCiclo>;
  },
  listByAgente: (clienteId: string, agenteId: string, ciclo: number): Promise<string[]> =>
    http.get(`/quarteiroes/distribuicoes/por-agente${qs({ agenteId, ciclo })}`),
  upsert: (rows: { ciclo: number; quarteirao: string; agenteId: string; regiaoId?: string | null }[]): Promise<{ ok: boolean }> =>
    http.post('/quarteiroes/distribuicoes/upsert', { rows }),
  deletar: (ciclo: number, quarteiroes: string[]): Promise<{ deleted: number }> =>
    http.post('/quarteiroes/distribuicoes/deletar', { ciclo, quarteiroes }),
  copiarDoCiclo: async (clienteId: string, cicloOrigem: number, cicloDestino: number) => {
    const raw = await http.post('/quarteiroes/distribuicoes/copiar', deepToCamel({ clienteId, cicloOrigem, cicloDestino }));
    return ((raw as Record<string, unknown>).count as number) ?? 0;
  },
  coberturaByCliente: async (clienteId: string, ciclo: number) => {
    const raw = await http.get(`/quarteiroes/cobertura${qs({ clienteId, ciclo })}`);
    return deepToSnake(raw) as Ret<typeof _sb.distribuicaoQuarteirao.coberturaByCliente>;
  },
};
