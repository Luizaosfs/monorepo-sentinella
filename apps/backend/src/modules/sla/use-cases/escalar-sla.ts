import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { SlaException } from '../errors/sla.exception';
import { SlaReadRepository } from '../repositories/sla-read.repository';
import { SlaWriteRepository } from '../repositories/sla-write.repository';

// Escala ascendente de prioridade — último é o máximo
const ESCALA_PRIORIDADE = ['P5', 'P4', 'P3', 'P2', 'P1'];
const HORAS_POR_PRIORIDADE: Record<string, number> = {
  P5: 120,
  P4: 72,
  P3: 48,
  P2: 24,
  P1: 8,
};

@Injectable()
export class EscalarSla {
  constructor(
    private readRepository: SlaReadRepository,
    private writeRepository: SlaWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string) {
    const tenantId = this.req['tenantId'] as string | null;
    const sla = await this.readRepository.findById(id, tenantId);
    if (!sla) throw SlaException.notFound();

    const indiceAtual = ESCALA_PRIORIDADE.indexOf(sla.prioridade);

    if (indiceAtual === -1 || indiceAtual === ESCALA_PRIORIDADE.length - 1) {
      return { escalado: false, mensagem: 'Já está na prioridade máxima' };
    }

    const novaPrioridade = ESCALA_PRIORIDADE[indiceAtual + 1];
    const novasHoras = HORAS_POR_PRIORIDADE[novaPrioridade] ?? sla.slaHoras;

    if (!sla.prioridadeOriginal) {
      sla.prioridadeOriginal = sla.prioridade;
    }

    sla.prioridade = novaPrioridade;
    sla.slaHoras = novasHoras;
    sla.escalonado = true;
    sla.escalonadoEm = new Date();
    sla.prazoFinal = new Date(Date.now() + novasHoras * 3600 * 1000);
    sla.escaladoPor = this.req['userId'] as string | undefined;

    await this.writeRepository.save(sla);
    return { escalado: true, sla };
  }
}
