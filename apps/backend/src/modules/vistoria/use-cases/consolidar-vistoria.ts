import { PesosConsolidacaoReadRepository } from '@modules/consolidacao-pesos-config/repositories/pesos-consolidacao-read.repository';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { CLS_USER_ID_KEY } from 'src/shared/interceptors/user-context.interceptor';

import {
  CalhaAgregada,
  DadosConsolidacao,
  DepositoAgregado,
  RiscoConsolidacao,
  SintomaConsolidacao,
  VistoriaParaConsolidacao,
} from '../repositories/vistoria-read.repository';
import { VistoriaReadRepository } from '../repositories/vistoria-read.repository';
import {
  ArquivamentoAnterior,
  ConsolidacaoDados,
  VistoriaWriteRepository,
} from '../repositories/vistoria-write.repository';

export interface ConsolidarVistoriaInput {
  vistoriaId: string;
  motivo: string;
}

const VERSAO_REGRA = '2.0.0';
const FALLBACK_LIMIAR_BM = new Prisma.Decimal('2.0');
const FALLBACK_LIMIAR_MA = new Prisma.Decimal('5.0');
const ZERO = new Prisma.Decimal('0');

@Injectable()
export class ConsolidarVistoria {
  private readonly logger = new Logger(ConsolidarVistoria.name);

  constructor(
    private readonly readRepo: VistoriaReadRepository,
    private readonly writeRepo: VistoriaWriteRepository,
    private readonly pesosRepo: PesosConsolidacaoReadRepository,
    private readonly cls: ClsService,
  ) {}

