import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class GerarResumoDiario {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const [metricas] = await this.prisma.client.$queryRaw<
      {
        total_vistorias: number;
        total_focos: number;
        focos_confirmados: number;
        focos_resolvidos: number;
        agentes_ativos: number;
      }[]
    >(Prisma.sql`
      SELECT
        (SELECT COUNT(*)::int FROM vistorias WHERE cliente_id = ${clienteId}::uuid AND data_vistoria::date = ${hoje}::date AND deleted_at IS NULL) AS total_vistorias,
        (SELECT COUNT(*)::int FROM focos_risco WHERE cliente_id = ${clienteId}::uuid AND created_at::date = ${hoje}::date AND deleted_at IS NULL) AS total_focos,
        (SELECT COUNT(*)::int FROM focos_risco WHERE cliente_id = ${clienteId}::uuid AND status = 'confirmado' AND deleted_at IS NULL) AS focos_confirmados,
        (SELECT COUNT(*)::int FROM focos_risco WHERE cliente_id = ${clienteId}::uuid AND status = 'resolvido' AND updated_at::date = ${hoje}::date AND deleted_at IS NULL) AS focos_resolvidos,
        (SELECT COUNT(DISTINCT agente_id)::int FROM vistorias WHERE cliente_id = ${clienteId}::uuid AND data_vistoria::date = ${hoje}::date AND deleted_at IS NULL) AS agentes_ativos
    `);

    const sumario = `Resumo do dia ${hoje.toISOString().split('T')[0]}: ${metricas?.total_vistorias ?? 0} vistorias, ${metricas?.total_focos ?? 0} focos novos.`;

    const existing = await this.prisma.client.resumos_diarios.findFirst({
      where: { cliente_id: clienteId, data_ref: hoje },
    });

    if (existing) {
      return this.prisma.client.resumos_diarios.update({
        where: { id: existing.id },
        data: { sumario, metricas: metricas as unknown as Prisma.InputJsonValue },
      });
    }

    return this.prisma.client.resumos_diarios.create({
      data: {
        cliente_id: clienteId,
        data_ref: hoje,
        sumario,
        metricas: metricas as unknown as Prisma.InputJsonValue,
      },
    });
  }
}
