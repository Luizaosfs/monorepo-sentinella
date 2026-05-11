import { DistribuicaoTerritorialItem } from '../repositories/quarteirao-read.repository';

export class DistribuicaoTerritorialViewModel {
  static toHttp(item: DistribuicaoTerritorialItem) {
    return {
      quadraId: item.quadraId,
      codigo: item.codigo,
      bairroId: item.bairroId,
      bairroNome: item.bairroNome,
      agenteId: item.agenteId,
      agenteNome: item.agenteNome,
      cicloIdOrigem: item.cicloIdOrigem,
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}
