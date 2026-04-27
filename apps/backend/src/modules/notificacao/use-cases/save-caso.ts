import { Injectable, Logger } from '@nestjs/common';

import { SaveCasoBody } from '../dtos/create-notificacao.body';
import { CasoNotificado } from '../entities/notificacao';
import { NotificacaoException } from '../errors/notificacao.exception';
import { NotificacaoReadRepository } from '../repositories/notificacao-read.repository';
import { NotificacaoWriteRepository } from '../repositories/notificacao-write.repository';
import { ReverterPrioridadeCasoDescartado } from './reverter-prioridade-caso-descartado';

@Injectable()
export class SaveCaso {
  private readonly logger = new Logger(SaveCaso.name);

  constructor(
    private readRepository: NotificacaoReadRepository,
    private writeRepository: NotificacaoWriteRepository,
    private reverterPrioridade: ReverterPrioridadeCasoDescartado,
  ) {}

  async execute(id: string, input: SaveCasoBody, clienteId: string | null): Promise<{ caso: CasoNotificado }> {
    const caso = await this.readRepository.findCasoById(id, clienteId);
    if (!caso) throw NotificacaoException.casoNotFound();

    const statusAnterior = caso.status;

    if (input.doenca !== undefined) caso.doenca = input.doenca;
    if (input.status !== undefined) caso.status = input.status;
    if (input.dataInicioSintomas !== undefined) caso.dataInicioSintomas = input.dataInicioSintomas;
    if (input.logradouroBairro !== undefined) caso.logradouroBairro = input.logradouroBairro;
    if (input.bairro !== undefined) caso.bairro = input.bairro;
    if (input.latitude !== undefined) caso.latitude = input.latitude;
    if (input.longitude !== undefined) caso.longitude = input.longitude;
    if (input.regiaoId !== undefined) caso.regiaoId = input.regiaoId;
    if (input.observacao !== undefined) caso.observacao = input.observacao;

    await this.writeRepository.saveCaso(caso);

    // Fase C.4 — hook best-effort na transição PARA 'descartado'.
    if (statusAnterior !== 'descartado' && caso.status === 'descartado') {
      try {
        await this.reverterPrioridade.execute({
          casoId: caso.id,
          clienteId: caso.clienteId,
          statusAnterior,
          statusNovo: caso.status,
        });
      } catch (err) {
        this.logger.error(
          `Hook ReverterPrioridadeCasoDescartado falhou para caso ${caso.id}: ${(err as Error).message}`,
        );
      }
    }

    return { caso };
  }
}
