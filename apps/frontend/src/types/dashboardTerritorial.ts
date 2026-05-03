export interface DashboardTerritorialKpis {
  totalFocos: number;
  focosAtivos: number;
  focosResolvidos: number;
  focosDescartados: number;
  taxaResolucaoPct: number | null;
  vistoriasRealizadas: number;
  slaVencidos: number;
  calhasCriticas: number;
  calhasTratadas: number;
  calculadoEm: string;
}

export interface DashboardTerritorialBairroItem {
  bairro: string;
  totalFocos: number;
  focosAtivos: number;
  vistoriasRealizadas: number;
  slaVencidos: number;
}

export interface DashboardTerritorialRegiaoItem {
  regiaoId: string;
  regiaoNome: string;
  totalFocos: number;
  focosAtivos: number;
  vistoriasRealizadas: number;
}

export interface DashboardTerritorialPontoMapa {
  id: string;
  latitude: number;
  longitude: number;
  status: string;
  prioridade: string | null;
  peso: number;
}

export interface DashboardTerritorialDepositoTipo {
  tipo: string;
  qtdInspecionados: number;
  qtdComFocos: number;
  qtdEliminados: number;
  qtdComAgua: number;
}

export interface DashboardTerritorialDepositosPncd {
  totais: {
    inspecionados: number;
    comFoco: number;
    eliminados: number;
    comAgua: number;
  };
  porTipo: DashboardTerritorialDepositoTipo[];
}

export interface DashboardTerritorialFatoresRisco {
  menorIncapaz: number;
  idosoIncapaz: number;
  depQuimico: number;
  riscoAlimentar: number;
  riscoMoradia: number;
  criadouroAnimais: number;
  lixo: number;
  residuosOrganicos: number;
  animaisSinaisLv: number;
  caixaDestampada: number;
  mobilidadeReduzida: number;
  acamado: number;
}

export interface DashboardTerritorialMeta {
  totalPontosMapa: number;
  periodoInicio: string | null;
  periodoFim: string | null;
  pesoMapaRegra: string;
  filtros: {
    bairro: string | null;
    regiaoId: string | null;
    prioridade: string | null;
    status: string | null;
    agenteId: string | null;
  };
  observacoes: string[];
}

export interface DashboardTerritorialResponse {
  kpis: DashboardTerritorialKpis;
  rankingBairro: DashboardTerritorialBairroItem[];
  rankingRegiao: DashboardTerritorialRegiaoItem[];
  pontosMapa: DashboardTerritorialPontoMapa[];
  depositosPncd: DashboardTerritorialDepositosPncd;
  fatoresRisco: DashboardTerritorialFatoresRisco | null;
  meta: DashboardTerritorialMeta;
}

export interface DashboardTerritorialParams {
  dataInicio?: string;
  dataFim?: string;
  bairro?: string;
  regiaoId?: string;
  prioridade?: string;
  status?: string;
  agenteId?: string;
}
