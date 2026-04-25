import { Injectable } from '@nestjs/common';

import {
  Vistoria,
  VistoriaCalha,
  VistoriaDeposito,
  VistoriaRisco,
  VistoriaSintoma,
} from '../entities/vistoria';

export interface CreateCompletaSubItems {
  depositos?: Omit<VistoriaDeposito, 'id' | 'vistoriaId' | 'createdAt'>[];
  sintomas?: Omit<VistoriaSintoma, 'id' | 'vistoriaId' | 'createdAt'>[];
  riscos?: Omit<VistoriaRisco, 'id' | 'vistoriaId' | 'createdAt'>[];
  calhas?: Omit<VistoriaCalha, 'id' | 'vistoriaId' | 'createdAt'>[];
}

export interface ConsolidacaoDados {
  resultadoOperacional: string;
  vulnerabilidadeDomiciliar: string;
  alertaSaude: string;
  riscoSocioambiental: string;
  riscoVetorial: string;
  prioridadeFinal: string;
  prioridadeMotivo: string;
  dimensaoDominante: string | null;
  consolidacaoResumo: string;
  consolidacaoJson: Record<string, unknown>;
  consolidacaoIncompleta: boolean;
  versaoRegraConsolidacao: string;
  versaoPesosConsolidacao: string;
}

export interface ArquivamentoAnterior {
  prioridadeFinal?: string;
  dimensaoDominante?: string;
  consolidacaoJson?: Record<string, unknown>;
  versaoRegra?: string;
  versaoPesos?: string;
  consolidadoEm: Date;
  motivo: string;
  reprocessadoPor?: string;
}

@Injectable()
export abstract class VistoriaWriteRepository {
  abstract create(entity: Vistoria): Promise<Vistoria>;
  abstract save(entity: Vistoria): Promise<void>;
  abstract createDeposito(
    deposito: VistoriaDeposito & { vistoriaId: string; clienteId: string },
  ): Promise<VistoriaDeposito>;
  abstract createSintoma(
    sintoma: VistoriaSintoma & { vistoriaId: string; clienteId: string },
  ): Promise<VistoriaSintoma>;
  abstract createRisco(
    risco: VistoriaRisco & { vistoriaId: string; clienteId: string },
  ): Promise<VistoriaRisco>;
  abstract createCalha(
    calha: VistoriaCalha & { vistoriaId: string; clienteId: string },
  ): Promise<VistoriaCalha>;
  /** Cria vistoria + sub-itens em uma única transação. Suporta idempotência. */
  abstract createCompleta(
    entity: Vistoria,
    subItems: CreateCompletaSubItems,
    idempotencyKey?: string,
  ): Promise<string>;
  /** Arquiva consolidação anterior (se houver) e grava nova consolidação em vistorias. */
  abstract salvarConsolidacao(
    vistoriaId: string,
    dados: ConsolidacaoDados,
    arquivar?: ArquivamentoAnterior,
  ): Promise<void>;
  abstract softDelete(id: string): Promise<void>;
}
