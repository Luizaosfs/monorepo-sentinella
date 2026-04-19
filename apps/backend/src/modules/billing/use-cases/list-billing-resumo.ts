import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

export interface BillingResumoRow {
  cliente_id: string;
  nome: string;
  periodo_inicio: Date;
  vistorias_mes: number;
  levantamentos_mes: number;
  itens_focos_mes: number;
  usuarios_ativos_mes: number;
  imoveis_total: number;
  calculado_em: Date;
}

@Injectable()
export class ListBillingResumo {
  constructor(private prisma: PrismaService) {}

  async execute(): Promise<BillingResumoRow[]> {
    return this.prisma.client.$queryRaw<BillingResumoRow[]>(Prisma.sql`
      SELECT DISTINCT ON (s.cliente_id)
        s.cliente_id,
        c.nome,
        s.periodo_inicio,
        s.vistorias_mes,
        s.levantamentos_mes,
        s.itens_focos_mes,
        s.usuarios_ativos_mes,
        s.imoveis_total,
        s.calculado_em
      FROM billing_usage_snapshot s
      JOIN clientes c ON c.id = s.cliente_id
      WHERE c.deleted_at IS NULL
      ORDER BY s.cliente_id, s.periodo_inicio DESC
    `);
  }
}
