import { BaseEntity, BaseProps } from 'src/shared/entities/base';
import { Paginated } from 'src/utils/pagination';

// ── PluvioRun ─────────────────────────────────────────────────────────────────

interface PluvioRunProps {
  clienteId: string;
  dataReferencia: Date;
  total?: number;
  status?: string;
}

export class PluvioRun extends BaseEntity<PluvioRunProps> {
  private props: PluvioRunProps;

  constructor(props: PluvioRunProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }

  get clienteId() {
    return this.props.clienteId;
  }
  get dataReferencia() {
    return this.props.dataReferencia;
  }
  set dataReferencia(v: Date) {
    this.props.dataReferencia = v;
  }
  get total() {
    return this.props.total;
  }
  set total(v: number | undefined) {
    this.props.total = v;
  }
  get status() {
    return this.props.status;
  }
  set status(v: string | undefined) {
    this.props.status = v;
  }
}

export class PluvioRunPaginated extends Paginated<PluvioRun>() {}

// ── PluvioItem ────────────────────────────────────────────────────────────────

interface PluvioItemProps {
  runId: string;
  regiaoId?: string;
  imovelId?: string;
  precipitacao: number;
  nivelRisco: string;
}

export class PluvioItem extends BaseEntity<PluvioItemProps> {
  private props: PluvioItemProps;

  constructor(props: PluvioItemProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }

  get runId() {
    return this.props.runId;
  }
  get regiaoId() {
    return this.props.regiaoId;
  }
  set regiaoId(v: string | undefined) {
    this.props.regiaoId = v;
  }
  get imovelId() {
    return this.props.imovelId;
  }
  set imovelId(v: string | undefined) {
    this.props.imovelId = v;
  }
  get precipitacao() {
    return this.props.precipitacao;
  }
  set precipitacao(v: number) {
    this.props.precipitacao = v;
  }
  get nivelRisco() {
    return this.props.nivelRisco;
  }
  set nivelRisco(v: string) {
    this.props.nivelRisco = v;
  }
}

// ── PluvioRisco ───────────────────────────────────────────────────────────────

interface PluvioRiscoProps {
  regiaoId: string;
  nivel: string;
  precipitacaoAcumulada: number;
  dataReferencia: Date;
  observacoes?: string;
}

export class PluvioRisco extends BaseEntity<PluvioRiscoProps> {
  private props: PluvioRiscoProps;

  constructor(props: PluvioRiscoProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }

  get regiaoId() {
    return this.props.regiaoId;
  }
  get nivel() {
    return this.props.nivel;
  }
  set nivel(v: string) {
    this.props.nivel = v;
  }
  get precipitacaoAcumulada() {
    return this.props.precipitacaoAcumulada;
  }
  set precipitacaoAcumulada(v: number) {
    this.props.precipitacaoAcumulada = v;
  }
  get dataReferencia() {
    return this.props.dataReferencia;
  }
  set dataReferencia(v: Date) {
    this.props.dataReferencia = v;
  }
  get observacoes() {
    return this.props.observacoes;
  }
  set observacoes(v: string | undefined) {
    this.props.observacoes = v;
  }
}
