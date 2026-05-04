import { FilterVistoriaInput } from '@modules/vistoria/dtos/filter-vistoria.input';
import {
  Vistoria,
  VistoriaPaginated,
} from '@modules/vistoria/entities/vistoria';
import {
  CalhaAgregada,
  DadosConsolidacao,
  DepositoAgregado,
  RiscoConsolidacao,
  SintomaConsolidacao,
  VistoriaParaConsolidacao,
  VistoriaResumoVisual,
} from '@modules/vistoria/repositories/vistoria-read.repository';
import { VistoriaReadRepository } from '@modules/vistoria/repositories/vistoria-read.repository';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationProps } from 'src/shared/dtos/pagination-body';
import { Paginate } from 'src/utils/pagination';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaVistoriaMapper } from '../../mappers/prisma-vistoria.mapper';
import { PrismaService } from '../../prisma.service';

const INCLUDE_DETALHES = {
  depositos: { where: { deleted_at: null } },
  sintomas:  { where: { deleted_at: null } },
  riscos:    { where: { deleted_at: null } },
  calhas:    { where: { deleted_at: null } },
};

const RESUMO_INCLUDE = {
  depositos: {
    where: { deleted_at: null },
    select: {
      tipo: true, qtd_inspecionados: true, qtd_com_focos: true, qtd_eliminados: true,
      qtd_com_agua: true, usou_larvicida: true, qtd_larvicida_g: true, eliminado: true, vedado: true,
    },
  },
  sintomas: {
    where: { deleted_at: null },
    select: {
      febre: true, manchas_vermelhas: true, dor_articulacoes: true, dor_cabeca: true,
      nausea: true, moradores_sintomas_qtd: true, gerou_caso_notificado_id: true,
    },
  },
  calhas: {
    where: { deleted_at: null },
    select: {
      posicao: true, condicao: true, com_foco: true, acessivel: true,
      tratamento_realizado: true, foto_url: true, observacao: true,
    },
  },
  riscos: {
    where: { deleted_at: null },
    select: {
      menor_incapaz: true, idoso_incapaz: true, dep_quimico: true, risco_alimentar: true,
      risco_moradia: true, criadouro_animais: true, lixo: true, residuos_organicos: true,
      residuos_quimicos: true, residuos_medicos: true, acumulo_material_organico: true,
      animais_sinais_lv: true, caixa_destampada: true, mobilidade_reduzida: true,
      acamado: true, outro_risco_vetorial: true,
    },
  },
  evidencias_depositos: {
    where: { status_upload: 'enviado' },
    select: {
      id: true, tipo_deposito: true, tipo_imagem: true,
      url_original: true, created_at: true,
    },
  },
};

