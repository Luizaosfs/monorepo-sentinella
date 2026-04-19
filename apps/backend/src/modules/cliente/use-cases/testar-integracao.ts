import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class TestarIntegracao {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string): Promise<{ sucesso: boolean; erro?: string; info?: unknown }> {
    const integracao = await this.prisma.client.cliente_integracoes.findFirst({
      where: { cliente_id: clienteId, ativo: true },
      select: { id: true, api_key: true, endpoint_url: true, ambiente: true },
    });

    if (!integracao) {
      return { sucesso: false, erro: 'Nenhuma integração ativa encontrada para este cliente' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(`${integracao.endpoint_url}/health`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${integracao.api_key}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        return { sucesso: true, info: { status: res.status, ambiente: integracao.ambiente } };
      }

      return {
        sucesso: false,
        erro: `HTTP ${res.status}: ${res.statusText}`,
        info: { status: res.status },
      };
    } catch (err: unknown) {
      clearTimeout(timeout);
      const e = err as { name?: string; message?: string };
      if (e?.name === 'AbortError') {
        return { sucesso: false, erro: 'Timeout (8s) — servidor não respondeu' };
      }
      return { sucesso: false, erro: e?.message ?? 'Erro de rede desconhecido' };
    }
  }
}
