import { BaseEntity, BaseProps } from 'src/shared/entities/base';
import { Paginated } from 'src/utils/pagination';

interface PlanejamentoProps {
  descricao?: string;
  dataPlanejamento: Date;
  clienteId?: string;
  areaTotal?: number;
  alturaVoo?: number;
  tipo?: string;
  ativo: boolean;
  tipoEntrada?: string;
  tipoLevantamento: string;
  regiaoId?: string;
  deletedAt?: Date;
  deletedBy?: string;
}

export class Planejamento extends BaseEntity<PlanejamentoProps> {
  private props: PlanejamentoProps;

  constructor(props: PlanejamentoProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }

  get descricao() {
    return this.props.descricao;
  }
  set descricao(v: string | undefined) {
    this.props.descricao = v;
  }
  get dataPlanejamento() {
    return this.props.dataPlanejamento;
  }
  set dataPlanejamento(v: Date) {
    this.props.dataPlanejamento = v;
  }
  get clienteId() {
    return this.props.clienteId;
  }
  get areaTotal() {
    return this.props.areaTotal;
  }
  set areaTotal(v: number | undefined) {
    this.props.areaTotal = v;
  }
  get alturaVoo() {
    return this.props.alturaVoo;
  }
  set alturaVoo(v: number | undefined) {
    this.props.alturaVoo = v;
  }
  get tipo() {
    return this.props.tipo;
  }
  set tipo(v: string | undefined) {
    this.props.tipo = v;
  }
  get ativo() {
    return this.props.ativo;
  }
  set ativo(v: boolean) {
    this.props.ativo = v;
  }
  get tipoEntrada() {
    return this.props.tipoEntrada;
  }
  set tipoEntrada(v: string | undefined) {
    this.props.tipoEntrada = v;
  }
  get tipoLevantamento() {
    return this.props.tipoLevantamento;
  }
  set tipoLevantamento(v: string) {
    this.props.tipoLevantamento = v;
  }
  get regiaoId() {
    return this.props.regiaoId;
  }
  set regiaoId(v: string | undefined) {
    this.props.regiaoId = v;
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
}

export class PlanejamentoPaginated extends Paginated<Planejamento>() {}
