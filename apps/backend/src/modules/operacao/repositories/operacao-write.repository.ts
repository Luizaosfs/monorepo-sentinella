import { Injectable } from '@nestjs/common';

import { Operacao, OperacaoEvidencia } from '../entities/operacao';

@Injectable()
export abstract class OperacaoWriteRepository {
  abstract create(entity: Operacao): Promise<Operacao>;
  abstract save(entity: Operacao): Promise<void>;
  abstract softDelete(id: string, deletedBy: string): Promise<void>;
  abstract addEvidencia(
    data: OperacaoEvidencia & { operacaoId: string },
  ): Promise<OperacaoEvidencia>;
}
