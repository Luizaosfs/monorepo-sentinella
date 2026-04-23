import { Injectable } from '@nestjs/common';
import { PaginationProps } from 'src/shared/dtos/pagination-body';

import { FilterFocoRiscoInput } from '../dtos/filter-foco-risco.input';
import { FocoRisco, FocoRiscoPaginated } from '../entities/foco-risco';

export interface ScoreInputsRow {
  clienteId: string;
  status: string;
  focoAnteriorId: string | null;
  latitude: number | null;
  longitude: number | null;
  prazoMinutos: number | null;
  tempoNoEstadoMinutos: number | null;
  casosProximosCount: number;
}

export interface ContagemTriagemResult {
  total: number;
  suspeita: number;
  em_triagem: number;
  aguarda_inspecao: number;
  em_inspecao: number;
  p1p2: number;
  sem_responsavel: number;
}

@Injectable()
export abstract class FocoRiscoReadRepository {
  abstract findById(id: string, clienteId?: string | null): Promise<FocoRisco | null>;
  abstract findByIdComHistorico(id: string, clienteId?: string | null): Promise<FocoRisco | null>;
  abstract findAll(filters: FilterFocoRiscoInput): Promise<FocoRisco[]>;
  abstract findPaginated(
    filters: FilterFocoRiscoInput,
    pagination: PaginationProps,
  ): Promise<FocoRiscoPaginated>;
  abstract findManyByIds(ids: string[], clienteId: string): Promise<FocoRisco[]>;
  abstract findContagemTriagem(filters: FilterFocoRiscoInput): Promise<ContagemTriagemResult>;
  abstract findContagemPorStatus(clienteId: string): Promise<Record<string, number>>;
  abstract findTimeline(focoId: string): Promise<TimelineItem[]>;
  abstract findInputsParaScorePrioridade(focoId: string): Promise<ScoreInputsRow | null>;
}

export interface TimelineItem {
  foco_risco_id: string;
  tipo: string;
  ts: string | null;
  titulo: string;
  descricao: string | null;
  ator_id: string | null;
  ref_id: string | null;
}
