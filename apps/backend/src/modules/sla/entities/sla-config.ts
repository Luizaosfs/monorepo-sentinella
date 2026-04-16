import { BaseEntity, BaseProps } from '@shared/entities/base';
import type { JsonObject } from '@shared/types/json';

interface SlaConfigProps {
  clienteId: string;
  config: JsonObject;
}

export class SlaConfig extends BaseEntity<SlaConfigProps> {
  private props: SlaConfigProps;

  constructor(props: SlaConfigProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }

  get clienteId() {
    return this.props.clienteId;
  }
  get config() {
    return this.props.config;
  }
  set config(v: JsonObject) {
    this.props.config = v;
  }
}

interface SlaFeriadoProps {
  clienteId: string;
  data: Date;
  descricao: string;
  nacional: boolean;
}

export class SlaFeriado extends BaseEntity<SlaFeriadoProps> {
  private props: SlaFeriadoProps;

  constructor(props: SlaFeriadoProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }

  get clienteId() {
    return this.props.clienteId;
  }
  get data() {
    return this.props.data;
  }
  get descricao() {
    return this.props.descricao;
  }
  get nacional() {
    return this.props.nacional;
  }
}

interface SlaFocoConfigProps {
  clienteId: string;
  fase: string;
  prazoMinutos: number;
  ativo: boolean;
}

export class SlaFocoConfig extends BaseEntity<SlaFocoConfigProps> {
  private props: SlaFocoConfigProps;

  constructor(props: SlaFocoConfigProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }

  get clienteId() {
    return this.props.clienteId;
  }
  get fase() {
    return this.props.fase;
  }
  get prazoMinutos() {
    return this.props.prazoMinutos;
  }
  set prazoMinutos(v: number) {
    this.props.prazoMinutos = v;
  }
  get ativo() {
    return this.props.ativo;
  }
  set ativo(v: boolean) {
    this.props.ativo = v;
  }
}
