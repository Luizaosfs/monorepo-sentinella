import { BaseEntity, BaseProps } from 'src/shared/entities/base';

export type ReinspecaoStatus = 'pendente' | 'realizada' | 'cancelada' | 'vencida';

interface ReinspecaoProps {
  clienteId: string;
  focoRiscoId: string;
  status: ReinspecaoStatus;
  tipo: string;
  origem: string;
  dataPrevista: Date;
  dataRealizada?: Date;
  responsavelId?: string;
  observacao?: string;
  resultado?: string;
  criadoPor?: string;
  canceladoPor?: string;
  motivoCancelamento?: string;
}

export class Reinspecao extends BaseEntity<ReinspecaoProps> {
  private props: ReinspecaoProps;

  constructor(props: ReinspecaoProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }

  get clienteId() {
    return this.props.clienteId;
  }

  get focoRiscoId() {
    return this.props.focoRiscoId;
  }

  get status() {
    return this.props.status;
  }
  set status(v: ReinspecaoStatus) {
    this.props.status = v;
  }

  get tipo() {
    return this.props.tipo;
  }
  set tipo(v: string) {
    this.props.tipo = v;
  }

  get origem() {
    return this.props.origem;
  }
  set origem(v: string) {
    this.props.origem = v;
  }

  get dataPrevista() {
    return this.props.dataPrevista;
  }
  set dataPrevista(v: Date) {
    this.props.dataPrevista = v;
  }

  get dataRealizada() {
    return this.props.dataRealizada;
  }
  set dataRealizada(v: Date | undefined) {
    this.props.dataRealizada = v;
  }

  get responsavelId() {
    return this.props.responsavelId;
  }
  set responsavelId(v: string | undefined) {
    this.props.responsavelId = v;
  }

  get observacao() {
    return this.props.observacao;
  }
  set observacao(v: string | undefined) {
    this.props.observacao = v;
  }

  get resultado() {
    return this.props.resultado;
  }
  set resultado(v: string | undefined) {
    this.props.resultado = v;
  }

  get criadoPor() {
    return this.props.criadoPor;
  }

  get canceladoPor() {
    return this.props.canceladoPor;
  }
  set canceladoPor(v: string | undefined) {
    this.props.canceladoPor = v;
  }

  get motivoCancelamento() {
    return this.props.motivoCancelamento;
  }
  set motivoCancelamento(v: string | undefined) {
    this.props.motivoCancelamento = v;
  }
}
