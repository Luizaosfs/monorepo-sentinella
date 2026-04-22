import { Injectable, Logger } from '@nestjs/common';

import { CriarFocoDeLevantamentoItem } from '@/modules/foco-risco/use-cases/auto-criacao/criar-foco-de-levantamento-item';

import { CreateLevantamentoItemBody } from '../dtos/create-levantamento-item.body';
import { LevantamentoException } from '../errors/levantamento.exception';
import { LevantamentoReadRepository } from '../repositories/levantamento-read.repository';
import { LevantamentoWriteRepository } from '../repositories/levantamento-write.repository';

@Injectable()
export class CreateLevantamentoItem {
  private readonly logger = new Logger(CreateLevantamentoItem.name);

  constructor(
    private readRepository: LevantamentoReadRepository,
    private writeRepository: LevantamentoWriteRepository,
    private criarFocoDeLevantamentoItem: CriarFocoDeLevantamentoItem,
  ) {}

  async execute(levantamentoId: string, input: CreateLevantamentoItemBody) {
    const levantamento = await this.readRepository.findById(levantamentoId);
    if (!levantamento) throw LevantamentoException.notFound();

    const item = await this.writeRepository.createItem({
      levantamentoId,
      latitude: input.latitude,
      longitude: input.longitude,
      item: input.item,
      risco: input.risco,
      acao: input.acao,
      scoreFinal: input.scoreFinal,
      prioridade: input.prioridade,
      slaHoras: input.slaHoras,
      enderecoCurto: input.enderecoCurto,
      enderecoCompleto: input.enderecoCompleto,
      imageUrl: input.imageUrl,
      maps: input.maps,
      waze: input.waze,
      dataHora: input.dataHora,
      peso: input.peso,
      payload: input.payload,
      imagePublicId: input.imagePublicId,
    });

    if (item.id) {
      try {
        await this.criarFocoDeLevantamentoItem.execute({
          itemId: item.id,
          levantamentoId,
          latitude: item.latitude ?? null,
          longitude: item.longitude ?? null,
          prioridade: item.prioridade ?? null,
          risco: item.risco ?? null,
          enderecoCurto: item.enderecoCurto ?? null,
          payload: (item.payload ?? null) as Record<string, unknown> | null,
          createdAt: item.createdAt ?? new Date(),
        });
      } catch (err) {
        this.logger.error(
          `Hook CriarFocoDeLevantamentoItem falhou: item=${item.id} erro=${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return { item };
  }
}
