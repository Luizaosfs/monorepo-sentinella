import { BaseEntity, BaseProps } from '@shared/entities/base';
import type { JsonObject } from '@shared/types/json';

interface UnidadeSaudeProps {
  clienteId: string;
  nome: string;
  tipo: string;
  endereco?: string;
  latitude?: number;
  longitude?: number;
  ativo: boolean;
  cnes?: string;
  tipoSentinela: string;
  telefone?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  origem: string;
  ultimaSyncEm?: Date;
  deletedAt?: Date;
  deletedBy?: string;
}

export class UnidadeSaude extends BaseEntity<UnidadeSaudeProps> {
  private props: UnidadeSaudeProps;
  constructor(props: UnidadeSaudeProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }
  get clienteId() {
    return this.props.clienteId;
  }
  get nome() {
    return this.props.nome;
  }
  set nome(v: string) {
    this.props.nome = v;
  }
  get tipo() {
    return this.props.tipo;
  }
  set tipo(v: string) {
    this.props.tipo = v;
  }
  get endereco() {
    return this.props.endereco;
  }
  set endereco(v: string | undefined) {
    this.props.endereco = v;
  }
  get latitude() {
    return this.props.latitude;
  }
  set latitude(v: number | undefined) {
    this.props.latitude = v;
  }
  get longitude() {
    return this.props.longitude;
  }
  set longitude(v: number | undefined) {
    this.props.longitude = v;
  }
  get ativo() {
    return this.props.ativo;
  }
  set ativo(v: boolean) {
    this.props.ativo = v;
  }
  get cnes() {
    return this.props.cnes;
  }
  set cnes(v: string | undefined) {
    this.props.cnes = v;
  }
  get tipoSentinela() {
    return this.props.tipoSentinela;
  }
  set tipoSentinela(v: string) {
    this.props.tipoSentinela = v;
  }
  get telefone() {
    return this.props.telefone;
  }
  set telefone(v: string | undefined) {
    this.props.telefone = v;
  }
  get bairro() {
    return this.props.bairro;
  }
  set bairro(v: string | undefined) {
    this.props.bairro = v;
  }
  get municipio() {
    return this.props.municipio;
  }
  set municipio(v: string | undefined) {
    this.props.municipio = v;
  }
  get uf() {
    return this.props.uf;
  }
  set uf(v: string | undefined) {
    this.props.uf = v;
  }
  get origem() {
    return this.props.origem;
  }
  get ultimaSyncEm() {
    return this.props.ultimaSyncEm;
  }
  get deletedAt() {
    return this.props.deletedAt;
  }
  get deletedBy() {
    return this.props.deletedBy;
  }
}

interface CasoNotificadoProps {
  clienteId: string;
  unidadeSaudeId: string;
  notificadorId?: string;
  doenca: string;
  status: string;
  dataInicioSintomas?: Date;
  dataNotificacao: Date;
  logradouroBairro?: string;
  bairro?: string;
  latitude?: number;
  longitude?: number;
  regiaoId?: string;
  observacao?: string;
  payload?: JsonObject;
  createdBy?: string;
  deletedAt?: Date;
  deletedBy?: string;
}

export class CasoNotificado extends BaseEntity<CasoNotificadoProps> {
  private props: CasoNotificadoProps;
  constructor(props: CasoNotificadoProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }
  get clienteId() {
    return this.props.clienteId;
  }
  get unidadeSaudeId() {
    return this.props.unidadeSaudeId;
  }
  get notificadorId() {
    return this.props.notificadorId;
  }
  get doenca() {
    return this.props.doenca;
  }
  set doenca(v: string) {
    this.props.doenca = v;
  }
  get status() {
    return this.props.status;
  }
  set status(v: string) {
    this.props.status = v;
  }
  get dataInicioSintomas() {
    return this.props.dataInicioSintomas;
  }
  set dataInicioSintomas(v: Date | undefined) {
    this.props.dataInicioSintomas = v;
  }
  get dataNotificacao() {
    return this.props.dataNotificacao;
  }
  get logradouroBairro() {
    return this.props.logradouroBairro;
  }
  set logradouroBairro(v: string | undefined) {
    this.props.logradouroBairro = v;
  }
  get bairro() {
    return this.props.bairro;
  }
  set bairro(v: string | undefined) {
    this.props.bairro = v;
  }
  get latitude() {
    return this.props.latitude;
  }
  set latitude(v: number | undefined) {
    this.props.latitude = v;
  }
  get longitude() {
    return this.props.longitude;
  }
  set longitude(v: number | undefined) {
    this.props.longitude = v;
  }
  get regiaoId() {
    return this.props.regiaoId;
  }
  set regiaoId(v: string | undefined) {
    this.props.regiaoId = v;
  }
  get observacao() {
    return this.props.observacao;
  }
  set observacao(v: string | undefined) {
    this.props.observacao = v;
  }
  get payload() {
    return this.props.payload;
  }
  get createdBy() {
    return this.props.createdBy;
  }
  get deletedAt() {
    return this.props.deletedAt;
  }
  get deletedBy() {
    return this.props.deletedBy;
  }
}

interface PushSubscriptionProps {
  usuarioId: string;
  clienteId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export class PushSubscription extends BaseEntity<PushSubscriptionProps> {
  private props: PushSubscriptionProps;
  constructor(props: PushSubscriptionProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }
  get usuarioId() {
    return this.props.usuarioId;
  }
  get clienteId() {
    return this.props.clienteId;
  }
  get endpoint() {
    return this.props.endpoint;
  }
  get p256dh() {
    return this.props.p256dh;
  }
  get auth() {
    return this.props.auth;
  }
}

interface ItemNotificacaoEsusProps {
  clienteId: string;
  levantamentoItemId?: string;
  tipoAgravo: string;
  numeroNotificacao?: string;
  status: string;
  payloadEnviado?: JsonObject;
  respostaApi?: JsonObject;
  erroMensagem?: string;
  enviadoPor?: string;
}

export class ItemNotificacaoEsus extends BaseEntity<ItemNotificacaoEsusProps> {
  private props: ItemNotificacaoEsusProps;
  constructor(props: ItemNotificacaoEsusProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }
  get clienteId() {
    return this.props.clienteId;
  }
  get levantamentoItemId() {
    return this.props.levantamentoItemId;
  }
  get tipoAgravo() {
    return this.props.tipoAgravo;
  }
  get numeroNotificacao() {
    return this.props.numeroNotificacao;
  }
  get status() {
    return this.props.status;
  }
  set status(v: string) {
    this.props.status = v;
  }
  get payloadEnviado() {
    return this.props.payloadEnviado;
  }
  get respostaApi() {
    return this.props.respostaApi;
  }
  get erroMensagem() {
    return this.props.erroMensagem;
  }
  get enviadoPor() {
    return this.props.enviadoPor;
  }
}
