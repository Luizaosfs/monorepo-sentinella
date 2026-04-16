import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { PushService } from './push.service';

@Injectable()
export class CanalCidadaoService {
  private readonly logger = new Logger(CanalCidadaoService.name);

  constructor(
    private prisma: PrismaService,
    private pushService: PushService,
  ) {}

  async processarDenuncia(focoId: string, clienteId: string): Promise<{ enviados: number }> {
    const foco = await this.prisma.client.focos_risco.findUnique({
      where: { id: focoId },
      select: {
        id: true,
        status: true,
        cliente_id: true,
        imovel: { select: { logradouro: true, bairro: true } },
      },
    });

    if (!foco) {
      this.logger.warn(`[processarDenuncia] Foco ${focoId} não encontrado`);
      return { enviados: 0 };
    }

    const endereco = [foco.imovel?.logradouro, foco.imovel?.bairro].filter(Boolean).join(', ') || 'endereço não informado';
    const titulo = 'Nova denúncia cidadão';
    const corpo = `Nova denúncia recebida no endereço: ${endereco}`;
    const url = `/gestor/focos/${focoId}`;

    const { enviados } = await this.pushService.enviarPush(
      foco.cliente_id,
      titulo,
      corpo,
      url,
    );

    this.logger.log(`[CanalCidadaoService.processarDenuncia] foco=${focoId} pushEnviados=${enviados}`);
    return { enviados };
  }
}
