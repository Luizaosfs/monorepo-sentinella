import { BaseEntity, BaseProps } from '@shared/entities/base';
import type { JsonObject } from '@shared/types/json';

interface JobProps {
  tipo: string;
  payload?: JsonObject;
  status: string;
  tentativas: number;
  erro?: string;
  agendadoEm?: Date;
  iniciadoEm?: Date;
  concluidoEm?: Date;
}

export class Job extends BaseEntity<JobProps> {
  private props: JobProps;
  constructor(props: JobProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }
  get tipo() {
    return this.props.tipo;
  }
  get payload() {
    return this.props.payload;
  }
  get status() {
    return this.props.status;
  }
  set status(v: string) {
    this.props.status = v;
  }
  get tentativas() {
    return this.props.tentativas;
  }
  set tentativas(v: number) {
    this.props.tentativas = v;
  }
  get erro() {
    return this.props.erro;
  }
  set erro(v: string | undefined) {
    this.props.erro = v;
  }
  get agendadoEm() {
    return this.props.agendadoEm;
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
}
