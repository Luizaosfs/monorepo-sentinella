import { BaseEntity, BaseProps } from 'src/shared/entities/base';
import { Paginated } from 'src/utils/pagination';

export interface VistoriaDeposito {
  id?: string;
  vistoriaId?: string;
  tipoDeposito: string;
  quantidade?: number;
  comLarva?: boolean;
  eliminado?: boolean;
  tratado?: boolean;
  observacao?: string;
  fotoUrl?: string;
  createdAt?: Date;
}

export interface VistoriaSintoma {
  id?: string;
  vistoriaId?: string;
  febre: boolean;
  manchasVermelhas: boolean;
  dorArticulacoes: boolean;
  dorCabeca: boolean;
  nausea: boolean;
  moradoresSintomasQtd: number;
  gerouCasoNotificadoId?: string;
  createdAt?: Date;
}

export interface VistoriaRisco {
  id?: string;
  vistoriaId?: string;
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
  outroRiscoVetorial?: string;
  createdAt?: Date;
}

export interface VistoriaCalha {
  id?: string;
  vistoriaId?: string;
  tipo?: string;
  estado?: string;
  comAcumulo?: boolean;
  observacao?: string;
  createdAt?: Date;
}

interface VistoriaProps {
  clienteId: string;
  imovelId?: string;
  agenteId: string;
  planejamentoId?: string;
  ciclo: number;
  tipoAtividade: string;
  dataVisita: Date;
  status: string;
  moradoresQtd?: number;
  gravidas: boolean;
  idosos: boolean;
  criancas7anos: boolean;
  latChegada?: number;
  lngChegada?: number;
  checkinEm?: Date;
  observacao?: string;
  payload?: Record<string, unknown>;
  acessoRealizado: boolean;
  motivoSemAcesso?: string;
  proximoHorarioSugerido?: string;
  observacaoAcesso?: string;
  fotoExternaUrl?: string;
  origemVisita?: string;
  habitatSelecionado?: string;
  condicaoHabitat?: string;
  assinaturaResponsavelUrl?: string;
  pendenteAssinatura: boolean;
  pendenteFoto: boolean;
  origemOffline: boolean;
  assinaturaPublicId?: string;
  fotoExternaPublicId?: string;
  idempotencyKey?: string;
  focoRiscoId?: string;
  resultadoOperacional?: string;
  vulnerabilidadeDomiciliar?: string;
  alertaSaude?: string;
  riscoSocioambiental?: string;
  riscoVetorial?: string;
  prioridadeFinal?: string;
  prioridadeMotivo?: string;
  dimensaoDominante?: string;
  consolidacaoResumo?: string;
  consolidacaoJson?: Record<string, unknown>;
  consolidacaoIncompleta: boolean;
  versaoRegraConsolidacao?: string;
  versaoPesosConsolidacao?: string;
  consolidadoEm?: Date;
  reprocessadoEm?: Date;
  reprocessadoPor?: string;
  depositos?: VistoriaDeposito[];
  sintomas?: VistoriaSintoma[];
  riscos?: VistoriaRisco[];
  calhas?: VistoriaCalha[];
}

export class Vistoria extends BaseEntity<VistoriaProps> {
  private props: VistoriaProps;

  constructor(props: VistoriaProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }

  get clienteId() {
    return this.props.clienteId;
  }

  get imovelId() {
    return this.props.imovelId;
  }
  set imovelId(v: string | undefined) {
    this.props.imovelId = v;
  }

  get agenteId() {
    return this.props.agenteId;
  }
  set agenteId(v: string) {
    this.props.agenteId = v;
  }

  get planejamentoId() {
    return this.props.planejamentoId;
  }
  set planejamentoId(v: string | undefined) {
    this.props.planejamentoId = v;
  }

  get ciclo() {
    return this.props.ciclo;
  }
  set ciclo(v: number) {
    this.props.ciclo = v;
  }

  get tipoAtividade() {
    return this.props.tipoAtividade;
  }
  set tipoAtividade(v: string) {
    this.props.tipoAtividade = v;
  }

