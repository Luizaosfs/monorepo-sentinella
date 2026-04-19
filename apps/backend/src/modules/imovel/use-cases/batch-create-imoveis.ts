import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { PrismaService } from 'src/shared/modules/database/prisma/prisma.service';

import { BatchCreateImoveisInput } from '../dtos/batch-create-imoveis.body';

const CHUNK_SIZE = 500;

@Injectable()
export class BatchCreateImoveis {
  constructor(
    private prisma: PrismaService,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(data: BatchCreateImoveisInput) {
    const clienteId = this.req['tenantId'] as string;
    let importados = 0;
    let falhas = 0;

    for (let i = 0; i < data.registros.length; i += CHUNK_SIZE) {
      const chunk = data.registros.slice(i, i + CHUNK_SIZE).map((r) => ({
        cliente_id:          clienteId,
        regiao_id:           r.regiaoId ?? null,
        tipo_imovel:         r.tipoImovel ?? 'residencial',
        logradouro:          r.logradouro ?? null,
        numero:              r.numero ?? null,
        complemento:         r.complemento ?? null,
        bairro:              r.bairro ?? null,
        quarteirao:          r.quarteirao ?? null,
        latitude:            r.latitude ?? null,
        longitude:           r.longitude ?? null,
        ativo:               r.ativo ?? true,
        proprietario_ausente: r.proprietarioAusente ?? false,
        tipo_ausencia:       r.tipoAusencia ?? null,
        contato_proprietario: r.contatoProprietario ?? null,
        tem_animal_agressivo: r.temAnimalAgressivo ?? false,
        historico_recusa:    r.historicoRecusa ?? false,
        tem_calha:           r.temCalha ?? false,
        calha_acessivel:     r.calhaAcessivel ?? true,
        prioridade_drone:    r.prioridadeDrone ?? false,
        notificacao_formal_em: r.notificacaoFormalEm ? new Date(r.notificacaoFormalEm) : null,
      }));

      try {
        const result = await this.prisma.client.imoveis.createMany({ data: chunk });
        importados += result.count;
      } catch {
        falhas += chunk.length;
      }
    }

    return { importados, falhas };
  }
}
