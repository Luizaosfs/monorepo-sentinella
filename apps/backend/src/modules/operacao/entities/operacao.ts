import { BaseEntity, BaseProps } from 'src/shared/entities/base';
import { Paginated } from 'src/utils/pagination';

export interface OperacaoEvidencia {
  id?: string;
  operacaoId?: string;
  imageUrl: string;
  legenda?: string;
  publicId?: string;
  createdAt?: Date;
}

interface OperacaoProps {
  clienteId: string;
  itemId?: string;
  status: string;
  prioridade?: string;
  responsavelId?: string;
  iniciadoEm?: Date;
  concluidoEm?: Date;
  observacao?: string;
  tipoVinculo?: string;
  itemOperacionalId?: string;
  itemLevantamentoId?: string;
  regiaoId?: string;
  focoRiscoId?: string;
  deletedAt?: Date;
  deletedBy?: string;
  evidencias?: OperacaoEvidencia[];
}

export class Operacao extends BaseEntity<OperacaoProps> {
  private props: OperacaoProps;

  constructor(props: OperacaoProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }

  get clienteId() {
    return this.props.clienteId;
  }
  get itemId() {
    return this.props.itemId;
  }
  get status() {
    return this.props.status;
  }
  set status(v: string) {
    this.props.status = v;
  }
  get prioridade() {
    return this.props.prioridade;
  }
  set prioridade(v: string | undefined) {
    this.props.prioridade = v;
  }
  get responsavelId() {
    return this.props.responsavelId;
  }
  set responsavelId(v: string | undefined) {
    this.props.responsavelId = v;
  }
  get iniciadoEm() {
    return this.props.iniciadoEm;
  }
  set iniciadoEm(v: Date | undefined) {
    this.props.iniciadoEm = v;
  }
  get concluidoEm() {
    return this.props.concluidoEm;
  }
  set concluidoEm(v: Date | undefined) {
    this.props.concluidoEm = v;
  }
  get observacao() {
    return this.props.observacao;
  }
  set observacao(v: string | undefined) {
    this.props.observacao = v;
  }
  get tipoVinculo() {
    return this.props.tipoVinculo;
  }
  get itemOperacionalId() {
    return this.props.itemOperacionalId;
  }
  get itemLevantamentoId() {
    return this.props.itemLevantamentoId;
  }
  get regiaoId() {
    return this.props.regiaoId;
  }
  get focoRiscoId() {
    return this.props.focoRiscoId;
  }
  get deletedAt() {
    return this.props.deletedAt;
  }
  set deletedAt(v: Date | undefined) {
    this.props.deletedAt = v;
  }
  get deletedBy() {
    return this.props.deletedBy;
  }
  set deletedBy(v: string | undefined) {
    this.props.deletedBy = v;
  }
  get evidencias() {
    return this.props.evidencias;
  }
}

export class OperacaoPaginated extends Paginated<Operacao>() {}