  get dataVisita() {
    return this.props.dataVisita;
  }
  set dataVisita(v: Date) {
    this.props.dataVisita = v;
  }

  get status() {
    return this.props.status;
  }
  set status(v: string) {
    this.props.status = v;
  }

  get moradoresQtd() {
    return this.props.moradoresQtd;
  }
  set moradoresQtd(v: number | undefined) {
    this.props.moradoresQtd = v;
  }

  get gravidas() {
    return this.props.gravidas;
  }
  set gravidas(v: boolean) {
    this.props.gravidas = v;
  }

  get idosos() {
    return this.props.idosos;
  }
  set idosos(v: boolean) {
    this.props.idosos = v;
  }

  get criancas7anos() {
    return this.props.criancas7anos;
  }
  set criancas7anos(v: boolean) {
    this.props.criancas7anos = v;
  }

  get latChegada() {
    return this.props.latChegada;
  }
  set latChegada(v: number | undefined) {
    this.props.latChegada = v;
  }

  get lngChegada() {
    return this.props.lngChegada;
  }
  set lngChegada(v: number | undefined) {
    this.props.lngChegada = v;
  }

  get checkinEm() {
    return this.props.checkinEm;
  }
  set checkinEm(v: Date | undefined) {
    this.props.checkinEm = v;
  }

  get observacao() {
    return this.props.observacao;
  }
  set observacao(v: string | undefined) {
    this.props.observacao = v;
  }

  get payload() {
    return this.props.payload;
  }
  set payload(v: Record<string, unknown> | undefined) {
    this.props.payload = v;
  }

  get acessoRealizado() {
    return this.props.acessoRealizado;
  }
  set acessoRealizado(v: boolean) {
    this.props.acessoRealizado = v;
  }

  get motivoSemAcesso() {
    return this.props.motivoSemAcesso;
  }
  set motivoSemAcesso(v: string | undefined) {
    this.props.motivoSemAcesso = v;
  }

  get proximoHorarioSugerido() {
    return this.props.proximoHorarioSugerido;
  }
  set proximoHorarioSugerido(v: string | undefined) {
    this.props.proximoHorarioSugerido = v;
  }

  get observacaoAcesso() {
    return this.props.observacaoAcesso;
  }
  set observacaoAcesso(v: string | undefined) {
    this.props.observacaoAcesso = v;
  }

  get fotoExternaUrl() {
    return this.props.fotoExternaUrl;
  }
  set fotoExternaUrl(v: string | undefined) {
    this.props.fotoExternaUrl = v;
  }

  get origemVisita() {
    return this.props.origemVisita;
  }
  set origemVisita(v: string | undefined) {
    this.props.origemVisita = v;
  }

  get habitatSelecionado() {
    return this.props.habitatSelecionado;
  }
  set habitatSelecionado(v: string | undefined) {
    this.props.habitatSelecionado = v;
  }

  get condicaoHabitat() {
    return this.props.condicaoHabitat;
  }
  set condicaoHabitat(v: string | undefined) {
    this.props.condicaoHabitat = v;
  }

  get assinaturaResponsavelUrl() {
    return this.props.assinaturaResponsavelUrl;
  }
  set assinaturaResponsavelUrl(v: string | undefined) {
    this.props.assinaturaResponsavelUrl = v;
  }

  get pendenteAssinatura() {
    return this.props.pendenteAssinatura;
  }
  set pendenteAssinatura(v: boolean) {
    this.props.pendenteAssinatura = v;
  }

  get pendenteFoto() {
    return this.props.pendenteFoto;
  }
  set pendenteFoto(v: boolean) {
    this.props.pendenteFoto = v;
  }

  get origemOffline() {
    return this.props.origemOffline;
  }
  set origemOffline(v: boolean) {
    this.props.origemOffline = v;
  }

  get assinaturaPublicId() {
    return this.props.assinaturaPublicId;
  }
  set assinaturaPublicId(v: string | undefined) {
    this.props.assinaturaPublicId = v;
  }

