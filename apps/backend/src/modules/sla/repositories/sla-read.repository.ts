import { Injectable } from '@nestjs/common';
import { PaginationProps } from '@shared/dtos/pagination-body';
import type { JsonObject } from '@shared/types/json';

import { FilterSlaInput } from '../dtos/filter-sla.input';
import { SlaConfig, SlaFeriado, SlaFocoConfig } from '../entities/sla-config';
import {
  SlaOperacional,
  SlaOperacionalPaginated,
} from '../entities/sla-operacional';

@Injectable()
export abstract class SlaReadRepository {
  abstract findById(id: string, clienteId: string | null): Promise<SlaOperacional | null>;
  abstract findAll(filters: FilterSlaInput): Promise<SlaOperacional[]>;
  abstract findPaginated(
    filters: FilterSlaInput,
    pagination: PaginationProps,
  ): Promise<SlaOperacionalPaginated>;
  abstract findPainel(
    clienteId: string,
    agenteId?: string,
  ): Promise<SlaOperacional[]>;
  abstract countPendentes(clienteId: string): Promise<{ total: number }>;
  abstract findConfig(clienteId: string): Promise<SlaConfig | null>;
  abstract findConfigByRegiao(
    clienteId: string,
    regiaoId: string,
  ): Promise<SlaConfig | null>;
  abstract findByFocoRiscoId(
    focoRiscoId: string,
    tx?: unknown,
  ): Promise<SlaOperacional | null>;
  abstract findConfigRegioes(
    clienteId: string,
  ): Promise<Array<{ id: string; regiaoId: string; config: JsonObject }>>;
  abstract findFeriados(clienteId: string): Promise<SlaFeriado[]>;
  abstract findFeriadoById(id: string): Promise<{ id: string; clienteId: string } | null>;
  abstract findFocoConfig(clienteId: string): Promise<SlaFocoConfig[]>;
  abstract findErrosCriacao(
    clienteId: string,
    limit: number,
  ): Promise<
    Array<{ id: string; erro: string; criado_em: Date; contexto: unknown }>
  >;
  abstract findIminentes(clienteId: string): Promise<SlaIminente[]>;
  abstract findIminentesGlobal(pctLimiar?: number): Promise<SlaIminenteGlobal[]>;
}

export interface SlaIminenteGlobal {
  id: string;
  clienteId: string | null;
  prioridade: string;
  prazoFinal: Date;
}

export interface SlaIminente {
  id: string;
  clienteId: string;
  itemId: string | null;
  levantamentoItemId: string | null;
  prioridade: string;
  slaHoras: number;
  inicio: Date;
  prazoFinal: Date;
  status: string;
  escalonado: boolean;
  escalonadoAutomatico: boolean;
  minutosRestantes: number;
  pctConsumido: number;
}
