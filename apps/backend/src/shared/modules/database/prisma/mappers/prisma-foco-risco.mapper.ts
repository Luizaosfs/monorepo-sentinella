import { Prisma, focos_risco as PrismaFocoRiscoModel, foco_risco_historico as PrismaFocoRiscoHistoricoModel } from '@prisma/client';
import {
  FocoRisco,
  FocoRiscoHistorico,
  FocoRiscoStatus,
} from 'src/modules/foco-risco/entities/foco-risco';

/** Tipo Prisma nativo com relação historico opcional (presente quando include: { historico: true }). */
type FocoRiscoRaw = PrismaFocoRiscoModel & {
  historico?: PrismaFocoRiscoHistoricoModel[];
  ultima_vistoria_em?: Date | null;
};

export class PrismaFocoRiscoMapper {
  static historicToDomain(raw: PrismaFocoRiscoHistoricoModel): FocoRiscoHistorico {
    return {
      id: raw.id,
      focoRiscoId: raw.foco_risco_id,
      clienteId: raw.cliente_id,
      statusAnterior: raw.status_anterior || undefined,
      statusNovo: raw.status_novo,
      alteradoPor: raw.alterado_por || undefined,
      alteradoEm: raw.alterado_em,
      tipoEvento: raw.tipo_evento || undefined,
      classificacaoAnterior: raw.classificacao_anterior || undefined,
      classificacaoNova: raw.classificacao_nova || undefined,
      motivo: raw.motivo || undefined,
    };
  }

  static toDomain(raw: FocoRiscoRaw): FocoRisco {
    return new FocoRisco(
      {
        clienteId: raw.cliente_id,
        imovelId: raw.imovel_id || undefined,
        regiaoId: raw.regiao_id || undefined,
        origemTipo: raw.origem_tipo,
        origemLevantamentoItemId: raw.origem_levantamento_item_id || undefined,
        origemVistoriaId: raw.origem_vistoria_id || undefined,
        status: raw.status as FocoRiscoStatus,
        prioridade: raw.prioridade || undefined,
        prioridadeOriginalAntesCaso: raw.prioridade_original_antes_caso || undefined,
        ciclo: raw.ciclo ?? undefined,
        latitude: raw.latitude || undefined,
        longitude: raw.longitude || undefined,
        enderecoNormalizado: raw.endereco_normalizado || undefined,
        suspeitaEm: raw.suspeita_em,
        dadosMinimosEm: raw.dados_minimos_em || undefined,
        inspecaoEm: raw.inspecao_em || undefined,
        confirmadoEm: raw.confirmado_em || undefined,
        resolvidoEm: raw.resolvido_em || undefined,
        responsavelId: raw.responsavel_id || undefined,
        desfecho: raw.desfecho || undefined,
        focoAnteriorId: raw.foco_anterior_id || undefined,
        casosIds: raw.casos_ids || [],
        observacao: raw.observacao || undefined,
        classificacaoInicial: raw.classificacao_inicial,
        scorePrioridade: raw.score_prioridade,
        codigoFoco: raw.codigo_foco || undefined,
        payload: raw.payload ?? undefined,
        historico: raw.historico?.map(PrismaFocoRiscoMapper.historicToDomain),
        ultimaVistoriaEm: raw.ultima_vistoria_em ?? null,
      },
      {
        id: raw.id,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
        deletedAt: raw.deleted_at || undefined,
        deletedBy: raw.deleted_by || undefined,
        createdBy: raw.created_by || undefined,
      },
    );
  }

  static toPrisma(entity: FocoRisco): Prisma.focos_riscoUncheckedCreateInput {
    return {
      cliente_id: entity.clienteId,
      imovel_id: entity.imovelId || null,
      regiao_id: entity.regiaoId || null,
      origem_tipo: entity.origemTipo,
      origem_levantamento_item_id: entity.origemLevantamentoItemId || null,
      origem_vistoria_id: entity.origemVistoriaId || null,
      status: entity.status,
      prioridade: entity.prioridade || null,
      prioridade_original_antes_caso: entity.prioridadeOriginalAntesCaso || null,
      ciclo: entity.ciclo ?? null,
      latitude: entity.latitude || null,
      longitude: entity.longitude || null,
      endereco_normalizado: entity.enderecoNormalizado || null,
      suspeita_em: entity.suspeitaEm,
      dados_minimos_em: entity.dadosMinimosEm || null,
      inspecao_em: entity.inspecaoEm || null,
      confirmado_em: entity.confirmadoEm || null,
      resolvido_em: entity.resolvidoEm || null,
      responsavel_id: entity.responsavelId || null,
      desfecho: entity.desfecho || null,
      foco_anterior_id: entity.focoAnteriorId || null,
      casos_ids: entity.casosIds,
      observacao: entity.observacao || null,
      classificacao_inicial: entity.classificacaoInicial,
      score_prioridade: entity.scorePrioridade,
      codigo_foco: entity.codigoFoco || null,
      payload: entity.payload !== undefined ? (entity.payload as Prisma.InputJsonValue) : undefined,
      created_by: entity.createdBy || null,
      updated_at: new Date(),
    };
  }

  static historicToPrisma(h: FocoRiscoHistorico): Prisma.foco_risco_historicoUncheckedCreateInput {
    return {
      foco_risco_id: h.focoRiscoId!,
      cliente_id: h.clienteId,
      status_anterior: h.statusAnterior ?? null,
      status_novo: h.statusNovo,
      alterado_por: h.alteradoPor ?? null,
      tipo_evento: h.tipoEvento ?? null,
      classificacao_anterior: h.classificacaoAnterior ?? null,
      classificacao_nova: h.classificacaoNova ?? null,
      motivo: h.motivo ?? null,
    };
  }
}
