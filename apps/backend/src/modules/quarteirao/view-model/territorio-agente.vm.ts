import type { TerritorioAgenteQuadra } from '../repositories/quarteirao-read.repository';

type CicloAtivoVM = {
  id: string;
  numero: number;
  status: string;
  dataInicio: string;
  dataFimPrevista: string;
} | null;

export class TerritorioAgenteViewModel {
  static toHttp(data: {
    agenteId: string;
    quadras: TerritorioAgenteQuadra[];
    cicloAtivo: CicloAtivoVM;
  }) {
    return {
      agenteId: data.agenteId,
      quadras: data.quadras.map(q => ({
        quadraId:     q.quadraId,
        codigo:       q.codigo,
        bairroId:     q.bairroId,
        bairroNome:   q.bairroNome,
        imoveisCount: q.imoveisCount,
      })),
      cicloAtivo: data.cicloAtivo,
    };
  }
}