  async execute(input: ConsolidarVistoriaInput): Promise<void> {
    const dados = await this.readRepo.findDadosParaConsolidacao(input.vistoriaId);
    if (!dados) {
      throw new Error(
        `ConsolidarVistoria: vistoria_id ${input.vistoriaId} não encontrada`,
      );
    }

    const { vistoria } = dados;
    const userId = this.cls.get<string | undefined>(CLS_USER_ID_KEY) ?? undefined;

    let arquivar: ArquivamentoAnterior | undefined;
    if (vistoria.consolidadoEm != null) {
      arquivar = {
        prioridadeFinal: vistoria.prioridadeFinal ?? undefined,
        dimensaoDominante: vistoria.dimensaoDominante ?? undefined,
        consolidacaoJson: vistoria.consolidacaoJson ?? undefined,
        versaoRegra: vistoria.versaoRegraConsolidacao ?? undefined,
        versaoPesos: vistoria.versaoPesosConsolidacao ?? undefined,
        consolidadoEm: vistoria.consolidadoEm,
        motivo: input.motivo ?? 'reprocessamento automático sem motivo explícito',
        reprocessadoPor: userId,
      };
    }

    const [limiarBM, limiarMA] = await Promise.all([
      this.pesosRepo.findLimiar('limiar_baixo_medio', vistoria.clienteId),
      this.pesosRepo.findLimiar('limiar_medio_alto', vistoria.clienteId),
    ]);
    const limBM = limiarBM?.peso ?? FALLBACK_LIMIAR_BM;
    const limMA = limiarMA?.peso ?? FALLBACK_LIMIAR_MA;
    const versaoPesos = limiarBM?.versao ?? 'fallback';

    let semAcessoCount = 0;
    if (vistoria.imovelId) {
      semAcessoCount = await this.readRepo.countSemAcessoPorImovel(vistoria.imovelId);
    }

    let incompleta = false;

    const resultadoOp = this.calcularResultadoOperacional(
      vistoria.acessoRealizado,
      semAcessoCount,
    );

    if (resultadoOp === 'visitado') {
      if (!dados.sintomas) incompleta = true;
      if (!dados.riscos) incompleta = true;
      if (dados.depositos.qtdInspecionados === 0) incompleta = true;
    } else {
      incompleta = true;
    }

    const vulnDomiciliar = this.calcularVulnerabilidadeDomiciliar(
      resultadoOp,
      vistoria,
      dados.riscos,
    );

    const { alertaSaude, proporcaoSintomas } = this.calcularAlertaSaude(
      resultadoOp,
      vistoria,
      dados.sintomas,
    );

    const {
      riscoSocioambiental,
      scoreSocial,
      scoreSanitario,
      flagsAtivas,
      flagsSemPeso,
    } = await this.calcularRiscoSocioambiental(
      resultadoOp,
      vistoria,
      dados.riscos,
      limBM,
      limMA,
    );

    if (flagsSemPeso.length > 0) incompleta = true;
    const dadoInconsistente = flagsSemPeso.length > 0;

    const riscoVetorial = this.calcularRiscoVetorial(
      resultadoOp,
      dados.depositos,
      dados.calhas,
      dados.riscos,
    );

    const {
      prioridadeFinal,
      prioridadeMotivo,
      dimensaoDominante,
      overrideAtivado,
      fallbackAplicado,
    } = this.calcularPrioridadeFinal(
      resultadoOp,
      semAcessoCount,
      vulnDomiciliar,
      alertaSaude,
      riscoSocioambiental,
      riscoVetorial,
      incompleta,
      dados.sintomas !== null,
      dados.riscos !== null,
      dados.depositos.qtdInspecionados > 0,
    );

    const consolidacaoResumo = this.montarResumo(
      resultadoOp,
      vulnDomiciliar,
      alertaSaude,
      riscoSocioambiental,
      riscoVetorial,
      prioridadeFinal,
      incompleta,
    );

    const consolidacaoJson = this.montarJson(
      resultadoOp,
      vulnDomiciliar,
      alertaSaude,
      riscoSocioambiental,
      riscoVetorial,
      prioridadeFinal,
      prioridadeMotivo,
      dimensaoDominante,
      incompleta,
      overrideAtivado,
      fallbackAplicado,
      dadoInconsistente,
      semAcessoCount,
      proporcaoSintomas,
      scoreSocial,
      scoreSanitario,
      limBM,
      limMA,
      flagsAtivas,
      flagsSemPeso,
      versaoPesos,
      dados,
    );

    const consolidacaoDados: ConsolidacaoDados = {
      resultadoOperacional: resultadoOp,
      vulnerabilidadeDomiciliar: vulnDomiciliar,
      alertaSaude,
      riscoSocioambiental,
      riscoVetorial,
      prioridadeFinal,
      prioridadeMotivo,
      dimensaoDominante,
      consolidacaoResumo,
      consolidacaoJson,
      consolidacaoIncompleta: incompleta,
      versaoRegraConsolidacao: VERSAO_REGRA,
      versaoPesosConsolidacao: versaoPesos,
    };

    await this.writeRepo.salvarConsolidacao(input.vistoriaId, consolidacaoDados, arquivar);

    this.logger.log(
      `[ConsolidarVistoria] vistoriaId=${input.vistoriaId} prioridade=${prioridadeFinal} motivo="${input.motivo}"`,
    );
  }

  private calcularResultadoOperacional(
    acessoRealizado: boolean,
    semAcessoCount: number,
  ): string {
    if (acessoRealizado) return 'visitado';
    return semAcessoCount >= 2 ? 'sem_acesso_retorno' : 'sem_acesso';
  }

  private calcularVulnerabilidadeDomiciliar(
    resultadoOp: string,
    vistoria: VistoriaParaConsolidacao,
    riscos: RiscoConsolidacao | null,
  ): string {
    if (resultadoOp !== 'visitado') return 'inconclusivo';

    if (riscos && (riscos.menorIncapaz || riscos.idosoIncapaz)) return 'critica';

    if (
      (vistoria.gravidas || vistoria.idosos || vistoria.criancas7anos) &&
      riscos &&
      (riscos.riscoMoradia || riscos.riscoAlimentar || riscos.depQuimico)
    )
      return 'alta';

    if (
      vistoria.gravidas ||
      vistoria.idosos ||
      vistoria.criancas7anos ||
      (riscos && (riscos.depQuimico || riscos.riscoAlimentar || riscos.riscoMoradia))
    )
      return 'media';

    return 'baixa';
  }

