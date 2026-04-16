import { Injectable } from '@nestjs/common';

import {
  CasosPaginados,
  NotificacaoReadRepository,
} from '../repositories/notificacao-read.repository';

@Injectable()
export class PaginationCasos {
  constructor(private readRepository: NotificacaoReadRepository) {}

  async execute(
    clienteId: string,
    limit: number,
    cursor?: string,
  ): Promise<CasosPaginados> {
    return this.readRepository.findCasosPaginated(clienteId, limit, cursor);
  }
}
