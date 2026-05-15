import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Porte da RPC legada `criar_pluvio_run_com_itens(p_run_row jsonb, p_itens jsonb)`.
 * Contrato em camelCase (o api-client do frontend faz deepToCamel antes do POST).
 * Resiliente como o import da tela: nullif/trim em strings, '' → null em números,
 * defaults nos 3 campos NOT NULL (bairro_nome / classificacao_risco / prioridade_operacional).
 */

const toNumOrNull = (v: unknown): number | null => {
  if (v === '' || v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const toStrOrNull = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

/**
 * Normaliza chaves snake_case → camelCase (1 nível). O frontend já manda
 * camelCase (deepToCamel), mas o pipeline Python monta snake_case
 * (bairro_nome, chuva_24h_mm) — aceitar ambos preserva a paridade com a
 * RPC legada, que recebia jsonb snake_case.
 */
const camelizeKeys = (v: unknown): unknown => {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) return v;
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    out[k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())] = val;
  }
  return out;
};

const numNull = z.preprocess(toNumOrNull, z.number().nullable()).optional();
const intNull = z.preprocess(toNumOrNull, z.number().int().nullable()).optional();
const strNull = z.preprocess(toStrOrNull, z.string().nullable()).optional();
const strDefault = (d: string) => z.preprocess((v) => toStrOrNull(v) ?? d, z.string());

const itemSchema = z.preprocess(camelizeKeys, z.object({
  // schema atual usa bairro_id; pipeline Python legado mandava regiao_id — aceita ambos
  bairroId: z.string().uuid().nullish(),
  regiaoId: z.string().uuid().nullish(),
  bairroNome: strDefault('—'),
  classificacaoRisco: strDefault('Baixo'),
  situacaoAmbiental: strNull,
  chuva24hMm: numNull,
  chuva72hMm: numNull,
  chuva7dMm: numNull,
  diasComChuva7d: intNull,
  janelaSemChuva: strNull,
  persistencia7d: strNull,
  tendencia: strNull,
  tempMediaC: numNull,
  ventoMedioKmh: numNull,
  probLabel: strNull,
  probBaseMin: numNull,
  probBaseMax: numNull,
  probFinalMin: numNull,
  probFinalMax: numNull,
  criadouroAtivo: strNull,
  velocidadeCiclo: strNull,
  janelaEmergenciaDias: strNull,
  prioridadeOperacional: strDefault('Monitoramento'),
  prazoAcao: strNull,
}));

export const criarRunComItensSchema = z.preprocess(camelizeKeys, z.object({
  // ignorado — tenant sempre vem do guard (MT-02); aceito só p/ compat de payload
  clienteId: z.string().uuid().optional(),
  dtRef: z.coerce.date({ required_error: 'Data de referência obrigatória' }),
  dtGerado: z.coerce.date().optional(),
  totalBairros: z.coerce.number().int().optional(),
  itens: z.array(itemSchema).min(1, 'Informe ao menos um item'),
}));

export class CriarRunComItensBody extends createZodDto(criarRunComItensSchema) {}
export type CriarRunComItensInput = z.infer<typeof criarRunComItensSchema>;
