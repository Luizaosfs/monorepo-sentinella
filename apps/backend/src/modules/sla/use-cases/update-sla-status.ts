import { Inject, Injectable, Logger } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { UpdateSlaStatusBody } from '../dtos/update-sla-status.body';
import { SlaException } from '../errors/sla.exception';
import { SlaReadRepository } from '../repositories/sla-read.repository';
import { SlaWriteRepository } from '../repositories/sla-write.repository';

@Injectable()
export class UpdateSlaStatus {
  private readonly logger = new Logger(UpdateSlaStatus.name);

  constructor(
    private readRepository: SlaReadRepository,
    private writeRepository: SlaWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string, data: UpdateSlaStatusBody, clienteId?: string | null) {
    const sla = await this.readRepository.findById(id, clienteId);
    if (!sla) throw SlaException.notFound();

    const statusAnterior = sla.status;
    sla.status = data.status;
    if (data.status === 'concluido' && !sla.concluidoEm) {
      sla.concluidoEm = new Date();
    }

    await this.writeRepository.save(sla);

    this.logger.log(
      `SLA status atualizado | slaId=${id} | ${statusAnterior} → ${data.status} | clienteId=${clienteId ?? 'null'} | usuarioId=${this.req['user']?.id ?? 'desconhecido'}`,
    );

    return { sla };
  }
}
