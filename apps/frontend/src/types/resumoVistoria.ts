export interface ResumoVisualVistoriaResponse {
  foco: {
    id: string;
    codigoFoco: string | null;
    protocoloPublico: string | null;
    status: string;
    prioridade: string | null;
    scorePrioridade: number;
    origemTipo: string;
    enderecoNormalizado: string | null;
    latitude: number | null;
    longitude: number | null;
    responsavelId: string | null;
    observacao: string | null;
  };

  vistoria: {
    id: string;
    dataVisita: string;
    status: string;
    acessoRealizado: boolean;
    motivoSemAcesso: string | null;
    moradoresQtd: number | null;
    gravidas: number;
    idosos: number;
    criancas7anos: number;
    origemVisita: string | null;
    habitatSelecionado: string | null;
    condicaoHabitat: string | null;
    observacao: string | null;
    fotoExternaUrl: string | null;
  } | null;

  consolidacao: {
    resultadoOperacional: string | null;
    vulnerabilidadeDomiciliar: string | null;
    alertaSaude: string | null;
    riscoSocioambiental: string | null;
    riscoVetorial: string | null;
    prioridadeFinal: string | null;
    prioridadeMotivo: string | null;
    dimensaoDominante: string | null;
    consolidacaoResumo: string | null;
    consolidacaoJson: unknown | null;
    consolidacaoIncompleta: boolean;
    versaoRegraConsolidacao: string | null;
    versaoPesosConsolidacao: string | null;
    consolidadoEm: string | null;
  } | null;

  moradores: {
    total: number | null;
    criancas7Anos: number;
    idosos: number;
    gestantes: number;
  } | null;

  gruposVulneraveis: {
    idosos: boolean;
    criancas7Anos: boolean;
    gestantes: boolean;
    mobilidadeReduzida: boolean;
    acamado: boolean;
    menorIncapaz: boolean;
    idosoIncapaz: boolean;
  } | null;

  sintomas: {
    febre: boolean;
    manchasVermelhas: boolean;
    dorArticulacoes: boolean;
    dorCabeca: boolean;
    nausea: boolean;
    moradoresSintomasQtd: number;
    gerouCasoNotificadoId: string | null;
  } | null;

  depositosPncd: {
    itens: Array<{
      tipo: string;
      qtdInspecionados: number;
      qtdComFocos: number;
      qtdEliminados: number;
      qtdComAgua: number;
      usouLarvicida: boolean;
      qtdLarvicidaG: number | null;
      eliminado: boolean;
      vedado: boolean;
    }>;
    totais: {
      inspecionados: number;
      comFocos: number;
      eliminados: number;
      comAgua: number;
      comLarvicida: number;
    };
  };

  calhas: {
    itens: Array<{
      posicao: string;
      condicao: string;
      comFoco: boolean;
      acessivel: boolean;
      tratamentoRealizado: boolean;
      fotoUrl: string | null;
      observacao: string | null;
    }>;
    resumo: {
      possuiCalhaComFoco: boolean;
      possuiAguaParada: boolean;
      possuiCalhaTratada: boolean;
      condicoesCriticas: string[];
    };
  };

  fatoresRisco: {
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
    mobilidadeReduzida: boolean;
    acamado: boolean;
    outroRiscoVetorial: string | null;
  } | null;

  tratamento: {
    larvicidaAplicado: boolean;
    totalLarvicidaG: number;
    depositosEliminados: number;
    depositosVedados: number;
    calhasTratadas: number;
  };

  resumoEstrategico: {
    moradoresExpostos: number | null;
    gruposVulneraveisQtd: number;
    sintomasInformadosQtd: number;
    depositosComFocoQtd: number;
    depositosComAguaQtd: number;
    calhasCriticasQtd: number;
    fatoresRiscoAtivosQtd: number;
  };

  explicabilidade: {
    motivos: string[];
    alertas: string[];
    pendencias: string[];
  };

  evidencias: Array<{
    tipo: string;
    url: string;
    legenda: string | null;
    origem: string;
    createdAt: string | null;
  }>;

  historico: Array<{
    tipo: string;
    descricao: string;
    createdAt: string;
    origem: string;
  }>;
}