@PrismaRepository(VistoriaReadRepository)
@Injectable()
export class PrismaVistoriaReadRepository implements VistoriaReadRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string, clienteId: string | null): Promise<Vistoria | null> {
    const raw = await this.prisma.client.vistorias.findFirst({
      where: { id, deleted_at: null, ...(clienteId != null && { cliente_id: clienteId }) },
    });
    return raw ? PrismaVistoriaMapper.toDomain(raw as any) : null;
  }

  async findByIdIncludingDeleted(id: string, clienteId: string | null): Promise<Vistoria | null> {
    const raw = await this.prisma.client.vistorias.findFirst({
      where: { id, ...(clienteId != null && { cliente_id: clienteId }) },
    });
    return raw ? PrismaVistoriaMapper.toDomain(raw as any) : null;
  }

  async findByIdComDetalhes(id: string, clienteId: string | null): Promise<Vistoria | null> {
    const raw = await this.prisma.client.vistorias.findFirst({
      where: { id, deleted_at: null, ...(clienteId != null && { cliente_id: clienteId }) },
      include: INCLUDE_DETALHES,
    });
    return raw ? PrismaVistoriaMapper.toDomain(raw as any) : null;
  }

  async findAll(filters: FilterVistoriaInput): Promise<Vistoria[]> {
    const rows = await this.prisma.client.vistorias.findMany({
      where: this.buildWhere(filters),
      orderBy: { created_at: 'desc' },
    });
    return rows.map((r) => PrismaVistoriaMapper.toDomain(r as any));
  }

  async findPaginated(
    filters: FilterVistoriaInput,
    { currentPage, perPage, orderKey, orderValue }: PaginationProps,
  ): Promise<VistoriaPaginated> {
    const where = this.buildWhere(filters);
    const [rows, count] = await this.prisma.client.$transaction([
      this.prisma.client.vistorias.findMany({
        where,
        skip: perPage * (currentPage - 1),
        take: perPage,
        orderBy: { [orderKey ?? 'created_at']: orderValue ?? 'desc' },
      }),
      this.prisma.client.vistorias.count({ where }),
    ]);
    const pagination = await Paginate(count, perPage, currentPage);
    return {
      items: rows.map((r) => PrismaVistoriaMapper.toDomain(r as any)),
      pagination,
    };
  }

  private buildWhere(filters: FilterVistoriaInput) {
    return {
      deleted_at: null,
      ...(filters.clienteId != null && { cliente_id: filters.clienteId }),
      ...(filters.imovelId && { imovel_id: filters.imovelId }),
      ...(filters.agenteId && { agente_id: filters.agenteId }),
      ...(filters.planejamentoId && {
        planejamento_id: filters.planejamentoId,
      }),
      ...(filters.ciclo && { ciclo: filters.ciclo }),
      ...(filters.tipoAtividade && { tipo_atividade: filters.tipoAtividade }),
      ...(filters.status && { status: filters.status }),
      ...(filters.focoRiscoId && { foco_risco_id: filters.focoRiscoId }),
      ...((filters.dataInicio || filters.dataFim) && {
        data_visita: {
          ...(filters.dataInicio && { gte: filters.dataInicio }),
          ...(filters.dataFim && { lte: filters.dataFim }),
        },
      }),
      ...(filters.createdAfter && { created_at: { gte: filters.createdAfter } }),
      ...(filters.acessoRealizado !== undefined && {
        acesso_realizado: filters.acessoRealizado,
      }),
    };
  }

  async count(filters: FilterVistoriaInput): Promise<number> {
    return this.prisma.client.vistorias.count({ where: this.buildWhere(filters) });
  }

  async findDadosParaConsolidacao(vistoriaId: string): Promise<DadosConsolidacao | null> {
    const v = await this.prisma.client.vistorias.findUnique({
      where: { id: vistoriaId },
      select: {
        imovel_id: true,
        acesso_realizado: true,
        moradores_qtd: true,
        gravidas: true,
        idosos: true,
        criancas_7anos: true,
        cliente_id: true,
        consolidado_em: true,
        prioridade_final: true,
        dimensao_dominante: true,
        consolidacao_json: true,
        versao_regra_consolidacao: true,
        versao_pesos_consolidacao: true,
      },
    });
    if (!v) return null;

    const vistoria: VistoriaParaConsolidacao = {
      imovelId: v.imovel_id ?? null,
      acessoRealizado: v.acesso_realizado ?? true,
      moradoresQtd: v.moradores_qtd ?? null,
      gravidas: v.gravidas ?? 0,
      idosos: v.idosos ?? 0,
      criancas7anos: v.criancas_7anos ?? 0,
      clienteId: v.cliente_id,
      consolidadoEm: v.consolidado_em ?? null,
      prioridadeFinal: v.prioridade_final ?? null,
      dimensaoDominante: v.dimensao_dominante ?? null,
      consolidacaoJson: (v.consolidacao_json as Record<string, unknown>) ?? null,
      versaoRegraConsolidacao: v.versao_regra_consolidacao ?? null,
      versaoPesosConsolidacao: v.versao_pesos_consolidacao ?? null,
    };

    const rawSintoma = await this.prisma.client.vistoria_sintomas.findFirst({
      where: { vistoria_id: vistoriaId, deleted_at: null },
      select: {
        febre: true,
        manchas_vermelhas: true,
        dor_articulacoes: true,
        dor_cabeca: true,
        moradores_sintomas_qtd: true,
      },
    });
    const sintomas: SintomaConsolidacao | null = rawSintoma
      ? {
          febre: rawSintoma.febre,
          manchasVermelhas: rawSintoma.manchas_vermelhas,
          dorArticulacoes: rawSintoma.dor_articulacoes,
          dorCabeca: rawSintoma.dor_cabeca,
          moradoresSintomasQtd: rawSintoma.moradores_sintomas_qtd,
        }
      : null;

    const rawRisco = await this.prisma.client.vistoria_riscos.findFirst({
      where: { vistoria_id: vistoriaId, deleted_at: null },
      select: {
        menor_incapaz: true,
        idoso_incapaz: true,
        dep_quimico: true,
        risco_alimentar: true,
        risco_moradia: true,
        criadouro_animais: true,
        lixo: true,
        residuos_organicos: true,
        residuos_quimicos: true,
        residuos_medicos: true,
        acumulo_material_organico: true,
        animais_sinais_lv: true,
        caixa_destampada: true,
        outro_risco_vetorial: true,
      },
    });
    const riscos: RiscoConsolidacao | null = rawRisco
      ? {
          menorIncapaz: rawRisco.menor_incapaz,
          idosoIncapaz: rawRisco.idoso_incapaz,
          depQuimico: rawRisco.dep_quimico,
          riscoAlimentar: rawRisco.risco_alimentar,
          riscoMoradia: rawRisco.risco_moradia,
          criadouroAnimais: rawRisco.criadouro_animais,
          lixo: rawRisco.lixo,
          residuosOrganicos: rawRisco.residuos_organicos,
          residuosQuimicos: rawRisco.residuos_quimicos,
          residuosMedicos: rawRisco.residuos_medicos,
          acumuloMaterialOrganico: rawRisco.acumulo_material_organico,
          animaisSinaisLv: rawRisco.animais_sinais_lv,
          caixaDestampada: rawRisco.caixa_destampada,
          outroRiscoVetorial: rawRisco.outro_risco_vetorial ?? null,
        }
      : null;

    const [depRows, calhaRows] = await Promise.all([
      this.prisma.client.$queryRaw<Array<{ focos: bigint; inspecionados: bigint }>>(Prisma.sql`
        SELECT
          COALESCE(SUM(qtd_com_focos), 0)::bigint AS focos,
          COALESCE(SUM(qtd_inspecionados), 0)::bigint AS inspecionados
        FROM vistoria_depositos
        WHERE vistoria_id = ${vistoriaId}::uuid
      `),
      this.prisma.client.$queryRaw<Array<{ com_foco: boolean; com_agua: boolean }>>(Prisma.sql`
        SELECT
          COALESCE(bool_or(com_foco), false) AS com_foco,
          COALESCE(bool_or(condicao = 'com_agua_parada'), false) AS com_agua
        FROM vistoria_calhas
        WHERE vistoria_id = ${vistoriaId}::uuid
          AND deleted_at IS NULL
      `),
    ]);

    const dep = depRows[0];
    const depositos: DepositoAgregado = {
      qtdComFocosTotal: dep ? Number(dep.focos) : 0,
      qtdInspecionados: dep ? Number(dep.inspecionados) : 0,
    };

    const calha = calhaRows[0];
    const calhas: CalhaAgregada = {
      comFoco: calha?.com_foco ?? false,
      comAguaParada: calha?.com_agua ?? false,
    };

    return { vistoria, sintomas, riscos, depositos, calhas };
  }

  async countSemAcessoPorImovel(imovelId: string, desde?: Date): Promise<number> {
    return this.prisma.client.vistorias.count({
      where: {
        imovel_id: imovelId,
        acesso_realizado: false,
        deleted_at: null,
        ...(desde && { created_at: { gte: desde } }),
      },
    });
  }

  async findCalhasByVistoriaId(vistoriaId: string) {
    const rows = await this.prisma.client.vistoria_calhas.findMany({
      where: { vistoria_id: vistoriaId },
      select: { id: true, foto_public_id: true, foto_url: true },
    });
    return rows.map((r) => ({
      id: r.id,
      fotoPublicId: r.foto_public_id ?? null,
      fotoUrl: r.foto_url ?? null,
    }));
  }

  async findResumoByFocoId(
    focoId: string,
    origemVistoriaId: string | null,
    clienteId: string | null,
  ): Promise<VistoriaResumoVisual | null> {
    const baseWhere = {
      deleted_at: null,
      ...(clienteId != null && { cliente_id: clienteId }),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let raw: any = null;

    if (origemVistoriaId) {
      raw = await this.prisma.client.vistorias.findFirst({
        where: { id: origemVistoriaId, ...baseWhere },
        include: RESUMO_INCLUDE,
      });
    }

    if (!raw) {
      raw = await this.prisma.client.vistorias.findFirst({
        where: { foco_risco_id: focoId, ...baseWhere },
        orderBy: { created_at: 'desc' },
        include: RESUMO_INCLUDE,
      });
    }

    return raw ? this.mapResumoVisual(raw) : null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapResumoVisual(raw: any): VistoriaResumoVisual {
    return {
      id: raw.id,
      data_visita: raw.data_visita,
      status: raw.status,
      acesso_realizado: raw.acesso_realizado ?? true,
      motivo_sem_acesso: raw.motivo_sem_acesso ?? null,
      moradores_qtd: raw.moradores_qtd ?? null,
      gravidas: raw.gravidas ?? 0,
      idosos: raw.idosos ?? 0,
      criancas_7anos: raw.criancas_7anos ?? 0,
      origem_visita: raw.origem_visita ?? null,
      habitat_selecionado: raw.habitat_selecionado ?? null,
      condicao_habitat: raw.condicao_habitat ?? null,
      observacao: raw.observacao ?? null,
      foto_externa_url: raw.foto_externa_url ?? null,
      resultado_operacional: raw.resultado_operacional ?? null,
      vulnerabilidade_domiciliar: raw.vulnerabilidade_domiciliar ?? null,
      alerta_saude: raw.alerta_saude ?? null,
      risco_socioambiental: raw.risco_socioambiental ?? null,
      risco_vetorial: raw.risco_vetorial ?? null,
      prioridade_final: raw.prioridade_final ?? null,
      prioridade_motivo: raw.prioridade_motivo ?? null,
      dimensao_dominante: raw.dimensao_dominante ?? null,
      consolidacao_resumo: raw.consolidacao_resumo ?? null,
      consolidacao_json: raw.consolidacao_json ?? null,
      consolidacao_incompleta: raw.consolidacao_incompleta ?? false,
      versao_regra_consolidacao: raw.versao_regra_consolidacao ?? null,
      versao_pesos_consolidacao: raw.versao_pesos_consolidacao ?? null,
      consolidado_em: raw.consolidado_em ?? null,
      created_at: raw.created_at ?? null,
      depositos: (raw.depositos ?? []).map((d: any) => ({
        tipo: d.tipo,
        qtd_inspecionados: d.qtd_inspecionados ?? 0,
        qtd_com_focos: d.qtd_com_focos ?? 0,
        qtd_eliminados: d.qtd_eliminados ?? 0,
        qtd_com_agua: d.qtd_com_agua ?? 0,
        usou_larvicida: d.usou_larvicida ?? false,
        qtd_larvicida_g: d.qtd_larvicida_g != null ? Number(d.qtd_larvicida_g) : null,
        eliminado: d.eliminado ?? false,
        vedado: d.vedado ?? false,
      })),
      sintomas: (raw.sintomas ?? []).map((s: any) => ({
        febre: s.febre,
        manchas_vermelhas: s.manchas_vermelhas,
        dor_articulacoes: s.dor_articulacoes,
        dor_cabeca: s.dor_cabeca,
        nausea: s.nausea,
        moradores_sintomas_qtd: s.moradores_sintomas_qtd ?? 0,
        gerou_caso_notificado_id: s.gerou_caso_notificado_id ?? null,
      })),
      calhas: (raw.calhas ?? []).map((c: any) => ({
        posicao: c.posicao,
        condicao: c.condicao,
        com_foco: c.com_foco ?? false,
        acessivel: c.acessivel ?? false,
        tratamento_realizado: c.tratamento_realizado ?? false,
        foto_url: c.foto_url ?? null,
        observacao: c.observacao ?? null,
      })),
      riscos: (raw.riscos ?? []).map((r: any) => ({
        menor_incapaz: r.menor_incapaz,
        idoso_incapaz: r.idoso_incapaz,
        dep_quimico: r.dep_quimico,
        risco_alimentar: r.risco_alimentar,
        risco_moradia: r.risco_moradia,
        criadouro_animais: r.criadouro_animais,
        lixo: r.lixo,
        residuos_organicos: r.residuos_organicos,
        residuos_quimicos: r.residuos_quimicos,
        residuos_medicos: r.residuos_medicos,
        acumulo_material_organico: r.acumulo_material_organico,
        animais_sinais_lv: r.animais_sinais_lv,
        caixa_destampada: r.caixa_destampada,
        mobilidade_reduzida: r.mobilidade_reduzida,
        acamado: r.acamado,
        outro_risco_vetorial: r.outro_risco_vetorial ?? null,
      })),
      evidencias_depositos: (raw.evidencias_depositos ?? []).map((e: any) => ({
        id: e.id as string,
        tipo_deposito: e.tipo_deposito as string,
        tipo_imagem: e.tipo_imagem as string,
        url_original: e.url_original as string,
        created_at: e.created_at as Date | null,
      })),
    };
  }
}
