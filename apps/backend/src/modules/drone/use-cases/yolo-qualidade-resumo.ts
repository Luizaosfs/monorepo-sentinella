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

@Injectable()
export class YoloQualidadeResumo {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string) {
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
      WHERE vdc.cliente_id = ${clienteId}::uuid
      ORDER BY vdc.created_at DESC
      LIMIT 200
    `);

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
      evolucao_mensal:        [] as { mes: string; precisao: number }[],
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
