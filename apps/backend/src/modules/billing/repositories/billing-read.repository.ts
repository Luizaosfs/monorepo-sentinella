import { Injectable } from '@nestjs/common';

import {
  BillingCiclo,
  ClientePlano,
  ClienteQuotas,
  Plano,
} from '../entities/billing';

export interface UsoMensal {
  clienteId: string;
  voosMes: number;
  levantamentosMes: number;
  itensMes: number;
  usuariosAtivos: number;
}

@Injectable()
export abstract class BillingReadRepository {
  abstract findPlanos(): Promise<Plano[]>;
  abstract findPlanoById(id: string): Promise<Plano | null>;
  abstract findClientePlano(clienteId: string): Promise<ClientePlano | null>;
  abstract findCiclos(clienteId: string): Promise<BillingCiclo[]>;
  abstract findCicloById(id: string): Promise<BillingCiclo | null>;
  abstract findQuotas(clienteId: string): Promise<ClienteQuotas | null>;
  abstract findUsoMensal(
    clienteId: string,
    mesInicio: Date,
    mesFim: Date,
  ): Promise<UsoMensal>;
  abstract findUsoMensalTodos(
    mesInicio: Date,
    mesFim: Date,
  ): Promise<UsoMensal[]>;
}
