import { Injectable } from '@nestjs/common';

import { Ciclo } from '../entities/ciclo';

export interface FecharCicloData {
  dataFechamento: Date;
  fechadoPor: string;
  observacaoFechamento?: string;
}

@Injectable()
export abstract class CicloWriteRepository {
  abstract create(ciclo: Ciclo): Promise<Ciclo>;
  abstract save(ciclo: Ciclo): Promise<void>;
  abstract desativarTodos(clienteId: string): Promise<void>;
  abstract abrirCiclo(entity: Ciclo): Promise<Ciclo>;
  abstract fecharCiclo(
    id: string,
    clienteId: string,
    data: FecharCicloData,
  ): Promise<{ snapshot: Record<string, unknown> }>;
}
