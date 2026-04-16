import { BaseEntity, BaseProps } from '@shared/entities/base';
import type { JsonObject } from '@shared/types/json';
import { Paginated } from 'src/utils/pagination';

export interface LevantamentoItemDetecao {
  id?: string;
  levantamentoItemId?: string;
  ordem?: number;
  className: string;
  confidence?: number;
  bboxXyxy?: JsonObject;
  bboxNorm?: JsonObject;
  createdAt?: Date;
}

export interface LevantamentoItemEvidencia {
  id?: string;
  itemId?: string;
  tipo?: string;
  url: string;
  publicId?: string;
  createdAt?: Date;
}

export interface LevantamentoItem {
  id?: string;
  levantamentoId?: string;
  clienteId?: string;
  arquivo?: string;
  latitude?: number;
  longitude?: number;
  item?: string;
  risco?: string;
  peso?: number;
  acao?: string;
  scoreFinal?: number;
  prioridade?: string;
  slaHoras?: number;
  enderecoCurto?: string;
  enderecoCompleto?: string;
  maps?: string;
  waze?: string;
  dataHora?: Date;
  payload?: JsonObject;
  createdAt?: Date;
  updatedAt?: Date;
  imageUrl?: string;
  uuidImg?: string;
  idDrone?: string;
  altitudeM?: number;
  alturaRelativaM?: number;
  focalMm?: number;
  iso?: number;
  exposureS?: number;
  resolucaoLarguraPx?: number;
  resolucaoAlturaPx?: number;
  megapixels?: number;
  inclinacaoCameraGraus?: number;
  direcaoYawGraus?: number;
  inclinacaoLateralRollGraus?: number;
  inclinacaoFrontalPitchGraus?: number;
  detectionBbox?: JsonObject;
  updatedBy?: string;
  deletedAt?: Date;
  deletedBy?: string;
  imagePublicId?: string;
  detecoes?: LevantamentoItemDetecao[];
  evidencias?: LevantamentoItemEvidencia[];
}

interface LevantamentoProps {
  clienteId: string;
  planejamentoId?: string;
  cicloId?: string;
  idDrone?: string;
  usuarioId: string;
  titulo?: string;
  tipoEntrada?: string;
  configFonte?: string;
  dataVoo?: Date;
  statusProcessamento: string;
  totalItens: number;
  observacao?: string;
  concluidoEm?: Date;
  deletedAt?: Date;
  deletedBy?: string;
  itens?: LevantamentoItem[];
}

export class Levantamento extends BaseEntity<LevantamentoProps> {
  private props: LevantamentoProps;

  constructor(props: LevantamentoProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }

  get clienteId() { return this.props.clienteId; }

  get planejamentoId() { return this.props.planejamentoId; }
  set planejamentoId(v: string | undefined) { this.props.planejamentoId = v; }

  get cicloId() { return this.props.cicloId; }
  set cicloId(v: string | undefined) { this.props.cicloId = v; }

  get idDrone() { return this.props.idDrone; }

  get usuarioId() { return this.props.usuarioId; }
  set usuarioId(v: string) { this.props.usuarioId = v; }

  get titulo() { return this.props.titulo; }
  set titulo(v: string | undefined) { this.props.titulo = v; }

  get tipoEntrada() { return this.props.tipoEntrada; }
  set tipoEntrada(v: string | undefined) { this.props.tipoEntrada = v; }

  get configFonte() { return this.props.configFonte; }
  get dataVoo() { return this.props.dataVoo; }

  get statusProcessamento() { return this.props.statusProcessamento; }
  set statusProcessamento(v: string) { this.props.statusProcessamento = v; }

  get totalItens() { return this.props.totalItens; }
  set totalItens(v: number) { this.props.totalItens = v; }

  get observacao() { return this.props.observacao; }
  set observacao(v: string | undefined) { this.props.observacao = v; }

  get concluidoEm() { return this.props.concluidoEm; }
  set concluidoEm(v: Date | undefined) { this.props.concluidoEm = v; }

  get deletedAt() { return this.props.deletedAt; }
  get deletedBy() { return this.props.deletedBy; }

  get itens() { return this.props.itens; }
}

export class LevantamentoPaginated extends Paginated<Levantamento>() {}
