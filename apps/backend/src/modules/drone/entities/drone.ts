import { BaseEntity, BaseProps } from '@shared/entities/base';
import type { JsonObject } from '@shared/types/json';
import { Paginated } from 'src/utils/pagination';

interface DroneProps {
  clienteId: string;
  nome: string;
  modelo?: string;
  serial?: string;
  ativo: boolean;
}

export class Drone extends BaseEntity<DroneProps> {
  private props: DroneProps;
  constructor(props: DroneProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }
  get clienteId() { return this.props.clienteId; }
  get nome() { return this.props.nome; }
  set nome(v: string) { this.props.nome = v; }
  get modelo() { return this.props.modelo; }
  set modelo(v: string | undefined) { this.props.modelo = v; }
  get serial() { return this.props.serial; }
  set serial(v: string | undefined) { this.props.serial = v; }
  get ativo() { return this.props.ativo; }
  set ativo(v: boolean) { this.props.ativo = v; }
}

interface VooProps {
  planejamentoId?: string;
  vooNumero?: number;
  inicio: Date;
  fim?: Date;
  duracaoMin?: number;
  km?: number;
  ha?: number;
  baterias?: number;
  fotos?: number;
  amostraLat?: number;
  amostraLon?: number;
  amostraDataHora?: Date;
  amostraArquivo?: string;
  wxError?: string;
  wxDetail?: string;
  pilotoId?: string;
}

export class Voo extends BaseEntity<VooProps> {
  private props: VooProps;
  constructor(props: VooProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }
  get planejamentoId() { return this.props.planejamentoId; }
  set planejamentoId(v: string | undefined) { this.props.planejamentoId = v; }
  get vooNumero() { return this.props.vooNumero; }
  get inicio() { return this.props.inicio; }
  set inicio(v: Date) { this.props.inicio = v; }
  get fim() { return this.props.fim; }
  set fim(v: Date | undefined) { this.props.fim = v; }
  get duracaoMin() { return this.props.duracaoMin; }
  get km() { return this.props.km; }
  get ha() { return this.props.ha; }
  get baterias() { return this.props.baterias; }
  get fotos() { return this.props.fotos; }
  get amostraLat() { return this.props.amostraLat; }
  get amostraLon() { return this.props.amostraLon; }
  get amostraDataHora() { return this.props.amostraDataHora; }
  get amostraArquivo() { return this.props.amostraArquivo; }
  get wxError() { return this.props.wxError; }
  get wxDetail() { return this.props.wxDetail; }
  get pilotoId() { return this.props.pilotoId; }
  set pilotoId(v: string | undefined) { this.props.pilotoId = v; }
}

interface PipelineRunProps {
  clienteId: string;
  vooId?: string;
  levantamentoId?: string;
  status: string;
  totalImagens?: number;
  imagensProcessadas?: number;
  itensGerados?: number;
  focosCriados?: number;
  erroMensagem?: string;
  erroDetalhe?: JsonObject;
  versaoPipeline?: string;
  iniciadoEm: Date;
  concluidoEm?: Date;
}

export class PipelineRun extends BaseEntity<PipelineRunProps> {
  private props: PipelineRunProps;
  constructor(props: PipelineRunProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }
  get clienteId() { return this.props.clienteId; }
  get vooId() { return this.props.vooId; }
  get levantamentoId() { return this.props.levantamentoId; }
  get status() { return this.props.status; }
  set status(v: string) { this.props.status = v; }
  get totalImagens() { return this.props.totalImagens; }
  get imagensProcessadas() { return this.props.imagensProcessadas; }
  set imagensProcessadas(v: number | undefined) { this.props.imagensProcessadas = v; }
  get itensGerados() { return this.props.itensGerados; }
  get focosCriados() { return this.props.focosCriados; }
  get erroMensagem() { return this.props.erroMensagem; }
  get versaoPipeline() { return this.props.versaoPipeline; }
  get iniciadoEm() { return this.props.iniciadoEm; }
  get concluidoEm() { return this.props.concluidoEm; }
  set concluidoEm(v: Date | undefined) { this.props.concluidoEm = v; }
}

interface YoloFeedbackProps {
  levantamentoItemId: string;
  clienteId: string;
  confirmado: boolean;
  observacao?: string;
  registradoPor?: string;
}

export class YoloFeedback extends BaseEntity<YoloFeedbackProps> {
  private props: YoloFeedbackProps;
  constructor(props: YoloFeedbackProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }
  get levantamentoItemId() { return this.props.levantamentoItemId; }
  get clienteId() { return this.props.clienteId; }
  get confirmado() { return this.props.confirmado; }
  get observacao() { return this.props.observacao; }
  get registradoPor() { return this.props.registradoPor; }
}

export class DronePaginated extends Paginated<Drone>() {}
