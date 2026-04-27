import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { FocoRiscoException } from '../errors/foco-risco.exception';
import { FocoRiscoReadRepository } from '../repositories/foco-risco-read.repository';
import {
  consolidacaoFromFocoPayload,
  consolidacaoIndisponivel,
  pickMelhorVistoriaConsolidacao,
  vistoriaRowToConsolidacaoHttp,
  type FocoConsolidacaoHttp,
} from '../view-model/foco-consolidacao';
import { buildFocoSlaSnapshot, mapFocoStatusParaFaseSla } from '../view-model/foco-sla-snapshot';

const CONSOLIDACAO_VISTORIA_SELECT = {
  id: true,
  resultado_operacional: true,
  vulnerabilidade_domiciliar: true,
  alerta_saude: true,
  risco_socioambiental: true,
  risco_vetorial: true,
  prioridade_final: true,
  prioridade_motivo: true,
  dimensao_dominante: true,
  consolidacao_resumo: true,
  consolidacao_json: true,
  consolidacao_incompleta: true,
  consolidado_em: true,
  versao_regra_consolidacao: true,
  versao_pesos_consolidacao: true,
} as const;

@Injectable()
export class GetFocoRisco {
  constructor(
    private repository: FocoRiscoReadRepository,
    private prisma: PrismaService,
  ) {}

  async execute(id: string, clienteId: string | null) {
    const foco = await this.repository.findByIdComHistorico(id, clienteId);
    if (!foco) throw FocoRiscoException.notFound();

    const consolidacao = await this.resolveConsolidacao(foco);

    const fase = mapFocoStatusParaFaseSla(foco.status);

    const [slaOpRaw, cfg] = await Promise.all([
      this.prisma.client.sla_operacional.findFirst({
        where: { foco_risco_id: id, deleted_at: null },
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          inicio: true,
          prazo_final: true,
          violado: true,
          status: true,
        },
      }),
      fase
        ? this.prisma.client.sla_foco_config.findFirst({
            where: {
              cliente_id: foco.clienteId,
              fase,
              ativo: true,
            },
            select: { prazo_minutos: true },
          })
        : Promise.resolve(null),
    ]);

    const agora = new Date();
    const sla = buildFocoSlaSnapshot({
      foco,
      agora,
      prazoFaseMinutos: cfg?.prazo_minutos ?? null,
      slaOperacional: slaOpRaw,
    });

    return { foco, sla, consolidacao };
  }

  /**
   * Consolidação canônica está em `vistorias`. Carrega vistorias vinculadas ao foco
   * e/ou a vistoria de origem; escolhe a linha com dados analíticos mais completos.
   * Se não houver, tenta chaves legadas em `foco.payload`.
   */
  private async resolveConsolidacao(foco: {
    id?: string;
    clienteId: string;
    origemTipo: string;
    origemVistoriaId?: string;
    payload?: unknown;
  }): Promise<FocoConsolidacaoHttp> {
    const focoId = foco.id;
    if (!focoId) {
      return (
        consolidacaoFromFocoPayload(foco.payload, foco.origemTipo) ??
        consolidacaoIndisponivel(foco.origemTipo)
      );
    }

    const [vistoriasDoFoco, vistoriaOrigem] = await Promise.all([
      this.prisma.client.vistorias.findMany({
        where: {
          foco_risco_id: focoId,
          cliente_id: foco.clienteId,
          deleted_at: null,
        },
        select: CONSOLIDACAO_VISTORIA_SELECT,
        take: 40,
      }),
      foco.origemVistoriaId
        ? this.prisma.client.vistorias.findFirst({
            where: {
              id: foco.origemVistoriaId,
              cliente_id: foco.clienteId,
              deleted_at: null,
            },
            select: CONSOLIDACAO_VISTORIA_SELECT,
          })
        : Promise.resolve(null),
    ]);

    const candidatos = [...vistoriasDoFoco];
    if (
      vistoriaOrigem &&
      !candidatos.some((v) => v.id === vistoriaOrigem.id)
    ) {
      candidatos.push(vistoriaOrigem);
    }

    const melhor = pickMelhorVistoriaConsolidacao(candidatos);
    if (melhor) {
      return vistoriaRowToConsolidacaoHttp(melhor, foco.origemTipo);
    }

    return (
      consolidacaoFromFocoPayload(foco.payload, foco.origemTipo) ??
      consolidacaoIndisponivel(foco.origemTipo)
    );
  }
}
