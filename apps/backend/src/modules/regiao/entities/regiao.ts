import { BaseEntity, BaseProps } from '@shared/entities/base';
import type { JsonObject } from '@shared/types/json';
import { Paginated } from 'src/utils/pagination';

interface RegiaoProps {
  clienteId: string;
  nome: string;
  tipo?: string;
  cor?: string;
  geojson?: JsonObject;
  ativo: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

export class Regiao extends BaseEntity<RegiaoProps> {
  private props: RegiaoProps;

  constructor(props: RegiaoProps, baseProps: BaseProps) {
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
  set tipo(v: string | undefined) {
    this.props.tipo = v;
  }
  get cor() {
    return this.props.cor;
  }
  set cor(v: string | undefined) {
    this.props.cor = v;
  }
  get geojson() {
    return this.props.geojson;
  }
  set geojson(v: JsonObject | undefined) {
    this.props.geojson = v;
  }
  get ativo() {
    return this.props.ativo;
  }
  set ativo(v: boolean) {
    this.props.ativo = v;
  }
  get latitude() {
    return this.props.latitude;
  }
  get longitude() {
    return this.props.longitude;
  }
}

export class RegiaoPaginated extends Paginated<Regiao>() {}
