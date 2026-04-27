import { Injectable } from '@nestjs/common';

import { SlaException } from '../errors/sla.exception';
import { SlaReadRepository } from '../repositories/sla-read.repository';
import { SlaWriteRepository } from '../repositories/sla-write.repository';

@Injectable()
export class ReabrirSla {
  constructor(
    private readRepository: SlaReadRepository,
    private writeRepository: SlaWriteRepository,
  ) {}

  async execute(id: string, clienteId: string | null) {
    const sla = await this.readRepository.findById(id, clienteId);
    if (!sla) throw SlaException.notFound();

    sla.status = 'pendente';
    sla.concluidoEm = undefined;
    sla.prazoFinal = new Date(Date.now() + sla.slaHoras * 3600 * 1000);

    await this.writeRepository.save(sla);
    return { sla };
  }
}
