import { Injectable } from '@nestjs/common';

import { PlanoAcao } from '../entities/plano-acao';

@Injectable()
export abstract class PlanoAcaoWriteRepository {
  abstract create(entity: PlanoAcao): Promise<PlanoAcao>;
  abstract save(entity: PlanoAcao): Promise<void>;
  abstract delete(id: string, clienteId: string): Promise<void>;
}
