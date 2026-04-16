import { Injectable } from '@nestjs/common';

import { SlaException } from '../errors/sla.exception';
import { SlaReadRepository } from '../repositories/sla-read.repository';
import { SlaWriteRepository } from '../repositories/sla-write.repository';

@Injectable()
export class ConcluirSla {
  constructor(
    private readRepository: SlaReadRepository,
    private writeRepository: SlaWriteRepository,
  ) {}

  async execute(id: string) {
    const sla = await this.readRepository.findById(id);
    if (!sla) throw SlaException.notFound();

    const agora = new Date();
    sla.status = 'concluido';
    sla.concluidoEm = agora;
    if (sla.prazoFinal < agora) {
      sla.violado = true;
    }

    await this.writeRepository.save(sla);
    return { sla };
  }
}
