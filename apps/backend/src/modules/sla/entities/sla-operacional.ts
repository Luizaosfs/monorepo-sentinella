import { BaseEntity, BaseProps } from 'src/shared/entities/base';
import { Paginated } from 'src/utils/pagination';

interface SlaOperacionalProps {
  itemId?: string;
  agenteId?: string;
  prioridade: string;
  slaHoras: number;
  inicio: Date;
  prazoFinal: Date;
  concluidoEm?: Date;
  status: string;
  violado: boolean;
  escalonado: boolean;
  escalonadoEm?: Date;
  prioridadeOriginal?: string;
  clienteId?: string;
  levantamentoItemId?: string;
  escalonadoAutomatico: boolean;
  focoRiscoId?: string;
  escaladoPor?: string;
  reabertoEm?: string;
  deletedAt?: Date;
  deletedBy?: string;
}

export class SlaOperacional extends BaseEntity<SlaOperacionalProps> {
  private props: SlaOperacionalProps;

  constructor(props: SlaOperacionalProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }

  get itemId() {
    return this.props.itemId;
  }
  get agenteId() {
    return this.props.agenteId;
  }
  set agenteId(v: string | undefined) {
    this.props.agenteId = v;
  }
  get prioridade() {
    return this.props.prioridade;
  }
  set prioridade(v: string) {
    this.props.prioridade = v;
  }
  get slaHoras() {
    return this.props.slaHoras;
  }
  set slaHoras(v: number) {
    this.props.slaHoras = v;
  }
  get inicio() {
    return this.props.inicio;
  }
  get prazoFinal() {
    return this.props.prazoFinal;
  }
  set prazoFinal(v: Date) {
    this.props.prazoFinal = v;
  }
  get concluidoEm() {
    return this.props.concluidoEm;
  }
  set concluidoEm(v: Date | undefined) {
    this.props.concluidoEm = v;
  }
  get status() {
    return this.props.status;
  }
  set status(v: string) {
    this.props.status = v;
  }
  get violado() {
    return this.props.violado;
  }
  set violado(v: boolean) {
    this.props.violado = v;
  }
  get escalonado() {
    return this.props.escalonado;
  }
  set escalonado(v: boolean) {
    this.props.escalonado = v;
  }
  get escalonadoEm() {
    return this.props.escalonadoEm;
  }
  set escalonadoEm(v: Date | undefined) {
    this.props.escalonadoEm = v;
  }
  get prioridadeOriginal() {
    return this.props.prioridadeOriginal;
  }
  set prioridadeOriginal(v: string | undefined) {
    this.props.prioridadeOriginal = v;
  }
  get clienteId() {
    return this.props.clienteId;
  }
  get levantamentoItemId() {
    return this.props.levantamentoItemId;
  }
  get escalonadoAutomatico() {
    return this.props.escalonadoAutomatico;
  }
  set escalonadoAutomatico(v: boolean) {
    this.props.escalonadoAutomatico = v;
  }
  get focoRiscoId() {
    return this.props.focoRiscoId;
  }
  get escaladoPor() {
    return this.props.escaladoPor;
  }
  set escaladoPor(v: string | undefined) {
    this.props.escaladoPor = v;
  }
}

export class SlaOperacionalPaginated extends Paginated<SlaOperacional>() {}
