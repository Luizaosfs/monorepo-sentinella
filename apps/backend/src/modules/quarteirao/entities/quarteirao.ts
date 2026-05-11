import { BaseEntity, BaseProps } from 'src/shared/entities/base';
import type { JsonObject } from '@shared/types/json';

interface QuarteiraoProps {
  clienteId: string;
  bairroId?: string;
  codigo: string;
  bairro?: string;
  ativo: boolean;
  geojson?: JsonObject;
  latitude?: number | null;
  longitude?: number | null;
  areaM2?: number | null;
}

export class Quarteirao extends BaseEntity<QuarteiraoProps> {
  private props: QuarteiraoProps;

  constructor(props: QuarteiraoProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }

  get clienteId() {
    return this.props.clienteId;
  }

  get bairroId() {
    return this.props.bairroId;
  }
  set bairroId(v: string | undefined) {
    this.props.bairroId = v;
  }

  get codigo() {
    return this.props.codigo;
  }
  set codigo(v: string) {
    this.props.codigo = v;
  }

  get bairro() {
    return this.props.bairro;
  }
  set bairro(v: string | undefined) {
    this.props.bairro = v;
  }

  get ativo() {
    return this.props.ativo;
  }
  set ativo(v: boolean) {
    this.props.ativo = v;
  }

  get geojson() {
    return this.props.geojson;
  }
  set geojson(v: JsonObject | undefined) {
    this.props.geojson = v;
  }

  get latitude() {
    return this.props.latitude;
  }
  set latitude(v: number | null | undefined) {
    this.props.latitude = v;
  }

  get longitude() {
    return this.props.longitude;
  }
  set longitude(v: number | null | undefined) {
    this.props.longitude = v;
  }

  get areaM2() {
    return this.props.areaM2;
  }
  set areaM2(v: number | null | undefined) {
    this.props.areaM2 = v;
  }
}

interface DistribuicaoQuarteiraoProps {
  clienteId: string;
  cicloId: string | null;
  quadraId: string;
  agenteId: string;
  bairroId?: string;
}

export class DistribuicaoQuarteirao extends BaseEntity<DistribuicaoQuarteiraoProps> {
  private props: DistribuicaoQuarteiraoProps;

  constructor(props: DistribuicaoQuarteiraoProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }

  get clienteId() {
    return this.props.clienteId;
  }

  get cicloId() {
    return this.props.cicloId;
  }
  set cicloId(v: string | null) {
    this.props.cicloId = v;
  }

  get quadraId() {
    return this.props.quadraId;
  }
  set quadraId(v: string) {
    this.props.quadraId = v;
  }

  get agenteId() {
    return this.props.agenteId;
  }
  set agenteId(v: string) {
    this.props.agenteId = v;
  }

  get bairroId() {
    return this.props.bairroId;
  }
  set bairroId(v: string | undefined) {
    this.props.bairroId = v;
  }
}
