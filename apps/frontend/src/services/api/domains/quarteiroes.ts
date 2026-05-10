import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, deepToSnake, type Ret } from '../shared/case-mappers';

export const quarteiroes = {
  listByCliente: async (clienteId: string) => {
    const raw = await http.get(`/quarteiroes${qs({ clienteId })}`);
    return deepToSnake(raw) as Ret<typeof _sb.quarteiroes.listByCliente>;
  },
  create: (payload: { codigo: string; bairroId?: string | null; bairro?: string | null; ativo?: boolean }): Promise<Record<string, unknown>> =>
    http.post('/quarteiroes', payload),
  remove: (id: string): Promise<void> =>
    http.delete(`/quarteiroes/${id}`),
  save: (
    id: string,
    payload: { codigo?: string; bairroId?: string | null; ativo?: boolean; geojson?: Record<string, unknown> | null },
  ): Promise<Record<string, unknown>> =>
    http.patch(`/quarteiroes/${id}`, payload),
  bulkInsert: (rows: { codigo: string; bairro?: string; bairroId?: string }[]): Promise<{ inserted: number; updated: number }> =>
    http.post('/quarteiroes/bulk-insert', { rows }),
  gerarLote: (payload: {
    bairroId: string;
    prefixo: string;
    numeroInicial: number;
    numeroFinal: number;
  }): Promise<{
    totalSolicitado: number;
    totalCriado: number;
    totalIgnorado: number;
    criados: string[];
    ignorados: Array<{ codigo: string; motivo: string }>;
  }> => http.post('/quarteiroes/gerar-lote', payload),
  desenharQuarteirao: (payload: {
    bairroId: string;
    codigo: string;
    geojson: Record<string, unknown>;
  }): Promise<Record<string, unknown>> =>
    http.post('/quarteiroes/desenhar', payload),
  atualizarGeometria: (
    id: string,
    geojson: Record<string, unknown> | null,
  ): Promise<Record<string, unknown>> =>
    http.put(`/quarteiroes/${id}/geometria`, { geojson }),
  importarGeoJSON: (payload: {
    features: Array<{ codigo: string; geojson: Record<string, unknown>; bairroId?: string; bairro?: string; areaM2?: number }>;
  }): Promise<{ ok: number; criados: string[]; erros: Array<{ codigo: string; motivo: string }> }> =>
    http.post('/quarteiroes/importar-geojson', payload),
  gerarQuadrasOSM: (payload: {
    bairroId: string;
    geojson: { type: 'Polygon'; coordinates: number[][][] };
    prefixo?: string;
    areaMinima?: number;
  }): Promise<{
    candidatos: Array<{ codigo: string; areaM2: number; geojson: { type: 'Polygon'; coordinates: number[][][] } }>;
    totalViasEncontradas: number;
  }> => http.post('/quarteiroes/gerar-quadras-osm', payload),
};

export const distribuicaoQuarteirao = {
  listByCiclo: async (clienteId: string, cicloId: string) => {
    const raw = await http.get(`/quarteiroes/distribuicoes${qs({ clienteId, cicloId })}`);
    return deepToSnake(raw) as Ret<typeof _sb.distribuicaoQuarteirao.listByCiclo>;
  },
  listByAgente: (clienteId: string, agenteId: string, cicloId: string): Promise<string[]> =>
    http.get(`/quarteiroes/distribuicoes/por-agente${qs({ agenteId, cicloId })}`),
  upsert: (rows: { cicloId: string; quadraId: string; agenteId: string; bairroId?: string | null }[]): Promise<{ ok: boolean }> =>
    http.post('/quarteiroes/distribuicoes/upsert', { rows }),
  deletar: (cicloId: string, quadraIds: string[]): Promise<{ deleted: number }> =>
    http.post('/quarteiroes/distribuicoes/deletar', { cicloId, quadraIds }),
  copiarDoCiclo: async (clienteId: string, cicloOrigemId: string, cicloDestinoId: string) => {
    const raw = await http.post('/quarteiroes/distribuicoes/copiar', deepToCamel({ clienteId, cicloOrigemId, cicloDestinoId }));
    return ((raw as Record<string, unknown>).count as number) ?? 0;
  },
  coberturaByCliente: async (clienteId: string, cicloId: string) => {
    const raw = await http.get(`/quarteiroes/cobertura${qs({ clienteId, cicloId })}`);
    return deepToSnake(raw) as Ret<typeof _sb.distribuicaoQuarteirao.coberturaByCliente>;
  },
};
