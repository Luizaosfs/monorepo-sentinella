import { Injectable } from '@nestjs/common';

import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { CriarRunComItensInput } from '../dtos/criar-run-com-itens.body';

/**
 * Porte fiel da RPC `criar_pluvio_run_com_itens`: cria o
 * pluvio_operacional_run + todos os pluvio_operacional_item numa
 * ÚNICA transação (atomicidade — falha em qualquer item desfaz a run).
 *
 * Substitui o split frontend-orquestrado (POST /pluvio/runs +
 * POST /pluvio/items/bulk + PATCH .../total), que não era atômico e
 * passava pelo entity/mapper lossy de PluvioItem (perdia prob_*, chuva_72h/7d,
 * tendencia, prazo_acao etc.). Aqui grava as colunas reais direto via Prisma.
 */
@Injectable()
export class CriarRunComItens {
  constructor(private prisma: PrismaService) {}

  async execute(input: CriarRunComItensInput, clienteId: string) {
    const total = input.totalBairros ?? input.itens.length;

    const runId = await this.prisma.client.$transaction(async (tx) => {
      const run = await tx.pluvio_operacional_run.create({
        data: {
          cliente_id: clienteId,
          dt_ref: input.dtRef,
          dt_gerado: input.dtGerado ?? new Date(),
          total_bairros: total,
        },
        select: { id: true },
      });

      await tx.pluvio_operacional_item.createMany({
        data: input.itens.map((it) => ({
          run_id: run.id,
          bairro_id: it.bairroId ?? it.regiaoId ?? null,
          bairro_nome: it.bairroNome,
          classificacao_risco: it.classificacaoRisco,
          situacao_ambiental: it.situacaoAmbiental ?? null,
          chuva_24h_mm: it.chuva24hMm ?? null,
          chuva_72h_mm: it.chuva72hMm ?? null,
          chuva_7d_mm: it.chuva7dMm ?? null,
          dias_com_chuva_7d: it.diasComChuva7d ?? null,
          janela_sem_chuva: it.janelaSemChuva ?? null,
          persistencia_7d: it.persistencia7d ?? null,
          tendencia: it.tendencia ?? null,
          temp_media_c: it.tempMediaC ?? null,
          vento_medio_kmh: it.ventoMedioKmh ?? null,
          prob_label: it.probLabel ?? null,
          prob_base_min: it.probBaseMin ?? null,
          prob_base_max: it.probBaseMax ?? null,
          prob_final_min: it.probFinalMin ?? null,
          prob_final_max: it.probFinalMax ?? null,
          criadouro_ativo: it.criadouroAtivo ?? null,
          velocidade_ciclo: it.velocidadeCiclo ?? null,
          janela_emergencia_dias: it.janelaEmergenciaDias ?? null,
          prioridade_operacional: it.prioridadeOperacional,
          prazo_acao: it.prazoAcao ?? null,
        })),
      });

      return run.id;
    });

    return { id: runId, total };
  }
}
