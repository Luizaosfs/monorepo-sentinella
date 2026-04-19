import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class ResolverStatusItem {
  constructor(private prisma: PrismaService) {}

  async execute(itemId: string, clienteId: string, usuarioId?: string) {
    const foco = await this.prisma.client.focos_risco.findFirst({
      where: {
        origem_levantamento_item_id: itemId,
        cliente_id: clienteId,
        deleted_at: null,
      },
      select: { id: true, status: true },
    });

    if (!foco) return; // item legado sem foco vinculado

    if (foco.status === 'resolvido') return; // já resolvido

    if (foco.status !== 'em_tratamento') {
      throw new BadRequestException(
        `Transição inválida: foco em '${foco.status}' não pode ser marcado como resolvido`,
      );
    }

    await this.prisma.client.$transaction([
      this.prisma.client.focos_risco.update({
        where: { id: foco.id },
        data: { status: 'resolvido', updated_at: new Date() },
      }),
      this.prisma.client.foco_risco_historico.create({
        data: {
          foco_risco_id: foco.id,
          cliente_id:    clienteId,
          status_anterior: 'em_tratamento',
          status_novo:   'resolvido',
          alterado_por:  usuarioId ?? null,
          tipo_evento:   'resolver_status_item',
        },
      }),
    ]);
  }
}
