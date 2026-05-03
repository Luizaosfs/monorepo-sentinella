import { Prisma } from '@prisma/client';
import {
  Vistoria,
  VistoriaCalha,
  VistoriaDeposito,
  VistoriaRisco,
  VistoriaSintoma,
} from 'src/modules/vistoria/entities/vistoria';

type RawDeposito = {
  id: string;
  vistoria_id: string;
  tipo: string;
  qtd_inspecionados: number | null;
  qtd_com_focos: number | null;
  qtd_eliminados: number | null;
  usou_larvicida: boolean | null;
  qtd_com_agua: number | null;
  eliminado: boolean | null;
  vedado: boolean | null;
  created_at: Date;
};

type RawSintoma = {
  id: string;
  vistoria_id: string;
  febre: boolean;
  manchas_vermelhas: boolean;
  dor_articulacoes: boolean;
  dor_cabeca: boolean;
  nausea: boolean;
  moradores_sintomas_qtd: number;
  gerou_caso_notificado_id: string | null;
  created_at: Date;
};

type RawRisco = {
  id: string;
  vistoria_id: string;
  menor_incapaz: boolean;
  idoso_incapaz: boolean;
  mobilidade_reduzida: boolean;
  acamado: boolean;
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
  outro_risco_vetorial: string | null;
  created_at: Date;
};

type RawCalha = {
  id: string;
  vistoria_id: string;
  posicao: string | null;
  condicao: string | null;
  com_foco: boolean | null;
  acessivel: boolean | null;
  tratamento_realizado: boolean | null;
  observacao: string | null;
  created_at: Date;
};

type RawVistoria = {
  id: string;
  cliente_id: string;
  imovel_id: string | null;
  agente_id: string;
  planejamento_id: string | null;
  ciclo: number;
  tipo_atividade: string;
  data_visita: Date;
  status: string;
  moradores_qtd: number | null;
  gravidas: number;
  idosos: number;
  criancas_7anos: number;
  lat_chegada: number | null;
  lng_chegada: number | null;
  checkin_em: Date | null;
  observacao: string | null;
  payload: unknown;
  created_at: Date;
  updated_at: Date;
  acesso_realizado: boolean;
  motivo_sem_acesso: string | null;
  proximo_horario_sugerido: string | null;
  observacao_acesso: string | null;
  foto_externa_url: string | null;
  origem_visita: string | null;
  habitat_selecionado: string | null;
  condicao_habitat: string | null;
  assinatura_responsavel_url: string | null;
  pendente_assinatura: boolean;
  pendente_foto: boolean;
  origem_offline: boolean;
  assinatura_public_id: string | null;
  foto_externa_public_id: string | null;
  idempotency_key: string | null;
  deleted_at: Date | null;
  deleted_by: string | null;
  created_by: string | null;
  foco_risco_id: string | null;
  resultado_operacional: string | null;
  vulnerabilidade_domiciliar: string | null;
  alerta_saude: string | null;
  risco_socioambiental: string | null;
  risco_vetorial: string | null;
  prioridade_final: string | null;
  prioridade_motivo: string | null;
  dimensao_dominante: string | null;
  consolidacao_resumo: string | null;
  consolidacao_json: unknown;
  consolidacao_incompleta: boolean;
  versao_regra_consolidacao: string | null;
  versao_pesos_consolidacao: string | null;
  consolidado_em: Date | null;
  reprocessado_em: Date | null;
  reprocessado_por: string | null;
  depositos?: RawDeposito[];
  sintomas?: RawSintoma[];
  riscos?: RawRisco[];
  calhas?: RawCalha[];
};

export class PrismaVistoriaMapper {
  static depositoToDomain(raw: RawDeposito): VistoriaDeposito {
    return {
      id: raw.id,
      vistoriaId: raw.vistoria_id,
      tipoDeposito: raw.tipo,
      quantidade: raw.qtd_inspecionados ?? undefined,
      qtdComFocos: raw.qtd_com_focos ?? undefined,
      qtdEliminados: raw.qtd_eliminados ?? undefined,
      usouLarvicida: raw.usou_larvicida ?? undefined,
      qtdComAgua: raw.qtd_com_agua ?? undefined,
      comLarva: raw.qtd_com_focos != null ? raw.qtd_com_focos > 0 : undefined,
      eliminado: raw.eliminado ?? undefined,
      vedado: raw.vedado ?? undefined,
      createdAt: raw.created_at,
    };
  }

