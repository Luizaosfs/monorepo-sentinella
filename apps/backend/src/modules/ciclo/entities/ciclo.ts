import { BaseEntity, BaseProps } from 'src/shared/entities/base';
import { Paginated } from 'src/utils/pagination';

interface CicloProps {
  clienteId: string;
  numero: number;
  ano: number;
  status: string;
  dataInicio: Date;
  dataFimPrevista: Date;
  dataFechamento?: Date;
  metaCoberturaPct?: number;
  snapshotFechamento?: Record<string, unknown>;
  observacaoAbertura?: string;
  observacaoFechamento?: string;
  abertoPor?: string;
  fechadoPor?: string;
}

export class Ciclo extends BaseEntity<CicloProps> {
  private props: CicloProps;

  constructor(props: CicloProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }

  get clienteId() { return this.props.clienteId; }

  get numero() { return this.props.numero; }
  set numero(v: number) { this.props.numero = v; }

  get ano() { return this.props.ano; }
  set ano(v: number) { this.props.ano = v; }

  get status() { return this.props.status; }
  set status(v: string) { this.props.status = v; }

  get dataInicio() { return this.props.dataInicio; }
  set dataInicio(v: Date) { this.props.dataInicio = v; }

  get dataFimPrevista() { return this.props.dataFimPrevista; }
  set dataFimPrevista(v: Date) { this.props.dataFimPrevista = v; }

  get dataFechamento() { return this.props.dataFechamento; }
  set dataFechamento(v: Date | undefined) { this.props.dataFechamento = v; }

  get metaCoberturaPct() { return this.props.metaCoberturaPct; }
  set metaCoberturaPct(v: number | undefined) { this.props.metaCoberturaPct = v; }

  get snapshotFechamento() { return this.props.snapshotFechamento; }
  set snapshotFechamento(v: Record<string, unknown> | undefined) { this.props.snapshotFechamento = v; }

  get observacaoAbertura() { return this.props.observacaoAbertura; }
  set observacaoAbertura(v: string | undefined) { this.props.observacaoAbertura = v; }

  get observacaoFechamento() { return this.props.observacaoFechamento; }
  set observacaoFechamento(v: string | undefined) { this.props.observacaoFechamento = v; }

  get abertoPor() { return this.props.abertoPor; }
  set abertoPor(v: string | undefined) { this.props.abertoPor = v; }

  get fechadoPor() { return this.props.fechadoPor; }
  set fechadoPor(v: string | undefined) { this.props.fechadoPor = v; }
}

export class CicloPaginated extends Paginated<Ciclo>() {}
