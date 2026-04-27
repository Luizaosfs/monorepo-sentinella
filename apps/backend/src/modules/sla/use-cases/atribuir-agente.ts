import { Injectable } from '@nestjs/common';

import { AtribuirAgenteBody } from '../dtos/atribuir-agente.body';
import { SlaException } from '../errors/sla.exception';
import { SlaReadRepository } from '../repositories/sla-read.repository';
import { SlaWriteRepository } from '../repositories/sla-write.repository';

@Injectable()
export class AtribuirAgente {
  constructor(
    private readRepository: SlaReadRepository,
    private writeRepository: SlaWriteRepository,
  ) {}

  async execute(id: string, data: AtribuirAgenteBody, clienteId: string | null) {
    const sla = await this.readRepository.findById(id, clienteId);
    if (!sla) throw SlaException.notFound();

    sla.agenteId = data.agenteId;
    if (data.avancarStatus && sla.status === 'pendente') {
      sla.status = 'em_atendimento';
    }

    await this.writeRepository.save(sla);
    return { sla };
  }
}