  static sintomaToDomain(raw: RawSintoma): VistoriaSintoma {
    return {
      id: raw.id,
      vistoriaId: raw.vistoria_id,
      febre: raw.febre,
      manchasVermelhas: raw.manchas_vermelhas,
      dorArticulacoes: raw.dor_articulacoes,
      dorCabeca: raw.dor_cabeca,
      nausea: raw.nausea,
      moradoresSintomasQtd: raw.moradores_sintomas_qtd,
      gerouCasoNotificadoId: raw.gerou_caso_notificado_id ?? undefined,
      createdAt: raw.created_at,
    };
  }

  static riscoToDomain(raw: RawRisco): VistoriaRisco {
    return {
      id: raw.id,
      vistoriaId: raw.vistoria_id,
      menorIncapaz: raw.menor_incapaz,
      idosoIncapaz: raw.idoso_incapaz,
      mobilidadeReduzida: raw.mobilidade_reduzida,
      acamado: raw.acamado,
      depQuimico: raw.dep_quimico,
      riscoAlimentar: raw.risco_alimentar,
      riscoMoradia: raw.risco_moradia,
      criadouroAnimais: raw.criadouro_animais,
      lixo: raw.lixo,
      residuosOrganicos: raw.residuos_organicos,
      residuosQuimicos: raw.residuos_quimicos,
      residuosMedicos: raw.residuos_medicos,
      acumuloMaterialOrganico: raw.acumulo_material_organico,
      animaisSinaisLv: raw.animais_sinais_lv,
      caixaDestampada: raw.caixa_destampada,
      outroRiscoVetorial: raw.outro_risco_vetorial ?? undefined,
      createdAt: raw.created_at,
    };
  }

  static calhaToDomain(raw: RawCalha): VistoriaCalha {
    return {
      id: raw.id,
      vistoriaId: raw.vistoria_id,
      posicao: raw.posicao ?? undefined,
      condicao: raw.condicao ?? undefined,
      comFoco: raw.com_foco ?? undefined,
      acessivel: raw.acessivel ?? undefined,
      tratamentoRealizado: raw.tratamento_realizado ?? undefined,
      observacao: raw.observacao ?? undefined,
      createdAt: raw.created_at,
    };
  }

