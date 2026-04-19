import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class GetIntegracoes {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string) {
    return this.prisma.client.cliente_integracoes.findMany({
      where: { cliente_id: clienteId },
      select: {
        id: true,
        tipo: true,
        endpoint_url: true,
        codigo_ibge: true,
        unidade_saude_cnes: true,
        ambiente: true,
        ativo: true,
        ultima_sincronizacao: true,
        api_key_masked: true,
        created_at: true,
        updated_at: true,
        // api_key omitido — nunca expor ao frontend
      },
    });
  }
}
