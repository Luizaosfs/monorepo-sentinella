import { BaseEntity, BaseProps } from 'src/shared/entities/base';
import { Paginated } from 'src/utils/pagination';

interface ClienteProps {
  nome: string;
  slug: string;
  cnpj?: string;
  contatoEmail?: string;
  contatoTelefone?: string;
  latitudeCentro?: number;
  longitudeCentro?: number;
  bounds?: object;
  kmzUrl?: string;
  ativo: boolean;
  area?: object;
  endereco?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  uf?: string;
  ibgeMunicipio?: string;
  surtoAtivo: boolean;
  janelaRecorrenciaDias: number;
}

export class Cliente extends BaseEntity<ClienteProps> {
  private props: ClienteProps;

  constructor(props: ClienteProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }

  get nome() {
    return this.props.nome;
  }
  set nome(v: string) {
    this.props.nome = v;
  }

  get slug() {
    return this.props.slug;
  }
  set slug(v: string) {
    this.props.slug = v;
  }

  get cnpj() {
    return this.props.cnpj;
  }
  set cnpj(v: string | undefined) {
    this.props.cnpj = v;
  }

  get contatoEmail() {
    return this.props.contatoEmail;
  }
  set contatoEmail(v: string | undefined) {
    this.props.contatoEmail = v;
  }

  get contatoTelefone() {
    return this.props.contatoTelefone;
  }
  set contatoTelefone(v: string | undefined) {
    this.props.contatoTelefone = v;
  }

  get latitudeCentro() {
    return this.props.latitudeCentro;
  }
  set latitudeCentro(v: number | undefined) {
    this.props.latitudeCentro = v;
  }

  get longitudeCentro() {
    return this.props.longitudeCentro;
  }
  set longitudeCentro(v: number | undefined) {
    this.props.longitudeCentro = v;
  }

  get bounds() {
    return this.props.bounds;
  }
  set bounds(v: object | undefined) {
    this.props.bounds = v;
  }

  get kmzUrl() {
    return this.props.kmzUrl;
  }
  set kmzUrl(v: string | undefined) {
    this.props.kmzUrl = v;
  }

  get ativo() {
    return this.props.ativo;
  }
  set ativo(v: boolean) {
    this.props.ativo = v;
  }

  get area() {
    return this.props.area;
  }
  set area(v: object | undefined) {
    this.props.area = v;
  }

  get endereco() {
    return this.props.endereco;
  }
  set endereco(v: string | undefined) {
    this.props.endereco = v;
  }

  get bairro() {
    return this.props.bairro;
  }
  set bairro(v: string | undefined) {
    this.props.bairro = v;
  }

  get cidade() {
    return this.props.cidade;
  }
  set cidade(v: string | undefined) {
    this.props.cidade = v;
  }

  get estado() {
    return this.props.estado;
  }
  set estado(v: string | undefined) {
    this.props.estado = v;
  }

  get cep() {
    return this.props.cep;
  }
  set cep(v: string | undefined) {
    this.props.cep = v;
  }

  get uf() {
    return this.props.uf;
  }
  set uf(v: string | undefined) {
    this.props.uf = v;
  }

  get ibgeMunicipio() {
    return this.props.ibgeMunicipio;
  }
  set ibgeMunicipio(v: string | undefined) {
    this.props.ibgeMunicipio = v;
  }

  get surtoAtivo() {
    return this.props.surtoAtivo;
  }
  set surtoAtivo(v: boolean) {
    this.props.surtoAtivo = v;
  }

  get janelaRecorrenciaDias() {
    return this.props.janelaRecorrenciaDias;
  }
  set janelaRecorrenciaDias(v: number) {
    this.props.janelaRecorrenciaDias = v;
  }
}

export class ClientePaginated extends Paginated<Cliente>() {}
