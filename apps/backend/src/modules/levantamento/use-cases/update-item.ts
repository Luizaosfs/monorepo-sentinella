import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { assertTenantOwnership } from 'src/shared/security/tenant-ownership.util';

import { UpdateItemBody } from '../dtos/update-item.body';
import { LevantamentoException } from '../errors/levantamento.exception';
import { UpdateItemImutavelException } from '../errors/update-item-imutavel.exception';
import { LevantamentoReadRepository } from '../repositories/levantamento-read.repository';
import { LevantamentoWriteRepository } from '../repositories/levantamento-write.repository';

@Injectable()
export class UpdateItem {
  constructor(
    private readRepository: LevantamentoReadRepository,
    private writeRepository: LevantamentoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  /**
   * Campos técnicos imutáveis — subconjunto exposto via UpdateItemBody dos 14
   * campos protegidos pelo trigger SQL `fn_bloquear_update_campos_tecnicos`.
   * `imagePublicId` incluído por pareamento semântico com `imageUrl` (Cloudinary).
   */
  private static readonly CAMPOS_IMUTAVEIS = [
    'latitude',
    'longitude',
    'imageUrl',
    'imagePublicId',
    'scoreFinal',
  ] as const;

  async execute(itemId: string, input: UpdateItemBody) {
    const item = await this.readRepository.findItemById(itemId);
    if (!item) throw LevantamentoException.itemNotFound();
    assertTenantOwnership(item.clienteId, this.req);

    // Guard G.1: campos técnicos imutáveis após criação (paridade SQL legado)
    const camposViolados = UpdateItem.CAMPOS_IMUTAVEIS.filter(
      (campo) => input[campo] !== undefined,
    );
    if (camposViolados.length > 0) {
      throw UpdateItemImutavelException.camposImutaveis([...camposViolados]);
    }

    await this.writeRepository.updateItem(itemId, input);
    const updated = await this.readRepository.findItemById(itemId);
    return { item: updated! };
  }
}
