import { BaseEntity, BaseProps } from 'src/shared/entities/base';
import { Paginated } from 'src/utils/pagination';

interface ImovelProps {
  clienteId: string;
  regiaoId?: string;
  tipoImovel: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  quarteirao?: string;
  latitude?: number;
  longitude?: number;
  ativo: boolean;
  proprietarioAusente: boolean;
  tipoAusencia?: string;
  contatoProprietario?: string;
  temAnimalAgressivo: boolean;
  historicoRecusa: boolean;
  temCalha: boolean;
  calhaAcessivel: boolean;
  prioridadeDrone: boolean;
  notificacaoFormalEm?: Date;
}

export class Imovel extends BaseEntity<ImovelProps> {
  private props: ImovelProps;

  constructor(props: ImovelProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }

  get clienteId() {
    return this.props.clienteId;
  }
  get regiaoId() {
    return this.props.regiaoId;
  }
  set regiaoId(v: string | undefined) {
    this.props.regiaoId = v;
  }
  get tipoImovel() {
    return this.props.tipoImovel;
  }
  set tipoImovel(v: string) {
    this.props.tipoImovel = v;
  }
  get logradouro() {
    return this.props.logradouro;
  }
  set logradouro(v: string | undefined) {
    this.props.logradouro = v;
  }
  get numero() {
    return this.props.numero;
  }
  set numero(v: string | undefined) {
    this.props.numero = v;
  }
  get complemento() {
    return this.props.complemento;
  }
  set complemento(v: string | undefined) {
    this.props.complemento = v;
  }
  get bairro() {
    return this.props.bairro;
  }
  set bairro(v: string | undefined) {
    this.props.bairro = v;
  }
  get quarteirao() {
    return this.props.quarteirao;
  }
  set quarteirao(v: string | undefined) {
    this.props.quarteirao = v;
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
  get proprietarioAusente() {
    return this.props.proprietarioAusente;
  }
  set proprietarioAusente(v: boolean) {
    this.props.proprietarioAusente = v;
  }
  get tipoAusencia() {
    return this.props.tipoAusencia;
  }
  set tipoAusencia(v: string | undefined) {
    this.props.tipoAusencia = v;
  }
  get contatoProprietario() {
    return this.props.contatoProprietario;
  }
  set contatoProprietario(v: string | undefined) {
    this.props.contatoProprietario = v;
  }
  get temAnimalAgressivo() {
    return this.props.temAnimalAgressivo;
  }
  set temAnimalAgressivo(v: boolean) {
    this.props.temAnimalAgressivo = v;
  }
  get historicoRecusa() {
    return this.props.historicoRecusa;
  }
  set historicoRecusa(v: boolean) {
    this.props.historicoRecusa = v;
  }
  get temCalha() {
    return this.props.temCalha;
  }
  set temCalha(v: boolean) {
    this.props.temCalha = v;
  }
  get calhaAcessivel() {
    return this.props.calhaAcessivel;
  }
  set calhaAcessivel(v: boolean) {
    this.props.calhaAcessivel = v;
  }
  get prioridadeDrone() {
    return this.props.prioridadeDrone;
  }
  set prioridadeDrone(v: boolean) {
    this.props.prioridadeDrone = v;
  }
  get notificacaoFormalEm() {
    return this.props.notificacaoFormalEm;
  }
  set notificacaoFormalEm(v: Date | undefined) {
    this.props.notificacaoFormalEm = v;
  }
}

export class ImovelPaginated extends Paginated<Imovel>() {}
