export interface ImplantacaoStatusDto {
  clienteId: string;
  cicloAtivo: {
    existe: boolean;
    id?: string;
    numero?: number;
    ano?: number;
    status?: string;
  };
  territorio: {
    totalQuarteiroes: number;
    quarteiroesComAgente: number;
    quarteiroesSemAgente: number;
    percentualDistribuido: number;
  };
  agentes: {
    totalAgentesAtivos: number;
    agentesComQuarteirao: number;
    agentesSemQuarteirao: number;
  };
  planejamentoInicial: {
    existe: boolean;
    id?: string;
    nome?: string;
    ativo?: boolean;
    tipo?: string;
  };
  operacaoInicial: {
    existe: boolean;
    totalImoveisElegiveis: number;
    totalImoveisJaVisitadosNoCiclo: number;
    totalImoveisPendentes: number;
    agentesComRotaInicial: number;
    agentesSemRotaInicial: number;
    podeGerar: boolean;
    bloqueios: string[];
  };
  operacao: {
    podeIniciar: boolean;
    bloqueios: string[];
    proximasAcoes: string[];
  };
}

export interface ImplantacaoStatusRawData {
  clienteId: string;
  cicloAtivo: { id: string; numero: number; ano: number; status: string } | null;
  totalQuarteiroes: number;
  quarteiroesComAgente: number;
  totalAgentesAtivos: number;
  agentesComQuarteirao: number;
  planejamento: {
    id: string;
    descricao: string | null;
    ativo: boolean;
    tipo_levantamento?: string;
  } | null;
  totalImoveisElegiveis: number;
  totalImoveisJaVisitadosNoCiclo: number;
}

export class ImplantacaoStatusVM {
  static toHttp(data: ImplantacaoStatusRawData): ImplantacaoStatusDto {
    const bloqueios: string[] = [];
    const proximasAcoes: string[] = [];

    if (!data.cicloAtivo) {
      bloqueios.push('Nenhum ciclo ativo encontrado');
      proximasAcoes.push('Criar e ativar um ciclo em Gestão de Ciclos');
    }

    if (data.totalAgentesAtivos === 0) {
      bloqueios.push('Nenhum agente ativo cadastrado');
      proximasAcoes.push('Cadastrar agentes em Usuários');
    }

    if (data.totalQuarteiroes === 0) {
      bloqueios.push('Nenhum quarteirão cadastrado');
      proximasAcoes.push('Cadastrar quarteirões antes de distribuir');
    } else if (data.quarteiroesComAgente === 0) {
      bloqueios.push('Nenhum quarteirão distribuído para agentes');
      proximasAcoes.push('Distribuir quarteirões em Distribuição de Quarteirão');
    }

    if (!data.planejamento) {
      proximasAcoes.push('Criar planejamento inicial de levantamento');
    }

    // operacaoInicial — bloqueios próprios (inclui imóveis)
    const operacaoInicialBloqueios: string[] = [];
    if (!data.cicloAtivo) {
      operacaoInicialBloqueios.push('Nenhum ciclo ativo encontrado');
    }
    if (data.totalAgentesAtivos === 0) {
      operacaoInicialBloqueios.push('Nenhum agente ativo cadastrado');
    }
    if (data.quarteiroesComAgente === 0) {
      operacaoInicialBloqueios.push('Nenhum quarteirão distribuído para agentes');
    }
    if (data.totalImoveisElegiveis === 0) {
      operacaoInicialBloqueios.push('Nenhum imóvel nos quarteirões distribuídos');
    }

    const quarteiroesSemAgente = Math.max(0, data.totalQuarteiroes - data.quarteiroesComAgente);
    const percentualDistribuido =
      data.totalQuarteiroes > 0
        ? Math.round((data.quarteiroesComAgente / data.totalQuarteiroes) * 100)
        : 0;

    const agentesSemQuarteirao = Math.max(0, data.totalAgentesAtivos - data.agentesComQuarteirao);
    const totalImoveisPendentes = Math.max(
      0,
      data.totalImoveisElegiveis - data.totalImoveisJaVisitadosNoCiclo,
    );

    return {
      clienteId: data.clienteId,
      cicloAtivo: data.cicloAtivo
        ? {
            existe: true,
            id: data.cicloAtivo.id,
            numero: data.cicloAtivo.numero,
            ano: data.cicloAtivo.ano,
            status: data.cicloAtivo.status,
          }
        : { existe: false },
      territorio: {
        totalQuarteiroes: data.totalQuarteiroes,
        quarteiroesComAgente: data.quarteiroesComAgente,
        quarteiroesSemAgente,
        percentualDistribuido,
      },
      agentes: {
        totalAgentesAtivos: data.totalAgentesAtivos,
        agentesComQuarteirao: data.agentesComQuarteirao,
        agentesSemQuarteirao,
      },
      planejamentoInicial: data.planejamento
        ? {
            existe: true,
            id: data.planejamento.id,
            nome: data.planejamento.descricao ?? undefined,
            ativo: data.planejamento.ativo,
            tipo: data.planejamento.tipo_levantamento ?? undefined,
          }
        : { existe: false },
      operacaoInicial: {
        existe: !!(data.planejamento && data.planejamento.ativo),
        totalImoveisElegiveis: data.totalImoveisElegiveis,
        totalImoveisJaVisitadosNoCiclo: data.totalImoveisJaVisitadosNoCiclo,
        totalImoveisPendentes,
        agentesComRotaInicial: data.agentesComQuarteirao,
        agentesSemRotaInicial: agentesSemQuarteirao,
        podeGerar: operacaoInicialBloqueios.length === 0,
        bloqueios: operacaoInicialBloqueios,
      },
      operacao: {
        podeIniciar: bloqueios.length === 0,
        bloqueios,
        proximasAcoes,
      },
    };
  }
}
