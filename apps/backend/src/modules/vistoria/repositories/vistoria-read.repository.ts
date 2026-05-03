import { Injectable } from '@nestjs/common';
import { PaginationProps } from '@shared/dtos/pagination-body';

import { FilterVistoriaInput } from '../dtos/filter-vistoria.input';
import { Vistoria, VistoriaPaginated } from '../entities/vistoria';

export interface SintomaConsolidacao {
  febre: boolean;
  manchasVermelhas: boolean;
  dorArticulacoes: boolean;
  dorCabeca: boolean;
  moradoresSintomasQtd: number;
}

export interface RiscoConsolidacao {
  menorIncapaz: boolean;
  idosoIncapaz: boolean;
  depQuimico: boolean;
  riscoAlimentar: boolean;
  riscoMoradia: boolean;
  criadouroAnimais: boolean;
  lixo: boolean;
  residuosOrganicos: boolean;
  residuosQuimicos: boolean;
  residuosMedicos: boolean;
  acumuloMaterialOrganico: boolean;
  animaisSinaisLv: boolean;
  caixaDestampada: boolean;
  outroRiscoVetorial: string | null;
}

export interface DepositoAgregado {
  qtdComFocosTotal: number;
  qtdInspecionados: number;
}

export interface CalhaAgregada {
  comFoco: boolean;
  comAguaParada: boolean;
}

export interface VistoriaParaConsolidacao {
  imovelId: string | null;
  acessoRealizado: boolean;
  moradoresQtd: number | null;
  gravidas: number;
  idosos: number;
  criancas7anos: number;
  clienteId: string;
  consolidadoEm: Date | null;
  prioridadeFinal: string | null;
  dimensaoDominante: string | null;
  consolidacaoJson: Record<string, unknown> | null;
  versaoRegraConsolidacao: string | null;
  versaoPesosConsolidacao: string | null;
}

export interface DadosConsolidacao {
  vistoria: VistoriaParaConsolidacao;
  sintomas: SintomaConsolidacao | null;
  riscos: RiscoConsolidacao | null;
  depositos: DepositoAgregado;
  calhas: CalhaAgregada;
}

export interface VistoriaResumoVisual {
  id: string;
  data_visita: Date;
  status: string;
  acesso_realizado: boolean;
  motivo_sem_acesso: string | null;
  moradores_qtd: number | null;
  gravidas: number;
  idosos: number;
  criancas_7anos: number;
  origem_visita: string | null;
  habitat_selecionado: string | null;
  condicao_habitat: string | null;
  observacao: string | null;
  foto_externa_url: string | null;
  resultado_operacional: string | null;
  vulnerabilidade_domiciliar: string | null;
  alerta_saude: string | null;
  risco_socioambiental: string | null;
  risco_vetorial: string | null;
  prioridade_final: string | null;
  prioridade_motivo: string | null;
  dimensao_dominante: string | null;
  consolidacao_resumo: string | null;
  consolidacao_json: unknown | null;
  consolidacao_incompleta: boolean;
  versao_regra_consolidacao: string | null;
  versao_pesos_consolidacao: string | null;
  consolidado_em: Date | null;
  created_at: Date | null;
  depositos: Array<{
    tipo: string;
    qtd_inspecionados: number;
    qtd_com_focos: number;
    qtd_eliminados: number;
    qtd_com_agua: number;
    usou_larvicida: boolean;
    qtd_larvicida_g: number | null;
    eliminado: boolean;
    vedado: boolean;
  }>;
  sintomas: Array<{
    febre: boolean;
    manchas_vermelhas: boolean;
    dor_articulacoes: boolean;
    dor_cabeca: boolean;
    nausea: boolean;
    moradores_sintomas_qtd: number;
    gerou_caso_notificado_id: string | null;
  }>;
  calhas: Array<{
    posicao: string;
    condicao: string;
    com_foco: boolean;
    acessivel: boolean;
    tratamento_realizado: boolean;
    foto_url: string | null;
    observacao: string | null;
  }>;
  riscos: Array<{
    menor_incapaz: boolean;
    idoso_incapaz: boolean;
    dep_quimico: boolean;
    risco_alimentar: boolean;
    risco_moradia: boolean;
    criadouro_animais: boolean;
    lixo: boolean;
    residuos_organicos: boolean;
    residuos_quimicos: boolean;
    residuos_medicos: boolean;
    acumulo_material_organico: boolean;
    animais_sinais_lv: boolean;
    caixa_destampada: boolean;
    mobilidade_reduzida: boolean;
    acamado: boolean;
    outro_risco_vetorial: string | null;
  }>;
}

@Injectable()
export abstract class VistoriaReadRepository {
  abstract findById(id: string, clienteId: string | null): Promise<Vistoria | null>;
  abstract findByIdIncludingDeleted(id: string, clienteId: string | null): Promise<Vistoria | null>;
  abstract findByIdComDetalhes(id: string, clienteId: string | null): Promise<Vistoria | null>;
  abstract findAll(filters: FilterVistoriaInput): Promise<Vistoria[]>;
  abstract findPaginated(
    filters: FilterVistoriaInput,
    pagination: PaginationProps,
  ): Promise<VistoriaPaginated>;
  abstract count(filters: FilterVistoriaInput): Promise<number>;
  abstract findDadosParaConsolidacao(vistoriaId: string): Promise<DadosConsolidacao | null>;
  abstract countSemAcessoPorImovel(imovelId: string, desde?: Date): Promise<number>;
  abstract findCalhasByVistoriaId(
    vistoriaId: string,
  ): Promise<Array<{ id: string; fotoPublicId: string | null; fotoUrl: string | null }>>;
  abstract findResumoByFocoId(
    focoId: string,
    origemVistoriaId: string | null,
    clienteId: string | null,
  ): Promise<VistoriaResumoVisual | null>;
}
