import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

interface CorrelacaoRow {
  id: string;
  distancia_metros: number;
  drone_detectou_foco: boolean;
  campo_confirmou_foco: boolean | null;
  levantamento_item_id: string;
  endereco_curto: string | null;
  risco: string | null;
}

interface EvolucaoRow {
  mes: string;
  confirmados: number;
  com_confirmacao: number;
}

@Injectable()
export class YoloQualidadeResumo {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string | null) {
    const clienteFilter = clienteId
      ? Prisma.sql`WHERE vdc.cliente_id = ${clienteId}::uuid`
      : Prisma.sql``;

    const correlacoes = await this.prisma.client.$queryRaw<CorrelacaoRow[]>(Prisma.sql`
      SELECT
        vdc.id,
        vdc.distancia_metros,
        vdc.drone_detectou_foco,
        vdc.campo_confirmou_foco,
        vdc.levantamento_item_id,
        li.endereco_curto,
        li.risco
      FROM vistoria_drone_correlacao vdc
      LEFT JOIN levantamento_itens li ON li.id = vdc.levantamento_item_id
      ${clienteFilter}
      ORDER BY vdc.created_at DESC
      LIMIT 200
    `);

    const evolucaoRows = await this.prisma.client.$queryRaw<EvolucaoRow[]>(Prisma.sql`
      SELECT
        TO_CHAR(DATE_TRUNC('month', vdc.created_at), 'YYYY-MM') AS mes,
        COUNT(CASE WHEN vdc.campo_confirmou_foco = true THEN 1 END)::int AS confirmados,
        COUNT(CASE WHEN vdc.campo_confirmou_foco IS NOT NULL THEN 1 END)::int AS com_confirmacao
      FROM vistoria_drone_correlacao vdc
      ${clienteFilter}
      GROUP BY DATE_TRUNC('month', vdc.created_at)
      ORDER BY DATE_TRUNC('month', vdc.created_at) ASC
    `);

    const evolucao_mensal = evolucaoRows.map(row => ({
      mes: row.mes,
      precisao: Number(row.com_confirmacao) > 0
        ? Math.round((Number(row.confirmados) / Number(row.com_confirmacao)) * 100)
        : 0,
    }));

    const total = correlacoes.length;
    const comConfirmacao = correlacoes.filter(c => c.campo_confirmou_foco !== null);
    const confirmados = comConfirmacao.filter(c => c.campo_confirmou_foco === true).length;
    const precisao = comConfirmacao.length > 0
      ? Math.round((confirmados / comConfirmacao.length) * 100)
      : 0;
    const falsosPositivos = comConfirmacao.length > 0
      ? Math.round(((comConfirmacao.length - confirmados) / comConfirmacao.length) * 100)
      : 0;
    const droneDetectou = correlacoes.filter(c => c.drone_detectou_foco).length;
    const cobertura = droneDetectou > 0
      ? Math.round((comConfirmacao.length / droneDetectou) * 100)
      : 0;

    return {
      precisao_estimada:      precisao,
      taxa_falsos_positivos:  falsosPositivos,
      total_correlacoes:      total,
      cobertura,
      evolucao_mensal,
      correlacoes: correlacoes.map(c => ({
        id:                c.id,
        endereco:          c.endereco_curto ?? '—',
        risco_drone:       c.risco ?? '—',
        confirmado_campo:  c.campo_confirmou_foco,
        distancia_metros:  Number(c.distancia_metros),
      })),
    };
  }
}
