import { BaseEntity, BaseProps } from 'src/shared/entities/base';

// ── Scalar types ──────────────────────────────────────────────────────────────

export type DroneRisco = 'baixo' | 'medio' | 'alto';
export type DronePrioridade = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
export type TendenciaTipo = 'crescente' | 'estavel' | 'decrescente';

// ── Value objects (child sub-tables, managed via policy transaction) ───────────

export interface RiskDefaults {
  id?: string;
  policyId: string;
  chuvaRelevantemm: number;
  diasLookupMax: number;
  tendenciaDias: number;
  createdAt?: Date;
}

export interface RiskFallbackRule {
  id?: string;
  policyId: string;
  situacaoAmbiental: string;
  probabilidadeLabel: string;
  probabilidadePctMin: number;
  probabilidadePctMax: number;
  classificacao: string;
  icone: string;
  severity: number;
  createdAt?: Date;
}

export interface RiskRule {
  id?: string;
  policyId: string;
  idx: number;
  chuvaMMMin: number;
  chuvaMMMax: number;
  diasMin: number;
  diasMax: number;
  situacaoAmbiental: string;
  probabilidadeLabel: string;
  probabilidadePctMin: number;
  probabilidadePctMax: number;
  classificacao: string;
  icone: string;
  severity: number;
  createdAt?: Date;
}

export interface RiskBin {
  id?: string;
  policyId: string;
  idx: number;
  minVal: number;
  maxVal: number;
}

export interface RiskFactor {
  id?: string;
  policyId: string;
  idx: number;
  minVal: number;
  maxVal: number;
  factor: number;
}

export interface RiskAdjustPp {
  id?: string;
  policyId: string;
  idx: number;
  minVal: number;
  maxVal: number;
  deltaPp: number;
}

export interface RiskTendenciaAdjustPp {
  id?: string;
  policyId: string;
  tendencia: TendenciaTipo;
  deltaPp: number;
}

// ── Full policy aggregate ─────────────────────────────────────────────────────

export interface RiskPolicyFull {
  policy: RiskPolicy;
  defaults: RiskDefaults | null;
  fallbackRule: RiskFallbackRule | null;
  rules: RiskRule[];
  binsSemChuva: RiskBin[];
  binsIntensidadeChuva: RiskBin[];
  binsPersistencia7d: RiskBin[];
  tempFactors: RiskFactor[];
  ventoFactors: RiskFactor[];
  tempAdjustPp: RiskAdjustPp[];
  ventoAdjustPp: RiskAdjustPp[];
  persistenciaAdjustPp: RiskAdjustPp[];
  tendenciaAdjustPp: RiskTendenciaAdjustPp[];
}

// ── RiskPolicy (header entity) ────────────────────────────────────────────────

interface RiskPolicyProps {
  clienteId: string;
  name: string;
  version: string;
  isActive: boolean;
}

export class RiskPolicy extends BaseEntity<RiskPolicyProps> {
  private props: RiskPolicyProps;

  constructor(props: RiskPolicyProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }

  get clienteId() { return this.props.clienteId; }
  get name() { return this.props.name; }
  set name(v: string) { this.props.name = v; }
  get version() { return this.props.version; }
  set version(v: string) { this.props.version = v; }
  get isActive() { return this.props.isActive; }
  set isActive(v: boolean) { this.props.isActive = v; }
}

// ── DroneRiskConfig ───────────────────────────────────────────────────────────

interface DroneRiskConfigProps {
  clienteId: string;
  baseByRisco: Record<DroneRisco, number>;
  priorityThresholds: Record<DronePrioridade, number>;
  slaByPriorityHours: Record<DronePrioridade, number>;
  confidenceMultiplier: number;
  itemOverrides: Record<string, { min_score?: number; force_priority?: DronePrioridade }>;
}

export class DroneRiskConfig extends BaseEntity<DroneRiskConfigProps> {
  private props: DroneRiskConfigProps;

  constructor(props: DroneRiskConfigProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }

  get clienteId() { return this.props.clienteId; }
  get baseByRisco() { return this.props.baseByRisco; }
  set baseByRisco(v: Record<DroneRisco, number>) { this.props.baseByRisco = v; }
  get priorityThresholds() { return this.props.priorityThresholds; }
  set priorityThresholds(v: Record<DronePrioridade, number>) { this.props.priorityThresholds = v; }
  get slaByPriorityHours() { return this.props.slaByPriorityHours; }
  set slaByPriorityHours(v: Record<DronePrioridade, number>) { this.props.slaByPriorityHours = v; }
  get confidenceMultiplier() { return this.props.confidenceMultiplier; }
  set confidenceMultiplier(v: number) { this.props.confidenceMultiplier = v; }
  get itemOverrides() { return this.props.itemOverrides; }
  set itemOverrides(v: Record<string, { min_score?: number; force_priority?: DronePrioridade }>) { this.props.itemOverrides = v; }
}

// ── YoloClassConfig ───────────────────────────────────────────────────────────

interface YoloClassConfigProps {
  clienteId: string;
  itemKey: string;
  item: string;
  risco: DroneRisco;
  peso: number;
  acao?: string;
  isActive: boolean;
}

export class YoloClassConfig extends BaseEntity<YoloClassConfigProps> {
  private props: YoloClassConfigProps;

  constructor(props: YoloClassConfigProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }

  get clienteId() { return this.props.clienteId; }
  get itemKey() { return this.props.itemKey; }
  get item() { return this.props.item; }
  set item(v: string) { this.props.item = v; }
  get risco() { return this.props.risco; }
  set risco(v: DroneRisco) { this.props.risco = v; }
  get peso() { return this.props.peso; }
  set peso(v: number) { this.props.peso = v; }
  get acao() { return this.props.acao; }
  set acao(v: string | undefined) { this.props.acao = v; }
  get isActive() { return this.props.isActive; }
  set isActive(v: boolean) { this.props.isActive = v; }
}

// ── YoloSynonym ───────────────────────────────────────────────────────────────

interface YoloSynonymProps {
  clienteId: string;
  synonym: string;
  mapsTo: string;
}

export class YoloSynonym extends BaseEntity<YoloSynonymProps> {
  private props: YoloSynonymProps;

  constructor(props: YoloSynonymProps, baseProps: BaseProps) {
    super(baseProps);
    this.props = props;
  }

  get clienteId() { return this.props.clienteId; }
  get synonym() { return this.props.synonym; }
  get mapsTo() { return this.props.mapsTo; }
}
