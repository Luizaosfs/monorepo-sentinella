import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import {
  ImovelReincidenteDto,
  calcularCriticidadeImovel,
  parsePeriodo,
} from '../view-model/reincidencia.vm';

type RawRow = {
  imovel_id: string;
  endereco: string;
  bairro: string | null;
  quarteirao: string | null;
  total_ocorrencias: number;
  ultimo_foco_em: Date;
};

const LIMIT = 200;

@Injectable()
export class GetReincidenciaImoveisUc {
  constructor(private prisma: PrismaService) {}

  async execute(
    clienteId: string,
    dataInicio?: string,
    dataFim?: string,
  ): Promise<ImovelReincidenteDto[]> {
    const { inicio, fim } = parsePeriodo(dataInicio, dataFim);

    const rows = await this.prisma.client.$queryRaw<RawRow[]>(Prisma.sql`
      SELECT
        fr.imovel_id,
        CONCAT(
          COALESCE(i.logradouro, 'Endereço não informado'),
          CASE WHEN i.numero IS NOT NULL THEN ', ' || i.numero ELSE '' END
        ) AS endereco,
        i.bairro,
        i.quarteirao,
        COUNT(fr.id)::int          AS total_ocorrencias,
        MAX(fr.suspeita_em)        AS ultimo_foco_em
      FROM focos_risco fr
      JOIN imoveis i ON i.id = fr.imovel_id AND i.deleted_at IS NULL
      WHERE fr.cliente_id = ${clienteId}::uuid
        AND fr.imovel_id IS NOT NULL
        AND fr.status <> 'descartado'
        AND fr.deleted_at IS NULL
        AND fr.suspeita_em >= ${inicio}
        AND fr.suspeita_em <= ${fim}
      GROUP BY fr.imovel_id, i.logradouro, i.numero, i.bairro, i.quarteirao
      HAVING COUNT(fr.id) >= 2
      ORDER BY total_ocorrencias DESC, ultimo_foco_em DESC
      LIMIT ${LIMIT}
    `);

    return rows.map(r => ({
      imovelId: r.imovel_id,
      endereco: r.endereco,
      bairro: r.bairro,
      quarteirao: r.quarteirao,
      totalOcorrencias: Number(r.total_ocorrencias),
      ultimoFocoEm: r.ultimo_foco_em.toISOString(),
      criticidade: calcularCriticidadeImovel(Number(r.total_ocorrencias)),
    }));
  }
}
