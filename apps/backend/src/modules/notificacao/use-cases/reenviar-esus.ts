import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { calcularSemanaEpidemiologica } from '../helpers/sinan-backend';

@Injectable()
export class ReenviarEsus {
  constructor(private prisma: PrismaService) {}

  async execute(id: string, clienteId: string) {
    const registro = await this.prisma.client.item_notificacoes_esus.findFirst({
      where: { id, cliente_id: clienteId },
    });
    if (!registro) throw new Error('Notificação não encontrada');

    const integracao = await this.prisma.client.cliente_integracoes.findFirst({
      where: { cliente_id: clienteId, ativo: true },
    });
    if (!integracao) throw new Error('Integração e-SUS não configurada ou inativa');

    // Recalcular semana epidemiológica antes de reenviar (paridade com legado)
    const payload = { ...(registro.payload_enviado as Record<string, unknown>) };
    const dtNotific = (payload.dataNotificacao as string | undefined) ?? new Date().toISOString().slice(0, 10);
    payload.semanaEpidemiologica = calcularSemanaEpidemiologica(dtNotific);

    await this.prisma.client.item_notificacoes_esus.update({
      where: { id },
      data: { status: 'pendente', erro_mensagem: null, updated_at: new Date() },
    });

    let wasHandled = false;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      let response: Response;
      try {
        response = await fetch(integracao.endpoint_url, {
          method:  'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${integracao.api_key}`,
            'X-Ambiente':   integracao.ambiente,
          },
          body:   JSON.stringify(payload),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      const respBody = await response.json().catch(() => ({})) as {
        id?: string; numero?: string; message?: string; error?: string;
      };

      if (response.ok) {
        await this.prisma.client.item_notificacoes_esus.update({
          where: { id },
          data: {
            status:             'enviado',
            numero_notificacao: respBody?.id ?? respBody?.numero ?? null,
            resposta_api:       respBody as never,
            updated_at:         new Date(),
          },
        });
        wasHandled = true;
      } else {
        const errMsg = respBody?.message ?? respBody?.error ?? `HTTP ${response.status}`;
        await this.prisma.client.item_notificacoes_esus.update({
          where: { id },
          data: {
            status:        'erro',
            erro_mensagem: errMsg,
            resposta_api:  respBody as never,
            updated_at:    new Date(),
          },
        });
        wasHandled = true;
        throw new Error(errMsg);
      }
    } catch (err) {
      if (!wasHandled) {
        await this.prisma.client.item_notificacoes_esus.update({
          where: { id },
          data: {
            status:        'erro',
            erro_mensagem: err instanceof Error ? err.message : 'Erro desconhecido',
            updated_at:    new Date(),
          },
        }).catch(() => {});
      }
      throw err;
    }
  }
}
