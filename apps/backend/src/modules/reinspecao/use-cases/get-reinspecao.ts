import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { ReinspecaoException } from '../errors/reinspecao.exception';
import { ReinspecaoReadRepository } from '../repositories/reinspecao-read.repository';

@Injectable()
export class GetReinspecao {
  constructor(
    private repository: ReinspecaoReadRepository,
    private prisma: PrismaService,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string) {
    const tenantId = getAccessScope(this.req).tenantId;
    // MT-06: passa clienteId para o findById filtrar no banco (impede IDOR cross-tenant)
    const r = await this.repository.findById(id, tenantId);
    if (!r) {
      throw ReinspecaoException.notFound();
    }

    let codigoFoco: string | null = null;
    let focoEndereco: string | null = null;
    let focoBairro: string | null = null;

    if (r.focoRiscoId) {
      const foco = await this.prisma.client.focos_risco.findFirst({
        where: { id: r.focoRiscoId },
        select: {
          codigo_foco: true,
          endereco_normalizado: true,
          imovel: { select: { logradouro: true, numero: true, bairro: true } },
        },
      });
      if (foco) {
        codigoFoco = foco.codigo_foco ?? null;
        const partes = [foco.imovel?.logradouro, foco.imovel?.numero].filter(Boolean);
        focoEndereco = partes.length > 0
          ? partes.join(', ')
          : foco.endereco_normalizado ?? null;
        focoBairro = foco.imovel?.bairro ?? null;
      }
    }

    return { reinspecao: r, codigoFoco, focoEndereco, focoBairro };
  }
}