  private calcularAlertaSaude(
    resultadoOp: string,
    vistoria: VistoriaParaConsolidacao,
    sintomas: SintomaConsolidacao | null,
  ): { alertaSaude: string; proporcaoSintomas: number } {
    if (resultadoOp !== 'visitado') {
      return { alertaSaude: 'inconclusivo', proporcaoSintomas: 0 };
    }
    if (!sintomas) return { alertaSaude: 'nenhum', proporcaoSintomas: 0 };

    let proporcao = 0;
    if (
      sintomas.moradoresSintomasQtd > 0 &&
      vistoria.moradoresQtd != null &&
      vistoria.moradoresQtd > 0
    ) {
      proporcao = sintomas.moradoresSintomasQtd / vistoria.moradoresQtd;
    }

    if (
      sintomas.febre ||
      sintomas.manchasVermelhas ||
      sintomas.dorArticulacoes ||
      sintomas.dorCabeca
    ) {
      return {
        alertaSaude: proporcao >= 0.5 ? 'urgente' : 'atencao',
        proporcaoSintomas: proporcao,
      };
    }
    if (sintomas.moradoresSintomasQtd > 0) {
      return { alertaSaude: 'atencao', proporcaoSintomas: proporcao };
    }
    return { alertaSaude: 'nenhum', proporcaoSintomas: proporcao };
  }

  private async calcularRiscoSocioambiental(
    resultadoOp: string,
    vistoria: VistoriaParaConsolidacao,
    riscos: RiscoConsolidacao | null,
    limiarBM: Prisma.Decimal,
    limiarMA: Prisma.Decimal,
  ): Promise<{
    riscoSocioambiental: string;
    scoreSocial: Prisma.Decimal;
    scoreSanitario: Prisma.Decimal;
    flagsAtivas: string[];
    flagsSemPeso: string[];
  }> {
    const empty = {
      riscoSocioambiental: '',
      scoreSocial: ZERO,
      scoreSanitario: ZERO,
      flagsAtivas: [] as string[],
      flagsSemPeso: [] as string[],
    };

    if (resultadoOp !== 'visitado') {
      return { ...empty, riscoSocioambiental: 'inconclusivo' };
    }
    if (!riscos) {
      return { ...empty, riscoSocioambiental: 'baixo' };
    }

    const flagsAtivas: string[] = [];
    if (riscos.menorIncapaz) flagsAtivas.push('menor_incapaz');
    if (riscos.idosoIncapaz) flagsAtivas.push('idoso_incapaz');
    if (riscos.depQuimico) flagsAtivas.push('dep_quimico');
    if (riscos.riscoAlimentar) flagsAtivas.push('risco_alimentar');
    if (riscos.riscoMoradia) flagsAtivas.push('risco_moradia');
    if (riscos.criadouroAnimais) flagsAtivas.push('criadouro_animais');
    if (riscos.lixo) flagsAtivas.push('lixo');
    if (riscos.residuosOrganicos) flagsAtivas.push('residuos_organicos');
    if (riscos.residuosQuimicos) flagsAtivas.push('residuos_quimicos');
    if (riscos.residuosMedicos) flagsAtivas.push('residuos_medicos');

    if (!flagsAtivas.length) {
      return { ...empty, riscoSocioambiental: 'baixo', flagsAtivas };
    }

    const [flagsSemPeso, { scoreSocial, scoreSanitario }] = await Promise.all([
      this.pesosRepo.findFlagsSemPeso(flagsAtivas, vistoria.clienteId),
      this.pesosRepo.calcularScoresEfetivos(flagsAtivas, vistoria.clienteId),
    ]);

    const scoreTotal = scoreSocial.add(scoreSanitario);
    let risco: string;
    if (scoreTotal.greaterThanOrEqualTo(limiarMA)) risco = 'alto';
    else if (scoreTotal.greaterThanOrEqualTo(limiarBM)) risco = 'medio';
    else risco = 'baixo';

    return {
      riscoSocioambiental: risco,
      scoreSocial,
      scoreSanitario,
      flagsAtivas,
      flagsSemPeso,
    };
  }

