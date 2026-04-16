import { BaseEntity, BaseProps } from '@shared/entities/base';
import type { JsonObject } from '@shared/types/json';

interface PlanoProps {
  nome: string;
  descricao?: string;
  precoMensal?: number;
  limiteUsuarios?: number;
  limiteImoveis?: number;
  limiteVistoriasMes?: number;
  limiteLevantamentosMes?: number;
  limiteVoosMes?: number;
  limiteStorageGb?: number;
  limiteIaCallsMes?: number;
  limiteDenunciasMes?: number;
  droneHabilitado: boolean;
  slaAvancado: boolean;
  integracoesHabilitadas: string[];
  ativo: boolean;
  ordem: number;
}

export class Plano extends BaseEntity<PlanoProps> {
  private props: PlanoProps;
  constructor(props: PlanoProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }
  get nome() {
    return this.props.nome;
  }
  set nome(v: string) {
    this.props.nome = v;
  }
  get descricao() {
    return this.props.descricao;
  }
  set descricao(v: string | undefined) {
    this.props.descricao = v;
  }
  get precoMensal() {
    return this.props.precoMensal;
  }
  set precoMensal(v: number | undefined) {
    this.props.precoMensal = v;
  }
  get limiteUsuarios() {
    return this.props.limiteUsuarios;
  }
  get limiteImoveis() {
    return this.props.limiteImoveis;
  }
  get limiteVistoriasMes() {
    return this.props.limiteVistoriasMes;
  }
  get limiteLevantamentosMes() {
    return this.props.limiteLevantamentosMes;
  }
  get limiteVoosMes() {
    return this.props.limiteVoosMes;
  }
  get limiteStorageGb() {
    return this.props.limiteStorageGb;
  }
  get limiteIaCallsMes() {
    return this.props.limiteIaCallsMes;
  }
  get limiteDenunciasMes() {
    return this.props.limiteDenunciasMes;
  }
  get droneHabilitado() {
    return this.props.droneHabilitado;
  }
  get slaAvancado() {
    return this.props.slaAvancado;
  }
  get integracoesHabilitadas() {
    return this.props.integracoesHabilitadas;
  }
  get ativo() {
    return this.props.ativo;
  }
  set ativo(v: boolean) {
    this.props.ativo = v;
  }
  get ordem() {
    return this.props.ordem;
  }
}

interface ClientePlanoProps {
  clienteId: string;
  planoId: string;
  dataInicio: Date;
  dataFim?: Date;
  status: string;
  limitesPersonalizados?: JsonObject;
  contratoRef?: string;
  observacao?: string;
  dataTrialFim?: Date;
}

export class ClientePlano extends BaseEntity<ClientePlanoProps> {
  private props: ClientePlanoProps;
  constructor(props: ClientePlanoProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }
  get clienteId() {
    return this.props.clienteId;
  }
  get planoId() {
    return this.props.planoId;
  }
  get dataInicio() {
    return this.props.dataInicio;
  }
  get dataFim() {
    return this.props.dataFim;
  }
  set dataFim(v: Date | undefined) {
    this.props.dataFim = v;
  }
  get status() {
    return this.props.status;
  }
  set status(v: string) {
    this.props.status = v;
  }
  get limitesPersonalizados() {
    return this.props.limitesPersonalizados;
  }
  get contratoRef() {
    return this.props.contratoRef;
  }
  get observacao() {
    return this.props.observacao;
  }
  get dataTrialFim() {
    return this.props.dataTrialFim;
  }
}

interface BillingCicloProps {
  clienteId: string;
  clientePlanoId?: string;
  periodoInicio: Date;
  periodoFim: Date;
  status: string;
  valorBase?: number;
  valorExcedente: number;
  valorTotal?: number;
  notaFiscalRef?: string;
  pagoEm?: Date;
  observacao?: string;
}

export class BillingCiclo extends BaseEntity<BillingCicloProps> {
  private props: BillingCicloProps;
  constructor(props: BillingCicloProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }
  get clienteId() {
    return this.props.clienteId;
  }
  get clientePlanoId() {
    return this.props.clientePlanoId;
  }
  get periodoInicio() {
    return this.props.periodoInicio;
  }
  get periodoFim() {
    return this.props.periodoFim;
  }
  get status() {
    return this.props.status;
  }
  set status(v: string) {
    this.props.status = v;
  }
  get valorBase() {
    return this.props.valorBase;
  }
  get valorExcedente() {
    return this.props.valorExcedente;
  }
  get valorTotal() {
    return this.props.valorTotal;
  }
  get notaFiscalRef() {
    return this.props.notaFiscalRef;
  }
  get pagoEm() {
    return this.props.pagoEm;
  }
  set pagoEm(v: Date | undefined) {
    this.props.pagoEm = v;
  }
  get observacao() {
    return this.props.observacao;
  }
}

interface ClienteQuotasProps {
  clienteId: string;
  voosMes?: number;
  levantamentosMes?: number;
  itensMes?: number;
  usuariosAtivos?: number;
  vistoriasMes?: number;
  iaCallsMes?: number;
  storageGb?: number;
}

export class ClienteQuotas extends BaseEntity<ClienteQuotasProps> {
  private props: ClienteQuotasProps;
  constructor(props: ClienteQuotasProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }
  get clienteId() {
    return this.props.clienteId;
  }
  get voosMes() {
    return this.props.voosMes;
  }
  get levantamentosMes() {
    return this.props.levantamentosMes;
  }
  get itensMes() {
    return this.props.itensMes;
  }
  get usuariosAtivos() {
    return this.props.usuariosAtivos;
  }
  get vistoriasMes() {
    return this.props.vistoriasMes;
  }
  get iaCallsMes() {
    return this.props.iaCallsMes;
  }
  get storageGb() {
    return this.props.storageGb;
  }
}
