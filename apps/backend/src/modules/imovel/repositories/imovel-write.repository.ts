import { Injectable } from '@nestjs/common';

import { Imovel } from '../entities/imovel';

export interface UpsertScoreData {
  clienteId: string;
  imovelId: string;
  score: number;
  classificacao: string;
  fatores: Record<string, unknown>;
}

@Injectable()
export abstract class ImovelWriteRepository {
  abstract create(imovel: Imovel): Promise<Imovel>;
  abstract save(imovel: Imovel): Promise<void>;
  abstract softDelete(id: string, deletedBy: string, clienteId: string): Promise<void>;
  abstract upsertScore(data: UpsertScoreData): Promise<void>;
  abstract seedScoreConfigIfMissing(clienteId: string): Promise<void>;
}
