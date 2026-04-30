import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { PrismaService } from 'src/shared/modules/database/prisma/prisma.service';

import { Imovel } from '../entities/imovel';

@Injectable()
export class FindByEndereco {
  constructor(
    private prisma: PrismaService,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(logradouro: string, numero: string) {
    const clienteId = requireTenantId(getAccessScope(this.req));

    const raw = await this.prisma.client.imoveis.findFirst({
      where: {
        cliente_id: clienteId,
        logradouro: { contains: logradouro.trim(), mode: 'insensitive' },
        numero: numero.trim(),
        ativo: true,
        deleted_at: null,
      },
    });

    if (!raw) return { imovel: null };

    const imovel = new Imovel(
      {
        clienteId: raw.cliente_id,
        regiaoId: raw.regiao_id ?? undefined,
        tipoImovel: raw.tipo_imovel,
        logradouro: raw.logradouro ?? undefined,
        numero: raw.numero ?? undefined,
        complemento: raw.complemento ?? undefined,
        bairro: raw.bairro ?? undefined,
        quarteirao: raw.quarteirao ?? undefined,
        latitude: raw.latitude ?? undefined,
        longitude: raw.longitude ?? undefined,
        ativo: raw.ativo,
        proprietarioAusente: raw.proprietario_ausente,
        tipoAusencia: raw.tipo_ausencia ?? undefined,
        contatoProprietario: raw.contato_proprietario ?? undefined,
        temAnimalAgressivo: raw.tem_animal_agressivo,
        historicoRecusa: raw.historico_recusa,
        temCalha: raw.tem_calha,
        calhaAcessivel: raw.calha_acessivel,
        prioridadeDrone: raw.prioridade_drone,
        notificacaoFormalEm: raw.notificacao_formal_em ?? undefined,
      },
      { id: raw.id },
    );

    return { imovel };
  }
}
