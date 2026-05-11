export interface AtribuicaoState {
  salvo: string;
  pendente: string;
}

export type Filtro = 'todas' | 'atribuidas' | 'sem_atribuicao' | 'sem_geometria' | 'selecionadas';

export type RegiaoEntry = { nome: string; qs: string[] };

export interface CoberturaItem {
  quadra_id: string;
  quarteirao: string;
  total_imoveis: number;
  visitados: number;
  pct_cobertura: number;
}

/** Quarteirão com geometria cadastrada — usado na camada principal do mapa. */
export interface QuarteiraoPolygon {
  id: string;
  codigo: string;
  bairroId: string | null;
  geojson: Record<string, unknown>;
}

/** Quarteirão selecionado para edição de geometria (geojson pode ser null se ainda não desenhado). */
export interface QuarteiraoParaEdicao {
  id: string;
  codigo: string;
  bairroId: string | null;
  geojson: Record<string, unknown> | null;
}
