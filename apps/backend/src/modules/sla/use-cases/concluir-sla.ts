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

  async execute(id: string, clienteId: string | null) {
    const sla = await this.readRepository.findById(id, clienteId);
    if (!sla) throw SlaException.notFound();

    const statusAnterior = sla.status;
    const agora = new Date();
    sla.status = 'concluido';
    sla.concluidoEm = agora;

    // K.2 — trg_sla_reset_escalonado_automatico: paridade OLD.status <> NEW.status
    if (statusAnterior !== 'concluido') {
      sla.escalonadoAutomatico = false;
    }

    if (sla.prazoFinal < agora) {
      sla.violado = true;
    }

    await this.writeRepository.save(sla);
    return { sla };
  }
}