  static toDomain(raw: RawVistoria): Vistoria {
    return new Vistoria(
      {
        clienteId: raw.cliente_id,
        imovelId: raw.imovel_id ?? undefined,
        agenteId: raw.agente_id,
        planejamentoId: raw.planejamento_id ?? undefined,
        ciclo: raw.ciclo,
        tipoAtividade: raw.tipo_atividade,
        dataVisita: raw.data_visita,
        status: raw.status,
        moradoresQtd: raw.moradores_qtd ?? undefined,
        gravidas: raw.gravidas,
        idosos: raw.idosos,
        criancas7anos: raw.criancas_7anos,
        latChegada: raw.lat_chegada ?? undefined,
        lngChegada: raw.lng_chegada ?? undefined,
        checkinEm: raw.checkin_em ?? undefined,
        observacao: raw.observacao ?? undefined,
        payload: raw.payload as Record<string, unknown> | undefined,
        acessoRealizado: raw.acesso_realizado,
        motivoSemAcesso: raw.motivo_sem_acesso ?? undefined,
        proximoHorarioSugerido: raw.proximo_horario_sugerido ?? undefined,
        observacaoAcesso: raw.observacao_acesso ?? undefined,
        fotoExternaUrl: raw.foto_externa_url ?? undefined,
        origemVisita: raw.origem_visita ?? undefined,
        habitatSelecionado: raw.habitat_selecionado ?? undefined,
        condicaoHabitat: raw.condicao_habitat ?? undefined,
        assinaturaResponsavelUrl: raw.assinatura_responsavel_url ?? undefined,
        pendenteAssinatura: raw.pendente_assinatura,
        pendenteFoto: raw.pendente_foto,
        origemOffline: raw.origem_offline,
        assinaturaPublicId: raw.assinatura_public_id ?? undefined,
        fotoExternaPublicId: raw.foto_externa_public_id ?? undefined,
        idempotencyKey: raw.idempotency_key ?? undefined,
        focoRiscoId: raw.foco_risco_id ?? undefined,
        resultadoOperacional: raw.resultado_operacional ?? undefined,
        vulnerabilidadeDomiciliar: raw.vulnerabilidade_domiciliar ?? undefined,
        alertaSaude: raw.alerta_saude ?? undefined,
        riscoSocioambiental: raw.risco_socioambiental ?? undefined,
        riscoVetorial: raw.risco_vetorial ?? undefined,
        prioridadeFinal: raw.prioridade_final ?? undefined,
        prioridadeMotivo: raw.prioridade_motivo ?? undefined,
        dimensaoDominante: raw.dimensao_dominante ?? undefined,
        consolidacaoResumo: raw.consolidacao_resumo ?? undefined,
        consolidacaoJson: raw.consolidacao_json as
          | Record<string, unknown>
          | undefined,
        consolidacaoIncompleta: raw.consolidacao_incompleta,
        versaoRegraConsolidacao: raw.versao_regra_consolidacao ?? undefined,
        versaoPesosConsolidacao: raw.versao_pesos_consolidacao ?? undefined,
        consolidadoEm: raw.consolidado_em ?? undefined,
        reprocessadoEm: raw.reprocessado_em ?? undefined,
        reprocessadoPor: raw.reprocessado_por ?? undefined,
        depositos: raw.depositos?.map(PrismaVistoriaMapper.depositoToDomain),
        sintomas: raw.sintomas?.map(PrismaVistoriaMapper.sintomaToDomain),
        riscos: raw.riscos?.map(PrismaVistoriaMapper.riscoToDomain),
        calhas: raw.calhas?.map(PrismaVistoriaMapper.calhaToDomain),
      },
      {
        id: raw.id,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
        deletedAt: raw.deleted_at ?? undefined,
        createdBy: raw.created_by ?? undefined,
      },
    );
  }

