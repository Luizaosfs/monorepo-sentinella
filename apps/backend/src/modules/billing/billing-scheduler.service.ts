import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class BillingSchedulerService {
  private readonly logger = new Logger(BillingSchedulerService.name);

  constructor(private prisma: PrismaService) {}

  async snapshot(): Promise<{ clientes: number; snapshots: number }> {
    const agora = new Date();
    const anoAtual = agora.getFullYear();
    const mesAtual = agora.getMonth(); // 0-indexed

    // Período do mês corrente
    const periodoInicio = new Date(anoAtual, mesAtual, 1);
    const periodoFim = new Date(anoAtual, mesAtual + 1, 0); // último dia do mês

    // Período do mês anterior
    const periodoInicioAnterior = new Date(anoAtual, mesAtual - 1, 1);
    const periodoFimAnterior = new Date(anoAtual, mesAtual, 0);

    // Fecha ciclos abertos do mês anterior
    await this.prisma.client.billing_ciclo.updateMany({
      where: {
        periodo_inicio: periodoInicioAnterior,
        periodo_fim: periodoFimAnterior,
        status: 'aberto',
      },
      data: { status: 'fechado', updated_at: agora },
    });

    const clientes = await this.prisma.client.clientes.findMany({
      where: { deleted_at: null, ativo: true },
      select: { id: true },
    });

    let snapshots = 0;

    for (const cliente of clientes) {
      try {
        const [vistorias, levantamentos, itensfocos, voos, denuncias, usuariosAtivos, imoveis] =
          await Promise.all([
            this.prisma.client.vistorias.count({
              where: { cliente_id: cliente.id, created_at: { gte: periodoInicio } },
            }),
            this.prisma.client.levantamentos.count({
              where: { cliente_id: cliente.id, created_at: { gte: periodoInicio } },
            }),
            this.prisma.client.levantamento_itens.count({
              where: { cliente_id: cliente.id, created_at: { gte: periodoInicio } },
            }),
            this.prisma.client.voos.count({
              where: {
                created_at: { gte: periodoInicio },
                planejamento: { cliente_id: cliente.id },
              },
            }),
            this.prisma.client.casos_notificados.count({
              where: { cliente_id: cliente.id, created_at: { gte: periodoInicio } },
            }),
            this.prisma.client.usuarios.count({
              where: { cliente_id: cliente.id, ativo: true },
            }),
            this.prisma.client.imoveis.count({
              where: { cliente_id: cliente.id, deleted_at: null },
            }),
          ]);

        // Schema real: vistorias_mes, levantamentos_mes, itens_focos_mes, voos_mes,
        // denuncias_mes, ia_calls_mes, usuarios_ativos_mes, imoveis_total, storage_gb
        await this.prisma.client.billing_usage_snapshot.create({
          data: {
            cliente_id: cliente.id,
            periodo_inicio: periodoInicio,
            periodo_fim: periodoFim,
            vistorias_mes: vistorias,
            levantamentos_mes: levantamentos,
            itens_focos_mes: itensfocos,
            voos_mes: voos,
            denuncias_mes: denuncias,
            ia_calls_mes: 0,
            usuarios_ativos_mes: usuariosAtivos,
            imoveis_total: imoveis,
            storage_gb: 0,
          },
        });

        // Garante ciclo aberto para o mês corrente (cria se não existir)
        const cicloExistente = await this.prisma.client.billing_ciclo.findFirst({
          where: {
            cliente_id: cliente.id,
            periodo_inicio: periodoInicio,
            status: 'aberto',
          },
        });

        if (!cicloExistente) {
          await this.prisma.client.billing_ciclo.create({
            data: {
              cliente_id: cliente.id,
              periodo_inicio: periodoInicio,
              periodo_fim: periodoFim,
              status: 'aberto',
            },
          });
        }

        snapshots++;
      } catch (err: any) {
        this.logger.warn(`[snapshot] Falha cliente ${cliente.id}: ${err?.message}`);
      }
    }

    this.logger.log(
      `[BillingSchedulerService.snapshot] clientes=${clientes.length} snapshots=${snapshots}`,
    );
    return { clientes: clientes.length, snapshots };
  }
}
