import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class RegistrarCheckin {
  constructor(private prisma: PrismaService) {}

  async execute(itemId: string, usuarioId?: string | null) {
    const item = await this.prisma.client.levantamento_itens.findFirst({
      where: { id: itemId, deleted_at: null },
    });
    if (!item) return { ok: false, focoId: null };

    const foco = await this.prisma.client.focos_risco.findFirst({
      where: { origem_levantamento_item_id: itemId, deleted_at: null },
    });

    if (foco && foco.status === 'suspeita') {
      await this.prisma.client.$transaction([
        this.prisma.client.focos_risco.update({
          where: { id: foco.id },
          data: { status: 'em_triagem', updated_at: new Date() },
        }),
        this.prisma.client.foco_risco_historico.create({
          data: {
            foco_risco_id: foco.id,
            cliente_id: foco.cliente_id,
            status_anterior: 'suspeita',
            status_novo: 'em_triagem',
            alterado_por: usuarioId ?? null,
            tipo_evento: 'checkin_item',
          },
        }),
      ]);
    }

    return { ok: true, focoId: foco?.id ?? null };
  }
}