  static toPrisma(entity: Vistoria) {
    return {
      cliente_id: entity.clienteId,
      imovel_id: entity.imovelId ?? null,
      agente_id: entity.agenteId,
      planejamento_id: entity.planejamentoId ?? null,
      ciclo: entity.ciclo,
      tipo_atividade: entity.tipoAtividade,
      data_visita: entity.dataVisita,
      status: entity.status,
      moradores_qtd: entity.moradoresQtd ?? null,
      gravidas: entity.gravidas,
      idosos: entity.idosos,
      criancas_7anos: entity.criancas7anos,
      lat_chegada: entity.latChegada ?? null,
      lng_chegada: entity.lngChegada ?? null,
      checkin_em: entity.checkinEm ?? null,
      observacao: entity.observacao ?? null,
      payload: (entity.payload ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      acesso_realizado: entity.acessoRealizado,
      motivo_sem_acesso: entity.motivoSemAcesso ?? null,
      proximo_horario_sugerido: entity.proximoHorarioSugerido ?? null,
      observacao_acesso: entity.observacaoAcesso ?? null,
      foto_externa_url: entity.fotoExternaUrl ?? null,
      origem_visita: entity.origemVisita ?? null,
      habitat_selecionado: entity.habitatSelecionado ?? null,
      condicao_habitat: entity.condicaoHabitat ?? null,
      assinatura_responsavel_url: entity.assinaturaResponsavelUrl ?? null,
      pendente_assinatura: entity.pendenteAssinatura,
      pendente_foto: entity.pendenteFoto,
      origem_offline: entity.origemOffline,
      assinatura_public_id: entity.assinaturaPublicId ?? null,
      foto_externa_public_id: entity.fotoExternaPublicId ?? null,
      idempotency_key: entity.idempotencyKey ?? null,
      foco_risco_id: entity.focoRiscoId ?? null,
      resultado_operacional: entity.resultadoOperacional ?? null,
      vulnerabilidade_domiciliar: entity.vulnerabilidadeDomiciliar ?? null,
      alerta_saude: entity.alertaSaude ?? null,
      risco_socioambiental: entity.riscoSocioambiental ?? null,
      risco_vetorial: entity.riscoVetorial ?? null,
      prioridade_final: entity.prioridadeFinal ?? null,
      prioridade_motivo: entity.prioridadeMotivo ?? null,
      dimensao_dominante: entity.dimensaoDominante ?? null,
      consolidacao_resumo: entity.consolidacaoResumo ?? null,
      consolidacao_json: (entity.consolidacaoJson ??
        Prisma.JsonNull) as Prisma.InputJsonValue,
      consolidacao_incompleta: entity.consolidacaoIncompleta,
      versao_regra_consolidacao: entity.versaoRegraConsolidacao ?? null,
      versao_pesos_consolidacao: entity.versaoPesosConsolidacao ?? null,
      consolidado_em: entity.consolidadoEm ?? null,
      reprocessado_em: entity.reprocessadoEm ?? null,
      reprocessado_por: entity.reprocessadoPor ?? null,
      created_by: entity.createdBy ?? null,
      updated_at: new Date(),
    };
  }

  static depositoToPrisma(dep: VistoriaDeposito & { vistoriaId: string; clienteId: string }) {
    return {
      vistoria_id: dep.vistoriaId,
      cliente_id: dep.clienteId,
      tipo: dep.tipoDeposito ?? '',
      qtd_inspecionados: dep.quantidade ?? 0,
      qtd_com_focos: dep.qtdComFocos ?? (dep.comLarva ? 1 : 0),
      qtd_eliminados: dep.qtdEliminados ?? 0,
      usou_larvicida: dep.usouLarvicida ?? dep.tratado ?? false,
      qtd_com_agua: dep.qtdComAgua ?? 0,
      eliminado: dep.eliminado ?? false,
      vedado: dep.vedado ?? false,
    };
  }

  static sintomaToPrisma(sint: VistoriaSintoma & { vistoriaId: string; clienteId: string }) {
    return {
      vistoria_id: sint.vistoriaId,
      cliente_id: sint.clienteId,
      febre: sint.febre,
      manchas_vermelhas: sint.manchasVermelhas,
      dor_articulacoes: sint.dorArticulacoes,
      dor_cabeca: sint.dorCabeca,
      nausea: sint.nausea,
      moradores_sintomas_qtd: sint.moradoresSintomasQtd,
    };
  }

  static riscoToPrisma(risco: VistoriaRisco & { vistoriaId: string; clienteId: string }) {
    return {
      vistoria_id: risco.vistoriaId,
      cliente_id: risco.clienteId,
      menor_incapaz: risco.menorIncapaz,
      idoso_incapaz: risco.idosoIncapaz,
      mobilidade_reduzida: risco.mobilidadeReduzida,
      acamado: risco.acamado,
      dep_quimico: risco.depQuimico,
      risco_alimentar: risco.riscoAlimentar,
      risco_moradia: risco.riscoMoradia,
      criadouro_animais: risco.criadouroAnimais,
      lixo: risco.lixo,
      residuos_organicos: risco.residuosOrganicos,
      residuos_quimicos: risco.residuosQuimicos,
      residuos_medicos: risco.residuosMedicos,
      acumulo_material_organico: risco.acumuloMaterialOrganico,
      animais_sinais_lv: risco.animaisSinaisLv,
      caixa_destampada: risco.caixaDestampada,
      outro_risco_vetorial: risco.outroRiscoVetorial ?? null,
    };
  }

  static calhaToPrisma(calha: VistoriaCalha & { vistoriaId: string; clienteId: string }) {
    return {
      vistoria_id: calha.vistoriaId,
      cliente_id: calha.clienteId,
      posicao: calha.posicao ?? 'frente',
      condicao: calha.condicao ?? 'limpa',
      com_foco: calha.comFoco ?? false,
      acessivel: calha.acessivel ?? true,
      tratamento_realizado: calha.tratamentoRealizado ?? false,
      observacao: calha.observacao ?? null,
    };
  }
}
