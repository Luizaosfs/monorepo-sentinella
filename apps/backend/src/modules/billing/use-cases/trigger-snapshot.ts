import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class TriggerSnapshot {
  private readonly logger = new Logger(TriggerSnapshot.name);

  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string) {
    const agora = new Date();
    const periodoInicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const periodoFim    = new Date(agora.getFullYear(), agora.getMonth() + 1, 0);

    const [vistorias, levantamentos, itensfocos, voos, denuncias, usuariosAtivos, imoveis] =
      await Promise.all([
        this.prisma.client.vistorias.count({
          where: { cliente_id: clienteId, created_at: { gte: periodoInicio } },
        }),
        this.prisma.client.levantamentos.count({
          where: { cliente_id: clienteId, created_at: { gte: periodoInicio } },
        }),
        this.prisma.client.levantamento_itens.count({
          where: { cliente_id: clienteId, created_at: { gte: periodoInicio } },
        }),
        this.prisma.client.voos.count({
          where: { created_at: { gte: periodoInicio }, planejamento: { cliente_id: clienteId } },
        }),
        this.prisma.client.casos_notificados.count({
          where: { cliente_id: clienteId, created_at: { gte: periodoInicio } },
        }),
        this.prisma.client.usuarios.count({
          where: { cliente_id: clienteId, ativo: true },
        }),
        this.prisma.client.imoveis.count({
          where: { cliente_id: clienteId, deleted_at: null },
        }),
      ]);

    const snapshot = await this.prisma.client.billing_usage_snapshot.create({
      data: {
        cliente_id:         clienteId,
        periodo_inicio:     periodoInicio,
        periodo_fim:        periodoFim,
        vistorias_mes:      vistorias,
        levantamentos_mes:  levantamentos,
        itens_focos_mes:    itensfocos,
        voos_mes:           voos,
        denuncias_mes:      denuncias,
        ia_calls_mes:       0,
        usuarios_ativos_mes: usuariosAtivos,
        imoveis_total:      imoveis,
        storage_gb:         0,
      },
    });

    this.logger.log(`[TriggerSnapshot] cliente=${clienteId} snapshot=${snapshot.id}`);
    return snapshot;
  }
}
