import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { UpsertIntegracaoInput } from '../dtos/integracao.body';

@Injectable()
export class UpsertIntegracao {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string, input: UpsertIntegracaoInput) {
    const existing = await this.prisma.client.cliente_integracoes.findFirst({
      where: { cliente_id: clienteId, tipo: input.tipo },
      select: { id: true },
    });

    const masked =
      input.apiKey.length > 8
        ? input.apiKey.slice(0, 4) + '****' + input.apiKey.slice(-4)
        : '****';

    if (existing) {
      return this.prisma.client.cliente_integracoes.update({
        where: { id: existing.id },
        data: {
          api_key:            input.apiKey,
          api_key_masked:     masked,
          ...(input.endpointUrl      !== undefined && { endpoint_url:       input.endpointUrl }),
          ...(input.codigoIbge       !== undefined && { codigo_ibge:        input.codigoIbge }),
          ...(input.unidadeSaudeCnes !== undefined && { unidade_saude_cnes: input.unidadeSaudeCnes }),
          ...(input.ambiente         !== undefined && { ambiente:           input.ambiente }),
          ...(input.ativo            !== undefined && { ativo:              input.ativo }),
          updated_at: new Date(),
        },
      });
    }

    return this.prisma.client.cliente_integracoes.create({
      data: {
        cliente_id:         clienteId,
        tipo:               input.tipo,
        api_key:            input.apiKey,
        api_key_masked:     masked,
        endpoint_url:       input.endpointUrl,
        codigo_ibge:        input.codigoIbge,
        unidade_saude_cnes: input.unidadeSaudeCnes,
        ambiente:           input.ambiente ?? 'homologacao',
        ativo:              input.ativo ?? false,
      },
    });
  }
}
