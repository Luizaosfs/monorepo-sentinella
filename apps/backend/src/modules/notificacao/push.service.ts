import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(private prisma: PrismaService) {}

  async enviarPush(
    clienteId: string,
    titulo: string,
    corpo: string,
    url?: string,
  ): Promise<{ enviados: number }> {
    const subs = await this.prisma.client.push_subscriptions.findMany({
      where: { cliente_id: clienteId },
    });

    if (subs.length === 0) return { enviados: 0 };

    const webpush = await import('web-push');
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? 'mailto:suporte@sentinella.com.br',
      process.env.VAPID_PUBLIC_KEY ?? '',
      process.env.VAPID_PRIVATE_KEY ?? '',
    );

    const payload = JSON.stringify({ title: titulo, body: corpo, url });
    const inativas: string[] = [];
    let enviados = 0;

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        enviados++;
      } catch (err: any) {
        if (err?.statusCode === 410) inativas.push(sub.id);
        else this.logger.warn(`[enviarPush] Falha sub ${sub.id}: ${err?.message}`);
      }
    }

    if (inativas.length > 0) {
      await this.prisma.client.push_subscriptions.deleteMany({
        where: { id: { in: inativas } },
      });
      this.logger.log(`[enviarPush] ${inativas.length} subscriptions inativas removidas`);
    }

    return { enviados };
  }
}
