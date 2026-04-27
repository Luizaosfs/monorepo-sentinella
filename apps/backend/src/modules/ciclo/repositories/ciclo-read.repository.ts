import { Injectable } from '@nestjs/common';

import { FilterCicloInput } from '../dtos/filter-ciclo.input';
import { Ciclo } from '../entities/ciclo';

export interface CicloProgresso {
  clienteId: string;
  ciclo: number;
  imoveisTotal: number;
  imoveisVisitados: number;
  imoveisSemAcesso: number;
  coberturaPct: number;
  vistoriasTotal: number;
  vistoriasLiraa: number;
  agentesAtivos: number;
  focosTotal: number;
  focosAtivos: number;
  focosResolvidos: number;
  alertasRetornoPendentes: number;
}

@Injectable()
export abstract class CicloReadRepository {
  abstract findById(id: string, clienteId: string | null): Promise<Ciclo | null>;
  abstract findAll(filters: FilterCicloInput): Promise<Ciclo[]>;
  abstract findAtivoByClienteId(clienteId: string): Promise<Ciclo | null>;
  abstract findAtivo(clienteId: string): Promise<Ciclo | null>;
  abstract findByNumeroAno(
    clienteId: string,
    numero: number,
    ano: number,
  ): Promise<Ciclo | null>;
  abstract findProgresso(clienteId: string): Promise<CicloProgresso | null>;
}
