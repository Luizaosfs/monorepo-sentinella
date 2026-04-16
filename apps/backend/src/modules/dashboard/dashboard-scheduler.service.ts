import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class DashboardSchedulerService {
  private readonly logger = new Logger(DashboardSchedulerService.name);

  constructor(private prisma: PrismaService) {}

  async resumoDiario(): Promise<{ clientes: number }> {
    const clientes = await this.prisma.client.clientes.findMany({
      where: { deleted_at: null, ativo: true },
      select: { id: true, nome: true },
    });

    const agora = new Date();
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

    for (const cliente of clientes) {
      try {
        const [novosfocos, slasVencidos, vistorias, operacoes] = await Promise.all([
          this.prisma.client.focos_risco.count({
            where: { cliente_id: cliente.id, created_at: { gte: inicioHoje } },
          }),
          this.prisma.client.sla_operacional.count({
            where: { cliente_id: cliente.id, status: 'vencido', prazo_final: { gte: inicioHoje } },
          }),
          this.prisma.client.vistorias.count({
            where: { cliente_id: cliente.id, created_at: { gte: inicioHoje } },
          }),
          this.prisma.client.operacoes.count({
            where: { cliente_id: cliente.id, created_at: { gte: inicioHoje } },
          }),
        ]);

        const metricas = { novosfocos, slasVencidos, vistorias, operacoes };
        const dataStr = inicioHoje.toLocaleDateString('pt-BR');

        let sumario = `Resumo ${dataStr}: ${novosfocos} focos, ${slasVencidos} SLAs vencidos, ${vistorias} vistorias, ${operacoes} operações.`;

        try {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 200,
              messages: [
                {
                  role: 'user',
                  content: `Gere um resumo executivo curto (máximo 2 frases) sobre o dia de vigilância entomológica. Métricas: ${JSON.stringify(metricas)}. Seja objetivo e direto, em português.`,
                },
              ],
            }),
          });
          if (response.ok) {
            const data = (await response.json()) as any;
            sumario = data.content?.[0]?.text ?? sumario;
          }
        } catch {
          // usa sumário padrão sem IA
        }

        // Schema: data_ref (Date), sumario (string), metricas (Json?) — sem unique constraint, usar create
        await this.prisma.client.resumos_diarios.create({
          data: {
            cliente_id: cliente.id,
            data_ref: inicioHoje,
            sumario,
            metricas,
          },
        });

        await this.enviarPushCliente(
          cliente.id,
          `Resumo do dia — ${cliente.nome}`,
          sumario.slice(0, 100),
          '/gestor/dashboard',
        );
      } catch (err: any) {
        this.logger.warn(`[resumoDiario] Falha cliente ${cliente.id}: ${err?.message}`);
      }
    }

    return { clientes: clientes.length };
  }

  async relatorioSemanal(): Promise<{ enviados: number }> {
    const clientes = await this.prisma.client.clientes.findMany({
      where: { deleted_at: null, ativo: true },
      select: { id: true, nome: true },
    });

    const agora = new Date();
    const inicioSemana = new Date(agora);
    inicioSemana.setDate(agora.getDate() - 7);
    let enviados = 0;

    for (const cliente of clientes) {
      try {
        const [focos, vistorias, slas, operacoes] = await Promise.all([
          this.prisma.client.focos_risco.count({
            where: { cliente_id: cliente.id, created_at: { gte: inicioSemana } },
          }),
          this.prisma.client.vistorias.count({
            where: { cliente_id: cliente.id, created_at: { gte: inicioSemana } },
          }),
          this.prisma.client.sla_operacional.count({
            where: { cliente_id: cliente.id, status: 'vencido', prazo_final: { gte: inicioSemana } },
          }),
          this.prisma.client.operacoes.count({
            where: { cliente_id: cliente.id, created_at: { gte: inicioSemana } },
          }),
        ]);

        const ini = inicioSemana.toLocaleDateString('pt-BR');
        const fim = agora.toLocaleDateString('pt-BR');
        const html = [
          `<html><body>`,
          `<h1>Relatório Semanal — ${cliente.nome}</h1>`,
          `<p>Período: ${ini} a ${fim}</p>`,
          `<table border="1" cellpadding="8" cellspacing="0">`,
          `<tr><th>Métrica</th><th>Total</th></tr>`,
          `<tr><td>Focos de risco</td><td>${focos}</td></tr>`,
          `<tr><td>Vistorias realizadas</td><td>${vistorias}</td></tr>`,
          `<tr><td>SLAs vencidos</td><td>${slas}</td></tr>`,
          `<tr><td>Operações</td><td>${operacoes}</td></tr>`,
          `</table></body></html>`,
        ].join('\n');

        // Schema: payload (Json) — sem tipo/conteudo_html/metricas separados
        await this.prisma.client.relatorios_gerados.create({
          data: {
            cliente_id: cliente.id,
            periodo_inicio: inicioSemana,
            periodo_fim: agora,
            payload: { tipo: 'semanal', conteudo_html: html, metricas: { focos, vistorias, slas, operacoes } },
          },
        });

        enviados++;
      } catch (err: any) {
        this.logger.warn(`[relatorioSemanal] Falha cliente ${cliente.id}: ${err?.message}`);
      }
    }

    return { enviados };
  }

  private async enviarPushCliente(
    clienteId: string,
    titulo: string,
    corpo: string,
    url: string,
  ) {
    const pushSubs = await this.prisma.client.push_subscriptions.findMany({
      where: { cliente_id: clienteId },
    });
    if (pushSubs.length === 0) return;

    const webpush = await import('web-push');
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? 'mailto:suporte@sentinella.com.br',
      process.env.VAPID_PUBLIC_KEY ?? '',
      process.env.VAPID_PRIVATE_KEY ?? '',
    );

    const payload = JSON.stringify({ title: titulo, body: corpo, url });
    const inativas: string[] = [];

    for (const sub of pushSubs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
      } catch (err: any) {
        if (err?.statusCode === 410) inativas.push(sub.id);
      }
    }

    if (inativas.length > 0) {
      await this.prisma.client.push_subscriptions.deleteMany({
        where: { id: { in: inativas } },
      });
    }
  }
}
