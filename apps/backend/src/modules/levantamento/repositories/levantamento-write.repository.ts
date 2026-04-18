import { Injectable } from '@nestjs/common';

import { Levantamento, LevantamentoItem } from '../entities/levantamento';

export interface CriarLevantamentoManualParams {
  clienteId: string;
  usuarioId: string;
  planejamentoId: string;
  tipoEntrada: string;
  dataVoo: Date;
}

export interface CriarItemManualParams {
  levantamentoId: string;
  clienteId: string;
  latitude?: number;
  longitude?: number;
  item?: string;
  risco?: string;
  acao?: string;
  scoreFinal?: number;
  prioridade?: string;
  slaHoras?: number;
  enderecoCurto?: string;
  enderecoCompleto?: string;
  imageUrl?: string;
  maps?: string;
  waze?: string;
  dataHora?: Date;
  peso?: number;
  payload?: Record<string, unknown>;
  imagePublicId?: string;
}

export interface ItemManualResult {
  id: string;
  levantamentoId: string;
  clienteId?: string;
  latitude?: number;
  longitude?: number;
  item?: string;
  risco?: string;
  acao?: string;
  scoreFinal?: number;
  prioridade?: string;
  slaHoras?: number;
  enderecoCurto?: string;
  enderecoCompleto?: string;
  imageUrl?: string;
  maps?: string;
  waze?: string;
  dataHora?: Date;
  peso?: number;
  payload?: Record<string, unknown>;
  imagePublicId?: string;
  createdAt: Date;
}

@Injectable()
export abstract class LevantamentoWriteRepository {
  abstract create(levantamento: Levantamento): Promise<Levantamento>;
  abstract save(levantamento: Levantamento): Promise<void>;
  abstract createItem(item: LevantamentoItem): Promise<LevantamentoItem>;
  abstract createLevantamentoManual(
    params: CriarLevantamentoManualParams,
  ): Promise<{ id: string }>;
  abstract criarItemManual(
    params: CriarItemManualParams,
  ): Promise<ItemManualResult>;
  abstract incrementTotalItens(levantamentoId: string): Promise<void>;
  abstract criarItemTags(itemId: string, tags: string[]): Promise<void>;
  abstract delete(id: string): Promise<void>;
  abstract updateItem(id: string, data: Partial<{
    item: string; risco: string; acao: string; prioridade: string;
    slaHoras: number; enderecoCurto: string; enderecoCompleto: string;
    latitude: number; longitude: number; maps: string; waze: string;
    imageUrl: string; imagePublicId: string; scoreFinal: number; peso: number;
  }>): Promise<void>;
  abstract deleteItem(id: string): Promise<void>;
  abstract addItemEvidencia(itemId: string, data: { url: string; publicId?: string; tipo?: string }): Promise<import('../entities/levantamento').LevantamentoItemEvidencia>;
}