  get fotoExternaPublicId() {
    return this.props.fotoExternaPublicId;
  }
  set fotoExternaPublicId(v: string | undefined) {
    this.props.fotoExternaPublicId = v;
  }

  get idempotencyKey() {
    return this.props.idempotencyKey;
  }
  set idempotencyKey(v: string | undefined) {
    this.props.idempotencyKey = v;
  }

  get focoRiscoId() {
    return this.props.focoRiscoId;
  }
  set focoRiscoId(v: string | undefined) {
    this.props.focoRiscoId = v;
  }

  get resultadoOperacional() {
    return this.props.resultadoOperacional;
  }
  set resultadoOperacional(v: string | undefined) {
    this.props.resultadoOperacional = v;
  }

  get vulnerabilidadeDomiciliar() {
    return this.props.vulnerabilidadeDomiciliar;
  }
  set vulnerabilidadeDomiciliar(v: string | undefined) {
    this.props.vulnerabilidadeDomiciliar = v;
  }

  get alertaSaude() {
    return this.props.alertaSaude;
  }
  set alertaSaude(v: string | undefined) {
    this.props.alertaSaude = v;
  }

  get riscoSocioambiental() {
    return this.props.riscoSocioambiental;
  }
  set riscoSocioambiental(v: string | undefined) {
    this.props.riscoSocioambiental = v;
  }

  get riscoVetorial() {
    return this.props.riscoVetorial;
  }
  set riscoVetorial(v: string | undefined) {
    this.props.riscoVetorial = v;
  }

  get prioridadeFinal() {
    return this.props.prioridadeFinal;
  }
  set prioridadeFinal(v: string | undefined) {
    this.props.prioridadeFinal = v;
  }

  get prioridadeMotivo() {
    return this.props.prioridadeMotivo;
  }
  set prioridadeMotivo(v: string | undefined) {
    this.props.prioridadeMotivo = v;
  }

  get dimensaoDominante() {
    return this.props.dimensaoDominante;
  }
  set dimensaoDominante(v: string | undefined) {
    this.props.dimensaoDominante = v;
  }

  get consolidacaoResumo() {
    return this.props.consolidacaoResumo;
  }
  set consolidacaoResumo(v: string | undefined) {
    this.props.consolidacaoResumo = v;
  }

  get consolidacaoJson() {
    return this.props.consolidacaoJson;
  }
  set consolidacaoJson(v: Record<string, unknown> | undefined) {
    this.props.consolidacaoJson = v;
  }

  get consolidacaoIncompleta() {
    return this.props.consolidacaoIncompleta;
  }
  set consolidacaoIncompleta(v: boolean) {
    this.props.consolidacaoIncompleta = v;
  }

  get versaoRegraConsolidacao() {
    return this.props.versaoRegraConsolidacao;
  }
  set versaoRegraConsolidacao(v: string | undefined) {
    this.props.versaoRegraConsolidacao = v;
  }

  get versaoPesosConsolidacao() {
    return this.props.versaoPesosConsolidacao;
  }
  set versaoPesosConsolidacao(v: string | undefined) {
    this.props.versaoPesosConsolidacao = v;
  }

  get consolidadoEm() {
    return this.props.consolidadoEm;
  }
  set consolidadoEm(v: Date | undefined) {
    this.props.consolidadoEm = v;
  }

  get reprocessadoEm() {
    return this.props.reprocessadoEm;
  }
  set reprocessadoEm(v: Date | undefined) {
    this.props.reprocessadoEm = v;
  }

  get reprocessadoPor() {
    return this.props.reprocessadoPor;
  }
  set reprocessadoPor(v: string | undefined) {
    this.props.reprocessadoPor = v;
  }

  get depositos() {
    return this.props.depositos;
  }
  get sintomas() {
    return this.props.sintomas;
  }
  get riscos() {
    return this.props.riscos;
  }
  get calhas() {
    return this.props.calhas;
  }
}

export class VistoriaPaginated extends Paginated<Vistoria>() {}
