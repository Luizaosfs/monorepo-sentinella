import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, deepToSnake, type Ret } from '../shared/case-mappers';

export const quarteiroes = {
  listByCliente: async (clienteId: string) => {
    try {
      const raw = await http.get(`/quarteiroes${qs({ clienteId })}`);
      return deepToSnake(raw) as Ret<typeof _sb.quarteiroes.listByCliente>;
    } catch { return _sb.quarteiroes.listByCliente(clienteId); }
  },
};

export const distribuicaoQuarteirao = {
  listByCiclo: async (clienteId: string, ciclo: number) => {
    try {
      const raw = await http.get(`/quarteiroes/distribuicoes${qs({ clienteId, ciclo })}`);
      return deepToSnake(raw) as Ret<typeof _sb.distribuicaoQuarteirao.listByCiclo>;
    } catch { return _sb.distribuicaoQuarteirao.listByCiclo(clienteId, ciclo); }
  },
  /** @fallback backend retorna objetos completos, frontend espera string[]; usa Supabase. */
  listByAgente: _sb.distribuicaoQuarteirao.listByAgente.bind(_sb.distribuicaoQuarteirao),
  /** @fallback upsert batch — DTO backend não confirmado; usa Supabase. */
  upsert: _sb.distribuicaoQuarteirao.upsert.bind(_sb.distribuicaoQuarteirao),
  /** @fallback DELETE por array de quarteirao strings — backend usa DELETE/:id; usa Supabase. */
  deletar: _sb.distribuicaoQuarteirao.deletar.bind(_sb.distribuicaoQuarteirao),
  copiarDoCiclo: async (clienteId: string, cicloOrigem: number, cicloDestino: number) => {
    try {
      const raw = await http.post('/quarteiroes/distribuicoes/copiar', deepToCamel({ clienteId, cicloOrigem, cicloDestino }));
      return ((raw as Record<string, unknown>).count as number) ?? 0;
    } catch { return _sb.distribuicaoQuarteirao.copiarDoCiclo(clienteId, cicloOrigem, cicloDestino); }
  },
  coberturaByCliente: async (clienteId: string, ciclo: number) => {
    try {
      const raw = await http.get(`/quarteiroes/cobertura${qs({ clienteId, ciclo })}`);
      return deepToSnake(raw) as Ret<typeof _sb.distribuicaoQuarteirao.coberturaByCliente>;
    } catch { return _sb.distribuicaoQuarteirao.coberturaByCliente(clienteId, ciclo); }
  },
};
