import { BaseEntity, BaseProps } from 'src/shared/entities/base';

export type ImportLogStatus = 'em_andamento' | 'concluido' | 'erro';

interface ImportLogProps {
  clienteId: string;
  criadoPor?: string;
  filename: string;
  totalLinhas: number;
  importados: number;
  comErro: number;
  ignorados: number;
  duplicados: number;
  geocodificados: number;
  geoFalhou: number;
  status: ImportLogStatus;
  erros?: object;
  finishedAt?: Date;
}

export class ImportLog extends BaseEntity<ImportLogProps> {
  private props: ImportLogProps;

  constructor(props: ImportLogProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }

  get clienteId() {
    return this.props.clienteId;
  }

  get criadoPor() {
    return this.props.criadoPor;
  }

  get filename() {
    return this.props.filename;
  }

  get totalLinhas() {
    return this.props.totalLinhas;
  }

  get importados() {
    return this.props.importados;
  }

  get comErro() {
    return this.props.comErro;
  }

  get ignorados() {
    return this.props.ignorados;
  }

  get duplicados() {
    return this.props.duplicados;
  }

  get geocodificados() {
    return this.props.geocodificados;
  }

  get geoFalhou() {
    return this.props.geoFalhou;
  }

  get status() {
    return this.props.status;
  }

  get erros() {
    return this.props.erros;
  }

  get finishedAt() {
    return this.props.finishedAt;
  }
}
