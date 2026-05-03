import { useQuery } from '@tanstack/react-query';
import { http } from '@sentinella/api-client';
import { STALE } from '@/lib/queryConfig';

export interface FocoDetalhes {
  foco: {
    id: string;
    clienteId: string;
    imovelId: string | null;
    regiaoId: string | null;
    codigoFoco: string | null;
    status: string;
    prioridade: string | null;
    scorePrioridade: number;
    classificacaoInicial: string;
    origemTipo: string;
    enderecoNormalizado: string | null;
    latitude: number | null;
    longitude: number | null;
    suspeitaEm: string;
    confirmadoEm: string | null;
    inspecaoEm: string | null;
    resolvidoEm: string | null;
    desfecho: string | null;
    observacao: string | null;
    casosIds: string[];
    ciclo: number | null;
    createdAt: string;
    responsavel: { id: string; nome: string | null; email: string } | null;
  };
  imovel: {
    id: string;
    tipoImovel: string;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    quarteirao: string | null;
    latitude: number | null;
    longitude: number | null;
    proprietarioAusente: boolean;
    temCalha: boolean;
    calhaAcessivel: boolean;
    temAnimalAgressivo: boolean;
    historicoRecusa: boolean;
  } | null;
  vistoria: {
    id: string;
    dataVisita: string;
    moradoresQtd: number | null;
    gravidas: number;
    idosos: number;
    criancas7anos: number;
    /** JSON opcional da vistoria (contagens extras, se existirem). */
    payload?: Record<string, unknown> | null;
    tipoAtividade: string;
    resultadoOperacional: string | null;
    vulnerabilidadeDomiciliar: string | null;
    alertaSaude: string | null;
    riscoSocioambiental: string | null;
    riscoVetorial: string | null;
    prioridadeFinal: string | null;
    consolidacaoResumo: string | null;
    agente: { id: string; nome: string | null } | null;
    prioridadeMotivo: string | null;
    dimensaoDominante: string | null;
    acessoRealizado: boolean;
    motivoSemAcesso: string | null;
    fotoExternaUrl: string | null;
    depositos: Array<{
      id: string;
      tipo: string;
      qtdInspecionados: number;
      qtdComFocos: number;
      qtdEliminados: number;
      qtdComAgua: number;
      usouLarvicida: boolean;
      qtdLarvicidaG: number | null;
      eliminado: boolean;
      vedado: boolean;
      iaIdentificacao: Record<string, unknown> | null;
    }>;
    sintomas: Array<{
      id: string;
      febre: boolean;
      manchasVermelhas: boolean;
      dorArticulacoes: boolean;
      dorCabeca: boolean;
      nausea: boolean;
      moradoresSintomasQtd: number;
    }>;
    calhas: Array<{
      id: string;
      posicao: string;
      condicao: string;
      comFoco: boolean;
      acessivel: boolean;
      tratamentoRealizado: boolean;
      fotoUrl: string | null;
      observacao: string | null;
    }>;
    riscos: Array<{
      id: string;
      menorIncapaz: boolean;
      idosoIncapaz: boolean;
      mobilidadeReduzida: boolean;
      acamado: boolean;
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
    }>;
  } | null;
  casosCount: number;
}

export function useFocoDetalhes(id: string | undefined) {
  return useQuery<FocoDetalhes>({
    queryKey: ['foco-detalhes', id],
    queryFn: () => http.get(`/focos-risco/${id}/detalhes`),
    enabled: !!id,
    staleTime: STALE.MEDIUM,
  });
}
