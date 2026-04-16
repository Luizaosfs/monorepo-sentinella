import { BaseEntity, BaseProps } from '@shared/entities/base';
import type { JsonObject } from '@shared/types/json';

interface ResumoDiarioProps {
  clienteId: string;
  dataRef: Date;
  sumario: string;
  metricas?: JsonObject;
}

export class ResumoDiario extends BaseEntity<ResumoDiarioProps> {
  private props: ResumoDiarioProps;
  constructor(props: ResumoDiarioProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }
  get clienteId() {
    return this.props.clienteId;
  }
  get dataRef() {
    return this.props.dataRef;
  }
  get sumario() {
    return this.props.sumario;
  }
  get metricas() {
    return this.props.metricas;
  }
}

interface RelatorioGeradoProps {
  clienteId: string;
  geradoPor?: string;
  periodoInicio: Date;
  periodoFim: Date;
  payload: Record<string, any>;
}

export class RelatorioGerado extends BaseEntity<RelatorioGeradoProps> {
  private props: RelatorioGeradoProps;
  constructor(props: RelatorioGeradoProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }
  get clienteId() {
    return this.props.clienteId;
  }
  get geradoPor() {
    return this.props.geradoPor;
  }
  get periodoInicio() {
    return this.props.periodoInicio;
  }
  get periodoFim() {
    return this.props.periodoFim;
  }
  get payload() {
    return this.props.payload;
  }
}

interface SystemHealthLogProps {
  servico: string;
  status: string;
  detalhes?: JsonObject;
  criadoEm: Date;
}

export class SystemHealthLog extends BaseEntity<SystemHealthLogProps> {
  private props: SystemHealthLogProps;
  constructor(props: SystemHealthLogProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }
  get servico() {
    return this.props.servico;
  }
  get status() {
    return this.props.status;
  }
  get detalhes() {
    return this.props.detalhes;
  }
  get criadoEm() {
    return this.props.criadoEm;
  }
}

interface SystemAlertProps {
  servico: string;
  nivel: string;
  mensagem: string;
  resolvido: boolean;
  resolvidoEm?: Date;
  criadoEm: Date;
}

export class SystemAlert extends BaseEntity<SystemAlertProps> {
  private props: SystemAlertProps;
  constructor(props: SystemAlertProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }
  get servico() {
    return this.props.servico;
  }
  get nivel() {
    return this.props.nivel;
  }
  get mensagem() {
    return this.props.mensagem;
  }
  get resolvido() {
    return this.props.resolvido;
  }
  set resolvido(v: boolean) {
    this.props.resolvido = v;
  }
  get resolvidoEm() {
    return this.props.resolvidoEm;
  }
  set resolvidoEm(v: Date | undefined) {
    this.props.resolvidoEm = v;
  }
  get criadoEm() {
    return this.props.criadoEm;
  }
}
