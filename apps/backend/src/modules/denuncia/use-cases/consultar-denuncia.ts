import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class ConsultarDenuncia {
  constructor(private prisma: PrismaService) {}

  async execute(protocolo: string): Promise<unknown> {
    const focos = await this.prisma.client.$queryRaw<Array<{
      id: string;
      status: string;
      created_at: Date;
      cliente_nome: string | null;
    }>>`
      SELECT
        f.id::text        AS id,
        f.status::text    AS status,
        f.created_at,
        c.nome            AS cliente_nome
      FROM focos_risco f
      LEFT JOIN clientes c ON c.id = f.cliente_id
      WHERE f.protocolo_publico = ${protocolo}
        AND f.origem_tipo = 'cidadao'
        AND f.deleted_at IS NULL
      LIMIT 1
    `;
    return focos[0] ?? null;
  }
}
