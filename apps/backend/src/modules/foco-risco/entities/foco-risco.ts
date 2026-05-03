import { BaseEntity, BaseProps } from 'src/shared/entities/base';
import { Paginated } from 'src/utils/pagination';

export type FocoRiscoStatus =
  | 'suspeita'
  | 'em_triagem'
  | 'aguarda_inspecao'
  | 'em_inspecao'
  | 'confirmado'
  | 'em_tratamento'
  | 'resolvido'
  | 'descartado';

/** `aguarda_inspecao` → `em_inspecao` não entra aqui: use o caso de uso IniciarInspecao (evento operacional + histórico inicio_inspecao). */
export const TRANSICOES_VALIDAS: Record<FocoRiscoStatus, FocoRiscoStatus[]> = {
  suspeita: ['em_triagem'],
  em_triagem: ['aguarda_inspecao', 'descartado'],
  aguarda_inspecao: ['descartado'],
  em_inspecao: ['confirmado', 'descartado'],
  confirmado: ['em_tratamento'],
  em_tratamento: ['resolvido', 'descartado'],
  resolvido: [],
  descartado: [],
};

export interface FocoRiscoHistorico {
  id?: string;
  focoRiscoId?: string;
  clienteId: string;
  statusAnterior?: string;
  statusNovo: string;
  alteradoPor?: string;
  alteradoEm?: Date;
  tipoEvento?: string;
  classificacaoAnterior?: string;
  classificacaoNova?: string;
  motivo?: string;
}

interface FocoRiscoProps {
  clienteId: string;
  imovelId?: string;
  regiaoId?: string;
  origemTipo: string;
  origemLevantamentoItemId?: string;
  origemVistoriaId?: string;
  status: FocoRiscoStatus;
  prioridade?: string;
  /** Prioridade registrada antes de vínculo com caso (auditoria operacional). */
  prioridadeOriginalAntesCaso?: string;
  ciclo?: number;
  latitude?: number;
  longitude?: number;
  enderecoNormalizado?: string;
  suspeitaEm: Date;
  /** Quando o foco passou a ter dados mínimos preenchidos (operacional). */
  dadosMinimosEm?: Date;
  inspecaoEm?: Date;
  confirmadoEm?: Date;
  resolvidoEm?: Date;
  responsavelId?: string;
  desfecho?: string;
  focoAnteriorId?: string;
  casosIds: string[];
  observacao?: string;
  classificacaoInicial: string;
  scorePrioridade: number;
  codigoFoco?: string;
  /**
   * JSON livre no banco (consolidação, flags analíticas, classificação derivada legada).
   * Não substitui colunas reais; ver `classificacaoInicial`.
   */
  payload?: unknown;
  historico?: FocoRiscoHistorico[];
  /** URL da imagem do levantamento_item de origem (join externo, não coluna). */
  origemImageUrl?: string | null;
  /** Data da última vistoria relacionada ao foco/imóvel (campo derivado para listagens). */
  ultimaVistoriaEm?: Date | null;
}

export class FocoRisco extends BaseEntity<FocoRiscoProps> {
  private props: FocoRiscoProps;

  constructor(props: FocoRiscoProps, baseProps: BaseProps) {
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
  get regiaoId() {
    return this.props.regiaoId;
  }
  set regiaoId(v: string | undefined) {
    this.props.regiaoId = v;
  }
  get origemTipo() {
    return this.props.origemTipo;
  }
  get origemLevantamentoItemId() {
    return this.props.origemLevantamentoItemId;
  }
  get origemVistoriaId() {
    return this.props.origemVistoriaId;
  }
  get status() {
    return this.props.status;
  }
  set status(v: FocoRiscoStatus) {
    this.props.status = v;
  }
  get prioridade() {
    return this.props.prioridade;
  }
  set prioridade(v: string | undefined) {
    this.props.prioridade = v;
  }
  get prioridadeOriginalAntesCaso() {
    return this.props.prioridadeOriginalAntesCaso;
  }
  set prioridadeOriginalAntesCaso(v: string | undefined) {
    this.props.prioridadeOriginalAntesCaso = v;
  }
  get ciclo() {
    return this.props.ciclo;
  }
  set ciclo(v: number | undefined) {
    this.props.ciclo = v;
  }
  get latitude() {
    return this.props.latitude;
  }
  set latitude(v: number | undefined) {
    this.props.latitude = v;
  }
  get longitude() {
    return this.props.longitude;
  }
  set longitude(v: number | undefined) {
    this.props.longitude = v;
  }
  get enderecoNormalizado() {
    return this.props.enderecoNormalizado;
  }
  set enderecoNormalizado(v: string | undefined) {
    this.props.enderecoNormalizado = v;
  }
  get suspeitaEm() {
    return this.props.suspeitaEm;
  }
  get dadosMinimosEm() {
    return this.props.dadosMinimosEm;
  }
  set dadosMinimosEm(v: Date | undefined) {
    this.props.dadosMinimosEm = v;
  }
  get inspecaoEm() {
    return this.props.inspecaoEm;
  }
  set inspecaoEm(v: Date | undefined) {
    this.props.inspecaoEm = v;
  }
  get confirmadoEm() {
    return this.props.confirmadoEm;
  }
  set confirmadoEm(v: Date | undefined) {
    this.props.confirmadoEm = v;
  }
  get resolvidoEm() {
    return this.props.resolvidoEm;
  }
  set resolvidoEm(v: Date | undefined) {
    this.props.resolvidoEm = v;
  }
  get responsavelId() {
    return this.props.responsavelId;
  }
  set responsavelId(v: string | undefined) {
    this.props.responsavelId = v;
  }
  get desfecho() {
    return this.props.desfecho;
  }
  set desfecho(v: string | undefined) {
    this.props.desfecho = v;
  }
  get focoAnteriorId() {
    return this.props.focoAnteriorId;
  }
  get casosIds() {
    return this.props.casosIds;
  }
  get observacao() {
    return this.props.observacao;
  }
  set observacao(v: string | undefined) {
    this.props.observacao = v;
  }
  get classificacaoInicial() {
    return this.props.classificacaoInicial;
  }
  set classificacaoInicial(v: string) {
    this.props.classificacaoInicial = v;
  }
  get scorePrioridade() {
    return this.props.scorePrioridade;
  }
  get codigoFoco() {
    return this.props.codigoFoco;
  }
  set codigoFoco(v: string | undefined) {
    this.props.codigoFoco = v;
  }
  get payload() {
    return this.props.payload;
  }
  set payload(v: unknown) {
    this.props.payload = v;
  }
  get historico() {
    return this.props.historico;
  }
  get origemImageUrl() {
    return this.props.origemImageUrl;
  }
  set origemImageUrl(v: string | null | undefined) {
    this.props.origemImageUrl = v;
  }
  get ultimaVistoriaEm() {
    return this.props.ultimaVistoriaEm;
  }
  set ultimaVistoriaEm(v: Date | null | undefined) {
    this.props.ultimaVistoriaEm = v;
  }

  podeTransicionar(paraStatus: FocoRiscoStatus): boolean {
    return TRANSICOES_VALIDAS[this.props.status]?.includes(paraStatus) ?? false;
  }
}

export class FocoRiscoPaginated extends Paginated<FocoRisco>() {}
