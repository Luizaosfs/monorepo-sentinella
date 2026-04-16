import { Injectable } from '@nestjs/common';

import { AtribuirOperadorBody } from '../dtos/atribuir-operador.body';
import { SlaException } from '../errors/sla.exception';
import { SlaReadRepository } from '../repositories/sla-read.repository';
import { SlaWriteRepository } from '../repositories/sla-write.repository';

@Injectable()
export class AtribuirOperador {
  constructor(
    private readRepository: SlaReadRepository,
    private writeRepository: SlaWriteRepository,
  ) {}

  async execute(id: string, data: AtribuirOperadorBody) {
    const sla = await this.readRepository.findById(id);
    if (!sla) throw SlaException.notFound();

    sla.operadorId = data.operadorId;
    if (data.avancarStatus && sla.status === 'pendente') {
      sla.status = 'em_atendimento';
    }

    await this.writeRepository.save(sla);
    return { sla };
  }
}
