import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { type EnviarEsusInput } from '../dtos/create-notificacao.body';
import { montarPayloadESUS } from '../helpers/sinan-backend';

@Injectable()
export class EnviarEsus {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string, input: EnviarEsusInput, userId?: string | null) {
    const integracao = await this.prisma.client.cliente_integracoes.findFirst({
      where: { cliente_id: clienteId, ativo: true },
    });
    if (!integracao) throw new Error('Integração e-SUS não configurada ou inativa para este cliente');

    const payload = montarPayloadESUS(
      {
        enderecoCompleto:   input.enderecoCompleto,
        enderecoCurto:      input.enderecoCurto,
        latitude:           input.latitude,
        longitude:          input.longitude,
        dataHora:           input.dataHora,
        dataInicioSintomas: input.dataInicioSintomas,
      },
      integracao.codigo_ibge          ?? '',
      integracao.unidade_saude_cnes   ?? '',
      input.tipoAgravo,
    );

    const registro = await this.prisma.client.item_notificacoes_esus.create({
      data: {
        cliente_id:           clienteId,
        levantamento_item_id: input.levantamentoItemId ?? null,
        tipo_agravo:          input.tipoAgravo,
        status:               'pendente',
        payload_enviado:      payload as never,
        enviado_por:          userId ?? null,
      },
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
        const updated = await this.prisma.client.item_notificacoes_esus.update({
          where: { id: registro.id },
          data: {
            status:             'enviado',
            numero_notificacao: respBody?.id ?? respBody?.numero ?? null,
            resposta_api:       respBody as never,
            updated_at:         new Date(),
          },
        });
        wasHandled = true;
        return updated;
      } else {
        const errMsg = respBody?.message ?? respBody?.error ?? `HTTP ${response.status}`;
        await this.prisma.client.item_notificacoes_esus.update({
          where: { id: registro.id },
          data: {
            status:       'erro',
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
          where: { id: registro.id },
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
