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
}
