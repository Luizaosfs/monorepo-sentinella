import { Injectable } from '@nestjs/common';

import { FilterDistribuicaoInput } from '../dtos/filter-distribuicao.input';
import { FilterQuarteiraoInput } from '../dtos/filter-quarteirao.input';
import { DistribuicaoQuarteirao, Quarteirao } from '../entities/quarteirao';

export type CoberturaQuarteiraoItem = {
  quadra_id: string;
  quarteirao: string;
  total_imoveis: number;
  visitados: number;
  pct_cobertura: number;
};

export type CoberturaCicloResult = CoberturaQuarteiraoItem[];

export type DistribuicaoTerritorialItem = {
  quadraId: string;
  codigo: string;
  bairroId: string | null;
  bairroNome: string | null;
  agenteId: string;
  agenteNome: string;
  cicloIdOrigem: string | null;
  updatedAt: Date;
};

export type TerritorioAgenteQuadra = {
  quadraId: string;
  codigo: string;
  bairroId: string | null;
  bairroNome: string | null;
  imoveisCount: number;
};

@Injectable()
export abstract class QuarteiraoReadRepository {
  abstract findQuarteiraoById(id: string): Promise<Quarteirao | null>;
  abstract findAllQuarteiroes(
    filters: FilterQuarteiraoInput,
  ): Promise<Quarteirao[]>;

  abstract findAllDistribuicoes(
    filters: FilterDistribuicaoInput,
  ): Promise<DistribuicaoQuarteirao[]>;
  abstract findDistribuicaoById(
    id: string,
  ): Promise<DistribuicaoQuarteirao | null>;

  abstract coberturaQuarteiraoCiclo(input: {
    clienteId: string;
    cicloId: string;
  }): Promise<CoberturaCicloResult>;

  abstract findDistribuicaoTerritorialAtual(
    clienteId: string,
    agenteId?: string,
    bairroId?: string,
  ): Promise<DistribuicaoTerritorialItem[]>;

  abstract findTerritorioAgente(
    clienteId: string,
    agenteId: string,
  ): Promise<TerritorioAgenteQuadra[]>;
}