  private calcularRiscoVetorial(
    resultadoOp: string,
    depositos: DepositoAgregado,
    calhas: CalhaAgregada,
    riscos: RiscoConsolidacao | null,
  ): string {
    if (resultadoOp !== 'visitado') return 'inconclusivo';

    if (depositos.qtdComFocosTotal > 0 || calhas.comFoco) return 'critico';

    if (
      (riscos &&
        (riscos.acumuloMaterialOrganico ||
          riscos.animaisSinaisLv ||
          riscos.caixaDestampada ||
          (riscos.outroRiscoVetorial != null &&
            riscos.outroRiscoVetorial.trim().length > 0))) ||
      calhas.comAguaParada
    )
      return 'alto';

    if (depositos.qtdInspecionados > 0) return 'medio';

    return 'baixo';
  }

  private calcularPrioridadeFinal(
    resultadoOp: string,
    semAcessoCount: number,
    vulnDomiciliar: string,
    alertaSaude: string,
    riscoSocioambiental: string,
    riscoVetorial: string,
    incompleta: boolean,
    temSintomas: boolean,
    temRiscos: boolean,
    temDepositos: boolean,
  ): {
    prioridadeFinal: string;
    prioridadeMotivo: string;
    dimensaoDominante: string | null;
    overrideAtivado: boolean;
    fallbackAplicado: boolean;
  } {
    if (resultadoOp !== 'visitado') {
      if (semAcessoCount >= 5) {
        return {
          prioridadeFinal: 'P2',
          prioridadeMotivo: `Sem acesso recorrente: ${semAcessoCount} tentativas (≥5)`,
          dimensaoDominante: 'resultado_operacional',
          overrideAtivado: false,
          fallbackAplicado: false,
        };
      }
      if (semAcessoCount >= 3) {
        return {
          prioridadeFinal: 'P3',
          prioridadeMotivo: `Sem acesso recorrente: ${semAcessoCount} tentativas (≥3)`,
          dimensaoDominante: 'resultado_operacional',
          overrideAtivado: false,
          fallbackAplicado: false,
        };
      }
      return {
        prioridadeFinal: 'P4',
        prioridadeMotivo: `Sem acesso: ${semAcessoCount} tentativa(s) — dados insuficientes`,
        dimensaoDominante: 'resultado_operacional',
        overrideAtivado: false,
        fallbackAplicado: false,
      };
    }

    const riscoElevado =
      ['critico', 'alto'].includes(riscoVetorial) ||
      ['critica', 'alta'].includes(vulnDomiciliar) ||
      riscoSocioambiental === 'alto';

    if (alertaSaude === 'urgente' && riscoElevado) {
      return {
        prioridadeFinal: 'P1',
        prioridadeMotivo: 'Alerta de saúde urgente com risco elevado em outra dimensão',
        dimensaoDominante: 'alerta_saude',
        overrideAtivado: true,
        fallbackAplicado: false,
      };
    }

    if (alertaSaude === 'urgente' || (riscoVetorial === 'critico' && vulnDomiciliar === 'critica')) {
      if (alertaSaude === 'urgente') {
        return {
          prioridadeFinal: 'P2',
          prioridadeMotivo: 'Alerta de saúde urgente (proporção ≥50% de sintomáticos)',
          dimensaoDominante: 'alerta_saude',
          overrideAtivado: true,
          fallbackAplicado: false,
        };
      }
      return {
        prioridadeFinal: 'P2',
        prioridadeMotivo: 'Foco vetorial confirmado com vulnerabilidade crítica',
        dimensaoDominante: 'risco_vetorial',
        overrideAtivado: false,
        fallbackAplicado: false,
      };
    }

    if (
      ['critico', 'alto'].includes(riscoVetorial) ||
      riscoSocioambiental === 'alto' ||
      ['critica', 'alta'].includes(vulnDomiciliar)
    ) {
      if (riscoVetorial === 'critico') {
        return {
          prioridadeFinal: 'P3',
          prioridadeMotivo: 'Foco vetorial confirmado em depósito ou calha',
          dimensaoDominante: 'risco_vetorial',
          overrideAtivado: false,
          fallbackAplicado: false,
        };
      }
      if (vulnDomiciliar === 'critica') {
        return {
          prioridadeFinal: 'P3',
          prioridadeMotivo: 'Vulnerabilidade crítica: pessoa incapacitada no domicílio',
          dimensaoDominante: 'vulnerabilidade_domiciliar',
          overrideAtivado: false,
          fallbackAplicado: false,
        };
      }
      if (riscoSocioambiental === 'alto') {
        return {
          prioridadeFinal: 'P3',
          prioridadeMotivo: 'Risco socioambiental alto (score ≥ limiar_medio_alto)',
          dimensaoDominante: 'risco_socioambiental',
          overrideAtivado: false,
          fallbackAplicado: false,
        };
      }
      if (riscoVetorial === 'alto') {
        return {
          prioridadeFinal: 'P3',
          prioridadeMotivo: 'Risco vetorial alto: flags ativas sem foco confirmado',
          dimensaoDominante: 'risco_vetorial',
          overrideAtivado: false,
          fallbackAplicado: false,
        };
      }
      return {
        prioridadeFinal: 'P3',
        prioridadeMotivo: 'Vulnerabilidade domiciliar alta (população vulnerável + risco)',
        dimensaoDominante: 'vulnerabilidade_domiciliar',
        overrideAtivado: false,
        fallbackAplicado: false,
      };
    }

    if (
      riscoVetorial === 'medio' ||
      riscoSocioambiental === 'medio' ||
      vulnDomiciliar === 'media' ||
      alertaSaude === 'atencao'
    ) {
      if (alertaSaude === 'atencao') {
        return {
          prioridadeFinal: 'P4',
          prioridadeMotivo: 'Sintomas presentes abaixo do limiar de urgência',
          dimensaoDominante: 'alerta_saude',
          overrideAtivado: false,
          fallbackAplicado: false,
        };
      }
      if (riscoVetorial === 'medio') {
        return {
          prioridadeFinal: 'P4',
          prioridadeMotivo:
            'Depósitos inspecionados e negativos (inspeção ativa = P4 conservador)',
          dimensaoDominante: 'risco_vetorial',
          overrideAtivado: false,
          fallbackAplicado: false,
        };
      }
      if (riscoSocioambiental === 'medio') {
        return {
          prioridadeFinal: 'P4',
          prioridadeMotivo: 'Risco socioambiental médio (score entre limiares)',
          dimensaoDominante: 'risco_socioambiental',
          overrideAtivado: false,
          fallbackAplicado: false,
        };
      }
      return {
        prioridadeFinal: 'P4',
        prioridadeMotivo: 'Vulnerabilidade domiciliar média',
        dimensaoDominante: 'vulnerabilidade_domiciliar',
        overrideAtivado: false,
        fallbackAplicado: false,
      };
    }

    if (incompleta) {
      return {
        prioridadeFinal: 'P3',
        prioridadeMotivo: 'Consolidação incompleta: dados faltantes ou flag sem peso cadastrado',
        dimensaoDominante: null,
        overrideAtivado: false,
        fallbackAplicado: true,
      };
    }
    if (temDepositos || temRiscos || temSintomas) {
      return {
        prioridadeFinal: 'P5',
        prioridadeMotivo: 'Vistoria completa sem riscos identificados',
        dimensaoDominante: null,
        overrideAtivado: false,
        fallbackAplicado: true,
      };
    }
    return {
      prioridadeFinal: 'P4',
      prioridadeMotivo: 'Vistoria realizada sem preenchimento de depósitos ou riscos',
      dimensaoDominante: null,
      overrideAtivado: false,
      fallbackAplicado: true,
    };
  }

