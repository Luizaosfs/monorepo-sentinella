import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';

import { SaveQuarteiraoInput } from '../dtos/save-quarteirao.body';
import { QuarteiraoException } from '../errors/quarteirao.exception';
import { QuarteiraoReadRepository } from '../repositories/quarteirao-read.repository';
import { QuarteiraoWriteRepository } from '../repositories/quarteirao-write.repository';

@Injectable({ scope: Scope.REQUEST })
export class SaveQuarteirao {
  constructor(
    private readRepository: QuarteiraoReadRepository,
    private writeRepository: QuarteiraoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string, input: SaveQuarteiraoInput) {
    const tenantId = getAccessScope(this.req).tenantId;

    const quarteirao = await this.readRepository.findQuarteiraoById(id);
    if (!quarteirao) throw QuarteiraoException.notFound();

    // MT: supervisor só edita quarteirões do próprio cliente
    if (tenantId != null && quarteirao.clienteId !== tenantId) {
      throw QuarteiraoException.forbiddenTenant();
    }

    // Somente Polygon simples — rejeita MultiPolygon e outros tipos
    if (input.geojson != null) {
      const type = (input.geojson as Record<string, unknown>).type;
      if (type !== 'Polygon') {
        throw QuarteiraoException.badRequest();
      }
    }

    if (input.codigo   !== undefined) quarteirao.codigo   = input.codigo;
    if (input.bairroId !== undefined) quarteirao.bairroId = input.bairroId ?? undefined;
    if (input.ativo    !== undefined) quarteirao.ativo    = input.ativo;
    if (input.geojson  !== undefined) quarteirao.geojson  = input.geojson ?? undefined;

    // syncArea calcula lat/lng automaticamente — não recebe lat/lng do frontend
    const updated = await this.writeRepository.saveQuarteirao(quarteirao);
    return { quarteirao: updated };
  }
}
