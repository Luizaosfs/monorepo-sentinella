import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { ImovelNuncaVisitadoDto } from '../view-model/cobertura.vm';

type RawRow = {
  id: string;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  quarteirao: string | null;
  agente_id: string | null;
  agente_nome: string | null;
  dias_sem_vistoria: number;
};

const LIMIT = 100;

@Injectable()
export class GetImoveisNuncaVisitadosUc {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string): Promise<ImovelNuncaVisitadoDto[]> {
    const cicloAtivo = await this.prisma.client.ciclos.findFirst({
      where: { cliente_id: clienteId, status: 'ativo' },
      select: { id: true },
    });

    const cicloId = cicloAtivo?.id ?? '00000000-0000-0000-0000-000000000000';

    const rows = await this.prisma.client.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT
        i.id,
        i.logradouro,
        i.numero,
        i.bairro,
        i.quarteirao,
        dq.agente_id,
        u.nome AS agente_nome,
        EXTRACT(DAY FROM NOW() - i.created_at)::int AS dias_sem_vistoria
      FROM imoveis i
      LEFT JOIN LATERAL (
        SELECT dq2.agente_id
        FROM bairros_distribuicao dq2
        JOIN bairros_quadras q2 ON q2.id = dq2.quadra_id
        WHERE q2.codigo = i.quarteirao
          AND dq2.cliente_id = i.cliente_id
          AND dq2.ciclo_id = ${cicloId}::uuid
        LIMIT 1
      ) dq ON true
      LEFT JOIN usuarios u ON u.id = dq.agente_id
      WHERE i.cliente_id = ${clienteId}::uuid
        AND i.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM vistorias v WHERE v.imovel_id = i.id AND v.deleted_at IS NULL
        )
      ORDER BY i.quarteirao NULLS LAST, i.logradouro
      LIMIT ${LIMIT}
    `);

    return rows.map(r => ({
      id: r.id,
      logradouro: r.logradouro,
      numero: r.numero,
      bairro: r.bairro,
      quarteirao: r.quarteirao,
      agenteId: r.agente_id,
      agenteNome: r.agente_nome,
      diasSemVistoria: Number(r.dias_sem_vistoria ?? 0),
    }));
  }
}