  private montarResumo(
    resultadoOp: string,
    vulnDomiciliar: string,
    alertaSaude: string,
    riscoSocioambiental: string,
    riscoVetorial: string,
    prioridadeFinal: string,
    incompleta: boolean,
  ): string {
    const left = (s: string, n: number) => s.substring(0, n);
    return (
      `${resultadoOp} | ` +
      `VD:${left(vulnDomiciliar, 5)} ` +
      `AS:${left(alertaSaude, 5)} ` +
      `SA:${left(riscoSocioambiental, 5)} ` +
      `RV:${left(riscoVetorial, 6)} ` +
      `→ ${prioridadeFinal}` +
      (incompleta ? ' [INCOMPLETO]' : '')
    );
  }

  private montarJson(
    resultadoOp: string,
    vulnDomiciliar: string,
    alertaSaude: string,
    riscoSocioambiental: string,
    riscoVetorial: string,
    prioridadeFinal: string,
    prioridadeMotivo: string,
    dimensaoDominante: string | null,
    incompleta: boolean,
    overrideAtivado: boolean,
    fallbackAplicado: boolean,
    dadoInconsistente: boolean,
    semAcessoCount: number,
    proporcaoSintomas: number,
    scoreSocial: Prisma.Decimal,
    scoreSanitario: Prisma.Decimal,
    limBM: Prisma.Decimal,
    limMA: Prisma.Decimal,
    flagsAtivas: string[],
    flagsSemPeso: string[],
    versaoPesos: string,
    dados: DadosConsolidacao,
  ): Record<string, unknown> {
    const { vistoria, sintomas, riscos, depositos, calhas } = dados;

    return {
      versao_regra: VERSAO_REGRA,
      versao_pesos: versaoPesos,
      consolidado_em: new Date().toISOString(),
      override_ativado: overrideAtivado,
      fallback_aplicado: fallbackAplicado,
      dado_inconsistente: dadoInconsistente,
      resultado_operacional: {
        resultado: resultadoOp,
        acesso_realizado: vistoria.acessoRealizado,
        sem_acesso_count: semAcessoCount,
      },
      vulnerabilidade_domiciliar: {
        resultado: vulnDomiciliar,
        gravidas: vistoria.gravidas,
        idosos: vistoria.idosos,
        criancas_7anos: vistoria.criancas7anos,
        menor_incapaz: riscos?.menorIncapaz ?? null,
        idoso_incapaz: riscos?.idosoIncapaz ?? null,
        dep_quimico: riscos?.depQuimico ?? null,
        risco_alimentar: riscos?.riscoAlimentar ?? null,
        risco_moradia: riscos?.riscoMoradia ?? null,
      },
      alerta_saude: {
        resultado: alertaSaude,
        moradores_qtd: vistoria.moradoresQtd,
        moradores_sintomas_qtd: sintomas?.moradoresSintomasQtd ?? null,
        proporcao_sintomas: proporcaoSintomas,
        febre: sintomas?.febre ?? null,
        manchas_vermelhas: sintomas?.manchasVermelhas ?? null,
        dor_articulacoes: sintomas?.dorArticulacoes ?? null,
        dor_cabeca: sintomas?.dorCabeca ?? null,
      },
      risco_socioambiental: {
        resultado: riscoSocioambiental,
        score_total: scoreSocial.add(scoreSanitario).toNumber(),
        score_social: scoreSocial.toNumber(),
        score_sanitario: scoreSanitario.toNumber(),
        limiar_baixo_medio: limBM.toNumber(),
        limiar_medio_alto: limMA.toNumber(),
        flags_ativas: flagsAtivas,
        flags_sem_peso: flagsSemPeso,
      },
      risco_vetorial: {
        resultado: riscoVetorial,
        dep_inspecionados: depositos.qtdInspecionados,
        dep_focos_total: depositos.qtdComFocosTotal,
        calha_com_foco: calhas.comFoco,
        calha_com_agua_parada: calhas.comAguaParada,
        acumulo_material_organico: riscos?.acumuloMaterialOrganico ?? null,
        animais_sinais_lv: riscos?.animaisSinaisLv ?? null,
        caixa_destampada: riscos?.caixaDestampada ?? null,
        outro_risco_vetorial: riscos?.outroRiscoVetorial ?? null,
      },
      prioridade: {
        final: prioridadeFinal,
        motivo: prioridadeMotivo,
        dimensao_dominante: dimensaoDominante,
        incompleta,
      },
      cobertura_dados: {
        tem_sintomas: sintomas !== null,
        tem_riscos: riscos !== null,
        tem_depositos: depositos.qtdInspecionados > 0,
      },
    };
  }
}
