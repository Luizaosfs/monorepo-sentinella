import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { UpdateIntegracaoMetaInput } from '../dtos/integracao.body';

@Injectable()
export class UpdateIntegracaoMeta {
  constructor(private prisma: PrismaService) {}

  async execute(id: string, clienteId: string, input: UpdateIntegracaoMetaInput) {
    const existing = await this.prisma.client.cliente_integracoes.findFirst({
      where: { id },
      select: { id: true, cliente_id: true },
    });

    if (!existing) throw new NotFoundException('Integração não encontrada');
    if (existing.cliente_id !== clienteId) throw new ForbiddenException('Recurso não pertence ao tenant');

    return this.prisma.client.cliente_integracoes.update({
      where: { id },
      data: {
        ...(input.endpointUrl      !== undefined && { endpoint_url:       input.endpointUrl }),
        ...(input.codigoIbge       !== undefined && { codigo_ibge:        input.codigoIbge }),
        ...(input.unidadeSaudeCnes !== undefined && { unidade_saude_cnes: input.unidadeSaudeCnes }),
        ...(input.ambiente         !== undefined && { ambiente:           input.ambiente }),
        ...(input.ativo            !== undefined && { ativo:              input.ativo }),
        updated_at: new Date(),
      },
    });
  }
}
