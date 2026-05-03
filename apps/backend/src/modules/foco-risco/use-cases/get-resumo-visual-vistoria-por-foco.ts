import {
  VistoriaReadRepository,
  VistoriaResumoVisual,
} from '@modules/vistoria/repositories/vistoria-read.repository';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { ResumoVisualVistoriaResponse } from '../dtos/resumo-visual-vistoria.response';
import { FocoRiscoException } from '../errors/foco-risco.exception';

@Injectable()
export class GetResumoVisualVistoriaPorFoco {
  constructor(
    private prisma: PrismaService,
    private vistoriaReadRepo: VistoriaReadRepository,
  ) {}

  async execute(
    focoRiscoId: string,
    tenantId: string | null | undefined,
  ): Promise<ResumoVisualVistoriaResponse> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const foco: any = await this.prisma.client.focos_risco.findFirst({
      where: {
        id: focoRiscoId,
        deleted_at: null,
        ...(tenantId ? { cliente_id: tenantId } : {}),
      },
      include: { historico: { orderBy: { alterado_em: 'asc' } } },
    });
    if (!foco) throw FocoRiscoException.notFound();

    const [vistoria, operacoes] = await Promise.all([
      this.vistoriaReadRepo.findResumoByFocoId(
        foco.id,
        foco.origem_vistoria_id ?? null,
        tenantId ?? foco.cliente_id,
      ),
      this.prisma.client.operacoes.findMany({
        where: {
          foco_risco_id: foco.id,
          deleted_at: null,
          cliente_id: foco.cliente_id,
        },
        include: { evidencias: true },
        orderBy: { created_at: 'asc' },
      }),
    ]);

