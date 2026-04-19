import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class ListAlertasByAgente {
  constructor(private prisma: PrismaService) {}

  execute(clienteId: string, agenteId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      SELECT
        a.id,
        a.cliente_id,
        a.imovel_id,
        a.agente_id,
        a.ciclo,
        a.vistoria_id,
        a.motivo,
        a.retorno_em,
        a.resolvido,
        a.resolvido_em,
        a.created_at,
        im.numero    AS imovel_numero,
        im.logradouro AS imovel_logradouro,
        im.bairro    AS imovel_bairro
      FROM alerta_retorno_imovel a
      JOIN imoveis im ON im.id = a.imovel_id AND im.deleted_at IS NULL
      WHERE a.cliente_id = ${clienteId}::uuid
        AND a.agente_id  = ${agenteId}::uuid
        AND a.resolvido  = false
      ORDER BY a.retorno_em ASC
    `);
  }
}
