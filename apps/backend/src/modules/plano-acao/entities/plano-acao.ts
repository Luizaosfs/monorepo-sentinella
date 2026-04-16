import { BaseEntity, BaseProps } from 'src/shared/entities/base';

interface PlanoAcaoProps {
  clienteId: string;
  label: string;
  descricao?: string;
  tipoItem?: string;
  ativo: boolean;
  ordem: number;
}

export class PlanoAcao extends BaseEntity<PlanoAcaoProps> {
  private props: PlanoAcaoProps;

  constructor(props: PlanoAcaoProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }

  get clienteId() {
    return this.props.clienteId;
  }
  set clienteId(v: string) {
    this.props.clienteId = v;
  }

  get label() {
    return this.props.label;
  }
  set label(v: string) {
    this.props.label = v;
  }

  get descricao() {
    return this.props.descricao;
  }
  set descricao(v: string | undefined) {
    this.props.descricao = v;
  }

  get tipoItem() {
    return this.props.tipoItem;
  }
  set tipoItem(v: string | undefined) {
    this.props.tipoItem = v;
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
  set ordem(v: number) {
    this.props.ordem = v;
  }
}
