import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { QuarteiraoException } from '../errors/quarteirao.exception';

@Injectable()
export class EnsureAgentePodeAtuarNaQuadra {
  constructor(private prisma: PrismaService) {}

  async execute(
    clienteId: string,
    agenteId: string,
    imovelId: string,
  ): Promise<void> {
    const imovel = await this.prisma.client.imoveis.findFirst({
      where: { id: imovelId, cliente_id: clienteId, deleted_at: null },
      select: { quadra_id: true },
    });

    if (!imovel) throw QuarteiraoException.imovelNaoEncontrado();

    if (!imovel.quadra_id) throw QuarteiraoException.imovelSemQuadra();

    const dist = await this.prisma.client.bairros_distribuicao.findFirst({
      where: {
        cliente_id: clienteId,
        agente_id:  agenteId,
        quadra_id:  imovel.quadra_id,
        ciclo_id:   null,
      },
      select: { id: true },
    });

    if (!dist) throw QuarteiraoException.territorioNaoAtribuido();
  }
}
