import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class SlaSchedulerService {
  private readonly logger = new Logger(SlaSchedulerService.name);

  constructor(private prisma: PrismaService) {}

  async marcarVencidos(): Promise<{ vencidos: number; escalados: number }> {
    const now = new Date();

    const { count: vencidos } = await this.prisma.client.sla_operacional.updateMany({
      where: {
        status: { in: ['pendente', 'em_atendimento'] },
        prazo_final: { lt: now },
      },
      data: { status: 'vencido', violado: true },
    });

    // Escala SLAs iminentes (prazo nos próximos 20% do tempo restante)
    const escalados = await this.prisma.client.$executeRaw`
      UPDATE sla_operacional
      SET prioridade = CASE
        WHEN prioridade = 'baixa'  THEN 'media'
        WHEN prioridade = 'media'  THEN 'alta'
        WHEN prioridade = 'alta'   THEN 'critica'
        ELSE prioridade
      END
      WHERE status IN ('pendente', 'em_atendimento')
        AND prazo_final > NOW()
        AND prazo_final < NOW() + (
          EXTRACT(EPOCH FROM (prazo_final - created_at)) * 0.2 * INTERVAL '1 second'
        )
    `;

    this.logger.log(
      `[SlaSchedulerService.marcarVencidos] vencidos=${vencidos} escalados=${escalados}`,
    );
    return { vencidos, escalados };
  }

  async pushCritico(): Promise<{ enviados: number }> {
    const slas = await this.prisma.client.sla_operacional.findMany({
      where: { status: 'vencido', prioridade: { in: ['alta', 'critica'] } },
      take: 100,
    });

    if (slas.length === 0) return { enviados: 0 };

    const clienteIds = [...new Set(slas.map((s) => s.cliente_id).filter((id): id is string => id !== null))];
    const pushSubs = await this.prisma.client.push_subscriptions.findMany({
      where: { cliente_id: { in: clienteIds } },
    });

    const webpush = await import('web-push');
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? 'mailto:suporte@sentinella.com.br',
      process.env.VAPID_PUBLIC_KEY ?? '',
      process.env.VAPID_PRIVATE_KEY ?? '',
    );

    let enviados = 0;
    const inativas: string[] = [];

    for (const sub of pushSubs) {
      const count = slas.filter((s) => s.cliente_id === sub.cliente_id).length;
      const payload = JSON.stringify({
        title: `${count} SLA(s) crítico(s) vencido(s)`,
        body: 'Acesse o painel para ver os detalhes.',
        url: '/gestor/sla',
      });

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        enviados++;
      } catch (err: any) {
        if (err?.statusCode === 410) inativas.push(sub.id);
        else this.logger.warn(`[pushCritico] Falha push ${sub.id}: ${err?.message}`);
      }
    }

    if (inativas.length > 0) {
      await this.prisma.client.push_subscriptions.deleteMany({
        where: { id: { in: inativas } },
      });
    }

    this.logger.log(`[SlaSchedulerService.pushCritico] enviados=${enviados}`);
    return { enviados };
  }
}
