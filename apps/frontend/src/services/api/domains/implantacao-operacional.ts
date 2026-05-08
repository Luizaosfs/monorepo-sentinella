import { http } from '@sentinella/api-client';
import { deepToSnake } from '../shared/case-mappers';

export interface ImplantacaoStatusDto {
  cliente_id: string;
  ciclo_ativo: {
    existe: boolean;
    id?: string;
    numero?: number;
    ano?: number;
    status?: string;
  };
  territorio: {
    total_quarteiroes: number;
    quarteiroes_com_agente: number;
    quarteiroes_sem_agente: number;
    percentual_distribuido: number;
  };
  agentes: {
    total_agentes_ativos: number;
    agentes_com_quarteirao: number;
    agentes_sem_quarteirao: number;
  };
  planejamento_inicial: {
    existe: boolean;
    id?: string;
    nome?: string;
    ativo?: boolean;
  };
  operacao_inicial: {
    existe: boolean;
    total_imoveis_elegiveis: number;
    total_imoveis_ja_visitados_no_ciclo: number;
    total_imoveis_pendentes: number;
    agentes_com_rota_inicial: number;
    agentes_sem_rota_inicial: number;
    pode_gerar: boolean;
    bloqueios: string[];
  };
  operacao: {
    pode_iniciar: boolean;
    bloqueios: string[];
    proximas_acoes: string[];
  };
}

export interface GerarOperacaoInicialDto {
  planejamento_id: string;
  ciclo_id: string;
  total_imoveis_elegiveis: number;
  total_imoveis_incluidos: number;
  total_agentes_com_rota: number;
  total_agentes_sem_rota: number;
  mensagem: string;
}

export const implantacaoOperacional = {
  getStatus: async (): Promise<ImplantacaoStatusDto> => {
    const raw = await http.get('/implantacao-operacional/status');
    return deepToSnake(raw) as ImplantacaoStatusDto;
  },

  iniciar: async (): Promise<ImplantacaoStatusDto> => {
    const raw = await http.post('/implantacao-operacional/iniciar', {});
    return deepToSnake(raw) as ImplantacaoStatusDto;
  },

  gerarOperacaoInicial: async (): Promise<GerarOperacaoInicialDto> => {
    const raw = await http.post('/implantacao-operacional/gerar-operacao-inicial', {});
    return deepToSnake(raw) as GerarOperacaoInicialDto;
  },
};
