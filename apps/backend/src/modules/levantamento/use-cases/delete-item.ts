import { Inject, Injectable, Logger } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { assertTenantOwnership } from 'src/shared/security/tenant-ownership.util';

import { CloudinaryService } from '../../cloudinary/cloudinary.service';
import { LevantamentoException } from '../errors/levantamento.exception';
import { LevantamentoReadRepository } from '../repositories/levantamento-read.repository';
import { LevantamentoWriteRepository } from '../repositories/levantamento-write.repository';

@Injectable()
export class DeleteItem {
  private readonly logger = new Logger(DeleteItem.name);

  constructor(
    private readRepository: LevantamentoReadRepository,
    private writeRepository: LevantamentoWriteRepository,
    private cloudinaryService: CloudinaryService,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(itemId: string) {
    const item = await this.readRepository.findItemById(itemId);
    if (!item) throw LevantamentoException.itemNotFound();
    assertTenantOwnership(item.clienteId, this.req);
    await this.writeRepository.deleteItem(itemId);

    // K.6 — fn_orfaos_levantamento_item: registra imagem para limpeza diferida (best-effort)
    if (item.imagePublicId) {
      try {
        await this.cloudinaryService.registrarOrfao(
          item.imagePublicId,
          item.imageUrl ?? '',
          'levantamento_itens',
          item.id,
          item.clienteId,
        );
      } catch (err) {
        this.logger.error(
          `[DeleteItem] Falha ao registrar órfão ${item.imagePublicId}: ${(err as Error).message}`,
        );
      }
    }
  }
}
