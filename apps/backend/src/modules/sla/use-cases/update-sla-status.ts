import { Injectable } from '@nestjs/common';

import { UpdateSlaStatusBody } from '../dtos/update-sla-status.body';
import { SlaException } from '../errors/sla.exception';
import { SlaReadRepository } from '../repositories/sla-read.repository';
import { SlaWriteRepository } from '../repositories/sla-write.repository';

@Injectable()
export class UpdateSlaStatus {
  constructor(
    private readRepository: SlaReadRepository,
    private writeRepository: SlaWriteRepository,
  ) {}

  async execute(id: string, data: UpdateSlaStatusBody) {
    const sla = await this.readRepository.findById(id);
    if (!sla) throw SlaException.notFound();

    sla.status = data.status;
    if (data.status === 'concluido' && !sla.concluidoEm) {
      sla.concluidoEm = new Date();
    }

    await this.writeRepository.save(sla);
    return { sla };
  }
}
