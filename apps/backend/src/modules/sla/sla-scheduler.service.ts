import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { SlaReadRepository } from './repositories/sla-read.repository';
import { SlaWriteRepository } from './repositories/sla-write.repository';
import { EscalarSla } from './use-cases/escalar-sla';

@Injectable()
export class SlaSchedulerService {
  private readonly logger = new Logger(SlaSchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private readRepository: SlaReadRepository,
    private writeRepository: SlaWriteRepository,
    private escalarSla: EscalarSla,
  ) {}

  /**
   * Marca SLAs com prazo expirado como status='vencido', violado=true.
   * NÃO escala — escalada é responsabilidade de escalarIminentes().
   */
  async marcarVencidos(): Promise<{ vencidos: number }> {
    const now = new Date();

    const { count: vencidos } = await this.prisma.client.sla_operacional.updateMany({
      where: {
        status: { in: ['pendente', 'em_atendimento'] },
        prazo_final: { lt: now },
        deleted_at: null,
      },
      data: { status: 'vencido', violado: true },
    });

    this.logger.log(`[SlaSchedulerService.marcarVencidos] vencidos=${vencidos}`);
    return { vencidos };
  }

  /**
   * Escala SLAs iminentes (dentro de pctLimiar% do prazo restante).
   * Paridade com legado fn_escalar_slas_iminentes (dump linha 2826).
   *
   * @param pctLimiar porcentagem do prazo restante que dispara escalada (default 20)
   */
  async escalarIminentes(pctLimiar = 20): Promise<{ candidatos: number; escalados: number; erros: number }> {
    const iminentes = await this.readRepository.findIminentesGlobal(pctLimiar);

    if (iminentes.length === 0) {
      this.logger.log('[SlaSchedulerService.escalarIminentes] nenhum candidato');
      return { candidatos: 0, escalados: 0, erros: 0 };
    }

    let escalados = 0;
    let erros = 0;
    const escaladosIds: string[] = [];

    for (const sla of iminentes) {
      try {
        const resultado = await this.escalarSla.execute(sla.id, {
          tenantId: null,
          userId: null,
        });
        if (resultado.escalado) {
          escalados++;
          escaladosIds.push(sla.id);
        }
      } catch (err) {
        erros++;
        this.logger.warn(
          `[SlaSchedulerService.escalarIminentes] falha em SLA ${sla.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (escaladosIds.length > 0) {
      await this.writeRepository.marcarEscalonadoAutomatico(escaladosIds);
    }

    this.logger.log(
      `[SlaSchedulerService.escalarIminentes] candidatos=${iminentes.length} escalados=${escalados} erros=${erros}`,
    );
    return { candidatos: iminentes.length, escalados, erros };
  }

  async pushCritico(): Promise<{ enviados: number }> {
    // P1 e P2 são os "críticos" no formato P1-P5 (fix Bug 2: era ['alta', 'critica'])
    const slas = await this.prisma.client.sla_operacional.findMany({
      where: { status: 'vencido', prioridade: { in: ['P1', 'P2'] } },
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
