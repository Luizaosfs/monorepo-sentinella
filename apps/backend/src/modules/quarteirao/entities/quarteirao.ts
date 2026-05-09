import { BaseEntity, BaseProps } from 'src/shared/entities/base';
import type { JsonObject } from '@shared/types/json';

interface QuarteiraoProps {
  clienteId: string;
  regiaoId?: string;
  codigo: string;
  bairro?: string;
  ativo: boolean;
  geojson?: JsonObject;
  latitude?: number | null;
  longitude?: number | null;
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

  get regiaoId() {
    return this.props.regiaoId;
  }
  set regiaoId(v: string | undefined) {
    this.props.regiaoId = v;
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
}

interface DistribuicaoQuarteiraoProps {
  clienteId: string;
  ciclo: number;
  quarteirao: string;
  agenteId: string;
  regiaoId?: string;
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

  get ciclo() {
    return this.props.ciclo;
  }
  set ciclo(v: number) {
    this.props.ciclo = v;
  }

  get quarteirao() {
    return this.props.quarteirao;
  }
  set quarteirao(v: string) {
    this.props.quarteirao = v;
  }

  get agenteId() {
    return this.props.agenteId;
  }
  set agenteId(v: string) {
    this.props.agenteId = v;
  }

  get regiaoId() {
    return this.props.regiaoId;
  }
  set regiaoId(v: string | undefined) {
    this.props.regiaoId = v;
  }
}
