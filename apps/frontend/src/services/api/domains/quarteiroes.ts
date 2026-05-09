import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, deepToSnake, type Ret } from '../shared/case-mappers';

export const quarteiroes = {
  listByCliente: async (clienteId: string) => {
    const raw = await http.get(`/quarteiroes${qs({ clienteId })}`);
    return deepToSnake(raw) as Ret<typeof _sb.quarteiroes.listByCliente>;
  },
  create: (payload: { codigo: string; regiaoId?: string | null; bairro?: string | null; ativo?: boolean }): Promise<Record<string, unknown>> =>
    http.post('/quarteiroes', payload),
  remove: (id: string): Promise<void> =>
    http.delete(`/quarteiroes/${id}`),
  save: (
    id: string,
    payload: { codigo?: string; regiaoId?: string | null; ativo?: boolean; geojson?: Record<string, unknown> | null },
  ): Promise<Record<string, unknown>> =>
    http.patch(`/quarteiroes/${id}`, payload),
  bulkInsert: (rows: { codigo: string; bairro?: string; regiaoId?: string }[]): Promise<{ inserted: number; updated: number }> =>
    http.post('/quarteiroes/bulk-insert', { rows }),
  gerarLote: (payload: {
    regiaoId: string;
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
    regiaoId: string;
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
    features: Array<{ codigo: string; geojson: Record<string, unknown>; regiaoId?: string; bairro?: string; areaM2?: number }>;
  }): Promise<{ ok: number; criados: string[]; erros: Array<{ codigo: string; motivo: string }> }> =>
    http.post('/quarteiroes/importar-geojson', payload),
  gerarQuadrasOSM: (payload: {
    regiaoId: string;
    geojson: { type: 'Polygon'; coordinates: number[][][] };
    prefixo?: string;
    areaMinima?: number;
  }): Promise<{
    candidatos: Array<{ codigo: string; areaM2: number; geojson: { type: 'Polygon'; coordinates: number[][][] } }>;
    totalViasEncontradas: number;
  }> => http.post('/quarteiroes/gerar-quadras-osm', payload),
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