    return this.buildResponse(foco, vistoria, operacoes);
  }

  private buildResponse(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    foco: any,
    vistoria: VistoriaResumoVisual | null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    operacoes: any[],
  ): ResumoVisualVistoriaResponse {
    const focoOut: ResumoVisualVistoriaResponse['foco'] = {
      id: foco.id,
      codigoFoco: foco.codigo_foco ?? null,
      protocoloPublico: foco.protocolo_publico ?? null,
      status: foco.status,
      prioridade: foco.prioridade ?? null,
      scorePrioridade: foco.score_prioridade ?? 0,
      origemTipo: foco.origem_tipo,
      enderecoNormalizado: foco.endereco_normalizado ?? null,
      latitude: foco.latitude != null ? Number(foco.latitude) : null,
      longitude: foco.longitude != null ? Number(foco.longitude) : null,
      responsavelId: foco.responsavel_id ?? null,
      observacao: foco.observacao ?? null,
    };

    if (!vistoria) {
      return {
        foco: focoOut,
        vistoria: null,
        consolidacao: null,
        moradores: null,
        gruposVulneraveis: null,
        sintomas: null,
        depositosPncd: {
          itens: [],
          totais: { inspecionados: 0, comFocos: 0, eliminados: 0, comAgua: 0, comLarvicida: 0 },
        },
        calhas: {
          itens: [],
          resumo: {
            possuiCalhaComFoco: false,
            possuiAguaParada: false,
            possuiCalhaTratada: false,
            condicoesCriticas: [],
          },
        },
        fatoresRisco: null,
        tratamento: {
          larvicidaAplicado: false,
          totalLarvicidaG: 0,
          depositosEliminados: 0,
          depositosVedados: 0,
          calhasTratadas: 0,
        },
        resumoEstrategico: {
          moradoresExpostos: null,
          gruposVulneraveisQtd: 0,
          sintomasInformadosQtd: 0,
          depositosComFocoQtd: 0,
          depositosComAguaQtd: 0,
          calhasCriticasQtd: 0,
          fatoresRiscoAtivosQtd: 0,
        },
        explicabilidade: {
          motivos: [],
          alertas: [],
          pendencias: ['Nenhuma vistoria vinculada ao foco'],
        },
        evidencias: this.buildEvidencias(null, [], operacoes),
        historico: this.buildHistorico(null, foco.historico ?? [], operacoes),
      };
    }

    const sintomaRaw = vistoria.sintomas[0] ?? null;
    const riscoRaw = vistoria.riscos[0] ?? null;

    const moradores: ResumoVisualVistoriaResponse['moradores'] = {
      total: vistoria.moradores_qtd,
      criancas7Anos: vistoria.criancas_7anos,
      idosos: vistoria.idosos,
      gestantes: vistoria.gravidas,
    };

    const gruposVulneraveis: ResumoVisualVistoriaResponse['gruposVulneraveis'] = {
      idosos: vistoria.idosos > 0,
      criancas7Anos: vistoria.criancas_7anos > 0,
      gestantes: vistoria.gravidas > 0,
      mobilidadeReduzida: riscoRaw?.mobilidade_reduzida ?? false,
      acamado: riscoRaw?.acamado ?? false,
      menorIncapaz: riscoRaw?.menor_incapaz ?? false,
      idosoIncapaz: riscoRaw?.idoso_incapaz ?? false,
    };
    const gruposVulneraveisQtd = Object.values(gruposVulneraveis).filter(Boolean).length;

    const sintomas: ResumoVisualVistoriaResponse['sintomas'] = sintomaRaw
      ? {
          febre: sintomaRaw.febre,
          manchasVermelhas: sintomaRaw.manchas_vermelhas,
          dorArticulacoes: sintomaRaw.dor_articulacoes,
          dorCabeca: sintomaRaw.dor_cabeca,
          nausea: sintomaRaw.nausea,
          moradoresSintomasQtd: sintomaRaw.moradores_sintomas_qtd,
          gerouCasoNotificadoId: sintomaRaw.gerou_caso_notificado_id,
        }
      : null;
    const sintomasInformadosQtd = sintomas
      ? [sintomas.febre, sintomas.manchasVermelhas, sintomas.dorArticulacoes, sintomas.dorCabeca, sintomas.nausea].filter(Boolean).length
      : 0;

    const depositosItens = vistoria.depositos.map((d) => ({
      tipo: d.tipo,
      qtdInspecionados: d.qtd_inspecionados,
      qtdComFocos: d.qtd_com_focos,
      qtdEliminados: d.qtd_eliminados,
      qtdComAgua: d.qtd_com_agua,
      usouLarvicida: d.usou_larvicida,
      qtdLarvicidaG: d.qtd_larvicida_g,
      eliminado: d.eliminado,
      vedado: d.vedado,
    }));
    const totaisDepositos = depositosItens.reduce(
      (acc, d) => ({
        inspecionados: acc.inspecionados + d.qtdInspecionados,
        comFocos: acc.comFocos + d.qtdComFocos,
        eliminados: acc.eliminados + (d.eliminado ? 1 : 0),
        comAgua: acc.comAgua + d.qtdComAgua,
        comLarvicida: acc.comLarvicida + (d.usouLarvicida ? 1 : 0),
      }),
      { inspecionados: 0, comFocos: 0, eliminados: 0, comAgua: 0, comLarvicida: 0 },
    );

    const calhasItens = vistoria.calhas.map((c) => ({
      posicao: c.posicao,
      condicao: c.condicao,
      comFoco: c.com_foco,
      acessivel: c.acessivel,
      tratamentoRealizado: c.tratamento_realizado,
      fotoUrl: c.foto_url,
      observacao: c.observacao,
    }));
    const possuiCalhaComFoco = calhasItens.some((c) => c.comFoco);
    const possuiAguaParada = calhasItens.some((c) => c.condicao === 'com_agua_parada');
    const possuiCalhaTratada = calhasItens.some((c) => c.tratamentoRealizado);
    const calhasCriticas = calhasItens.filter((c) => c.comFoco || c.condicao === 'com_agua_parada');
    const condicoesCriticas = Array.from(new Set(calhasCriticas.map((c) => c.condicao)));

    const fatoresRisco: ResumoVisualVistoriaResponse['fatoresRisco'] = riscoRaw
      ? {
          menorIncapaz: riscoRaw.menor_incapaz,
          idosoIncapaz: riscoRaw.idoso_incapaz,
          depQuimico: riscoRaw.dep_quimico,
          riscoAlimentar: riscoRaw.risco_alimentar,
          riscoMoradia: riscoRaw.risco_moradia,
          criadouroAnimais: riscoRaw.criadouro_animais,
          lixo: riscoRaw.lixo,
          residuosOrganicos: riscoRaw.residuos_organicos,
          residuosQuimicos: riscoRaw.residuos_quimicos,
          residuosMedicos: riscoRaw.residuos_medicos,
          acumuloMaterialOrganico: riscoRaw.acumulo_material_organico,
          animaisSinaisLv: riscoRaw.animais_sinais_lv,
          caixaDestampada: riscoRaw.caixa_destampada,
          mobilidadeReduzida: riscoRaw.mobilidade_reduzida,
          acamado: riscoRaw.acamado,
          outroRiscoVetorial: riscoRaw.outro_risco_vetorial,
        }
      : null;
    const fatoresRiscoAtivosQtd = fatoresRisco
      ? Object.entries(fatoresRisco)
          .filter(([k, v]) => k !== 'outroRiscoVetorial' && v === true)
          .length + (fatoresRisco.outroRiscoVetorial ? 1 : 0)
      : 0;

    const tratamento: ResumoVisualVistoriaResponse['tratamento'] = {
      larvicidaAplicado: depositosItens.some((d) => d.usouLarvicida),
      totalLarvicidaG: depositosItens.reduce((sum, d) => sum + (d.qtdLarvicidaG ?? 0), 0),
      depositosEliminados: depositosItens.filter((d) => d.eliminado).length,
      depositosVedados: depositosItens.filter((d) => d.vedado).length,
      calhasTratadas: calhasItens.filter((c) => c.tratamentoRealizado).length,
    };

    // Consolidação — leitura direta dos campos gravados por ConsolidarVistoria, sem recalcular
    const consolidacao: ResumoVisualVistoriaResponse['consolidacao'] = {
      resultadoOperacional: vistoria.resultado_operacional,
      vulnerabilidadeDomiciliar: vistoria.vulnerabilidade_domiciliar,
      alertaSaude: vistoria.alerta_saude,
      riscoSocioambiental: vistoria.risco_socioambiental,
      riscoVetorial: vistoria.risco_vetorial,
      prioridadeFinal: vistoria.prioridade_final,
      prioridadeMotivo: vistoria.prioridade_motivo,
      dimensaoDominante: vistoria.dimensao_dominante,
      consolidacaoResumo: vistoria.consolidacao_resumo,
      consolidacaoJson: vistoria.consolidacao_json,
      consolidacaoIncompleta: vistoria.consolidacao_incompleta,
      versaoRegraConsolidacao: vistoria.versao_regra_consolidacao,
      versaoPesosConsolidacao: vistoria.versao_pesos_consolidacao,
      consolidadoEm: vistoria.consolidado_em ? vistoria.consolidado_em.toISOString() : null,
    };

    // Explicabilidade — regras determinísticas, uma condição por item
    const motivos: string[] = [];
    if (vistoria.prioridade_motivo) motivos.push(vistoria.prioridade_motivo);

    const alertas: string[] = [];
    if (vistoria.alerta_saude && vistoria.alerta_saude !== 'sem_alerta') {
      alertas.push(`Alerta de saúde: ${vistoria.alerta_saude}`);
    }
    if (sintomasInformadosQtd > 0) alertas.push(`${sintomasInformadosQtd} sintoma(s) relatado(s)`);
    if (gruposVulneraveisQtd > 0) alertas.push(`${gruposVulneraveisQtd} grupo(s) vulnerável(is) presente(s)`);
    if (totaisDepositos.comFocos > 0) alertas.push(`${totaisDepositos.comFocos} depósito(s) com foco identificado(s)`);
    if (possuiCalhaComFoco) alertas.push('Calha com foco identificada');
    if (possuiAguaParada) alertas.push('Calha com água parada identificada');
    if (fatoresRiscoAtivosQtd > 0) alertas.push(`${fatoresRiscoAtivosQtd} fator(es) de risco socioambiental presente(s)`);

    const pendencias: string[] = [];
    if (!vistoria.acesso_realizado) {
      pendencias.push(`Acesso não realizado: ${vistoria.motivo_sem_acesso ?? 'motivo não informado'}`);
    }
    if (!vistoria.consolidado_em) {
      pendencias.push('Vistoria ainda não consolidada — execute ConsolidarVistoria');
    } else if (vistoria.consolidacao_incompleta) {
      pendencias.push('Consolidação incompleta — dados insuficientes para classificação completa');
    }

    return {
      foco: focoOut,
      vistoria: {
        id: vistoria.id,
        dataVisita: vistoria.data_visita.toISOString(),
        status: vistoria.status,
        acessoRealizado: vistoria.acesso_realizado,
        motivoSemAcesso: vistoria.motivo_sem_acesso,
        moradoresQtd: vistoria.moradores_qtd,
        gravidas: vistoria.gravidas,
        idosos: vistoria.idosos,
        criancas7anos: vistoria.criancas_7anos,
        origemVisita: vistoria.origem_visita,
        habitatSelecionado: vistoria.habitat_selecionado,
        condicaoHabitat: vistoria.condicao_habitat,
        observacao: vistoria.observacao,
        fotoExternaUrl: vistoria.foto_externa_url,
      },
      consolidacao,
      moradores,
      gruposVulneraveis,
      sintomas,
      depositosPncd: { itens: depositosItens, totais: totaisDepositos },
      calhas: {
        itens: calhasItens,
        resumo: { possuiCalhaComFoco, possuiAguaParada, possuiCalhaTratada, condicoesCriticas },
      },
      fatoresRisco,
      tratamento,
      resumoEstrategico: {
        moradoresExpostos: moradores.total,
        gruposVulneraveisQtd,
        sintomasInformadosQtd,
        depositosComFocoQtd: totaisDepositos.comFocos,
        depositosComAguaQtd: totaisDepositos.comAgua,
        calhasCriticasQtd: calhasCriticas.length,
        fatoresRiscoAtivosQtd,
      },
      explicabilidade: { motivos, alertas, pendencias },
      evidencias: this.buildEvidencias(vistoria, calhasItens, operacoes),
      historico: this.buildHistorico(vistoria, foco.historico ?? [], operacoes),
    };
  }

  private buildEvidencias(
    vistoria: VistoriaResumoVisual | null,
    calhasItens: Array<{ fotoUrl: string | null; observacao: string | null; posicao: string }>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    operacoes: any[],
  ): ResumoVisualVistoriaResponse['evidencias'] {
    const evidencias: ResumoVisualVistoriaResponse['evidencias'] = [];

    if (vistoria?.foto_externa_url) {
      evidencias.push({
        tipo: 'foto',
        url: vistoria.foto_externa_url,
        legenda: 'Foto externa do imóvel',
        origem: 'vistoria',
        createdAt: vistoria.created_at ? vistoria.created_at.toISOString() : null,
      });
    }

    for (const calha of calhasItens) {
      if (calha.fotoUrl) {
        evidencias.push({
          tipo: 'foto',
          url: calha.fotoUrl,
          legenda: calha.observacao ?? `Calha - ${calha.posicao}`,
          origem: 'calha',
          createdAt: null,
        });
      }
    }

    for (const op of operacoes) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const ev of (op.evidencias ?? []) as any[]) {
        evidencias.push({
          tipo: 'foto',
          url: ev.image_url as string,
          legenda: (ev.legenda as string | null) ?? null,
          origem: 'operacao',
          createdAt: ev.created_at ? (ev.created_at as Date).toISOString() : null,
        });
      }
    }

    return evidencias;
  }

  private buildHistorico(
    vistoria: VistoriaResumoVisual | null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    focoHistorico: any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    operacoes: any[],
  ): ResumoVisualVistoriaResponse['historico'] {
    const historico: ResumoVisualVistoriaResponse['historico'] = [];

    for (const h of focoHistorico) {
      historico.push({
        tipo: h.tipo_evento ?? 'transicao_status',
        descricao: h.motivo ?? `${h.status_anterior ?? '—'} → ${h.status_novo}`,
        createdAt: (h.alterado_em as Date).toISOString(),
        origem: 'foco',
      });
    }

    if (vistoria) {
      if (vistoria.created_at) {
        historico.push({
          tipo: 'vistoria_criada',
          descricao: 'Vistoria registrada no sistema',
          createdAt: vistoria.created_at.toISOString(),
          origem: 'vistoria',
        });
      }
      historico.push({
        tipo: 'vistoria_realizada',
        descricao: 'Visita ao imóvel realizada',
        createdAt: vistoria.data_visita.toISOString(),
        origem: 'vistoria',
      });
      if (vistoria.consolidado_em) {
        historico.push({
          tipo: 'vistoria_consolidada',
          descricao: 'Vistoria consolidada',
          createdAt: vistoria.consolidado_em.toISOString(),
          origem: 'vistoria',
        });
      }
    }

    for (const op of operacoes) {
      historico.push({
        tipo: 'operacao_criada',
        descricao: `Operação criada (status: ${op.status})`,
        createdAt: (op.created_at as Date).toISOString(),
        origem: 'operacao',
      });
      if (op.concluido_em) {
        historico.push({
          tipo: 'operacao_concluida',
          descricao: 'Operação concluída',
          createdAt: (op.concluido_em as Date).toISOString(),
          origem: 'operacao',
        });
      }
    }

    historico.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return historico;
  }
}
