import { Injectable } from '@nestjs/common';

import { SlaException } from '../errors/sla.exception';
import { SlaReadRepository } from '../repositories/sla-read.repository';
import { SlaWriteRepository } from '../repositories/sla-write.repository';

@Injectable()
export class DeleteFeriado {
  constructor(
    private readRepository: SlaReadRepository,
    private writeRepository: SlaWriteRepository,
  ) {}

  async execute(id: string) {
    const feriados = await this.readRepository.findFeriados('');
    // Check via direct delete — repository handles not-found at DB level
    try {
      await this.writeRepository.deleteFeriado(id);
    } catch {
      throw SlaException.feriadoNotFound();
    }
    return { deleted: true };
  }
}
