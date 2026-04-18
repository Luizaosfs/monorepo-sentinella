import { BaseEntity, BaseProps } from 'src/shared/entities/base';
import { Paginated } from 'src/utils/pagination';

export type PapelApp =
  | 'admin'
  | 'supervisor'
  | 'agente'
  | 'notificador'
  | 'analista_regional';

interface UsuarioProps {
  authId?: string;
  nome: string;
  email: string;
  clienteId?: string;
  /** Hash da senha (criação local; persistência depende do schema/mapper). */
  senhaHash?: string;
  ativo: boolean;
  onboardingConcluido?: boolean;
  papeis: PapelApp[];
}

export class Usuario extends BaseEntity<UsuarioProps> {
  private props: UsuarioProps;

  constructor(props: UsuarioProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }

  get authId() {
    return this.props.authId;
  }
  set authId(v: string | undefined) {
    this.props.authId = v;
  }
  get senhaHash() {
    return this.props.senhaHash;
  }
  get nome() {
    return this.props.nome;
  }
  set nome(v: string) {
    this.props.nome = v;
  }
  get email() {
    return this.props.email;
  }
  set email(v: string) {
    this.props.email = v;
  }
  get clienteId() {
    return this.props.clienteId;
  }
  set clienteId(v: string | undefined) {
    this.props.clienteId = v;
  }
  get ativo() {
    return this.props.ativo;
  }
  set ativo(v: boolean) {
    this.props.ativo = v;
  }
  get onboardingConcluido() {
    return this.props.onboardingConcluido;
  }
  get papeis() {
    return this.props.papeis;
  }
  set papeis(v: PapelApp[]) {
    this.props.papeis = v;
  }
}

export class UsuarioPaginated extends Paginated<Usuario>() {}
