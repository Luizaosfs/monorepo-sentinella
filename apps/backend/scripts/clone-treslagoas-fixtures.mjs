/**
 * Fase 2: clona FIXTURES territoriais de Três Lagoas de PROD `sentinella`
 * → `sentinella_test` (idempotente, prod read-only, recusa se ≠ sentinella_test).
 *
 *   node scripts/clone-treslagoas-fixtures.mjs
 *
 * Geometria: lida como EWKT (ST_AsEWKT) e regravada — o input de `geometry`
 * aceita EWKT, então jsonb_populate_record(...::tbl) faz o cast text→geometry.
 * Ordem respeita FK: bairros → bairros_quadras → imoveis → focos_risco.
 * focos_risco: FKs p/ tabelas NÃO clonadas são nulificadas (colunas nullable).
 */
import pg from 'pg';

const PROD = 'postgresql://luizAntonio:Sentinella147852369@177.7.37.14:5432/sentinella';
const TEST = process.env.TEST_DB ?? 'postgresql://luizAntonio:Sentinella147852369@177.7.37.14:5432/sentinella_test';
if (!TEST.includes('sentinella_test')) throw new Error('TEST_DB precisa ser sentinella_test');
const C = '2e3f32f3-f8bf-433b-9839-553f7f1ce2d8';

const prod = new pg.Pool({ connectionString: PROD });
const test = new pg.Pool({ connectionString: TEST });

/**
 * Copia linhas de `table` (cliente C). geomCols: colunas geometry → EWKT.
 * nullCols: setadas a NULL no destino (FKs p/ tabelas não clonadas).
 */
async function copy(table, geomCols = [], nullCols = []) {
  const geomSel = geomCols.length
    ? ` || jsonb_build_object(${geomCols.map((g) => `'${g}', ST_AsEWKT(t.${g})`).join(',')})`
    : '';
  const { rows } = await prod.query(
    `SELECT (to_jsonb(t)${geomSel}) j FROM ${table} t WHERE t.cliente_id = $1`, [C],
  );
  let n = 0;
  for (const r of rows) {
    const j = r.j;
    for (const c of nullCols) if (c in j) j[c] = null;
    const keys = Object.keys(j).filter((k) => k !== 'id');
    await test.query(
      `INSERT INTO ${table} SELECT * FROM jsonb_populate_record(NULL::${table}, $1::jsonb)
       ON CONFLICT (id) DO UPDATE SET (${keys.map((k) => `"${k}"`).join(',')})
       = (${keys.map((k) => `EXCLUDED."${k}"`).join(',')})`,
      [JSON.stringify(j)],
    );
    n++;
  }
  console.log(`  ${table}: ${n}`);
}

async function main() {
  await copy('bairros', ['area']);
  await copy('bairros_quadras', ['area']);
  // imoveis: sem geometry (lat/lng floats); nulifica FKs de autoria → usuarios.
  await copy('imoveis', [], ['created_by', 'updated_by', 'deleted_by']);
  // focos_risco: sem geometry; nulifica FKs p/ tabelas não clonadas.
  await copy('focos_risco', [], [
    'origem_levantamento_item_id', 'origem_vistoria_id', 'foco_anterior_id',
    'responsavel_id', 'created_by', 'updated_by', 'deleted_by',
  ]);
  // bairros_distribuicao: território do agente (137 linhas Três Lagoas, todas
  // ciclo_id NULL = canônico). agente_id único de prod == agente@treslagoas
  // clonado; quadra_id ⊂ bairros_quadras já clonadas → FKs resolvem direto.
  // Sem isso, /agente/hoje não monta (derruba cluster operador/agente no e2e).
  await copy('bairros_distribuicao', []);
  console.log('CLONE_FIXTURES_DONE');
}

main()
  .catch((e) => { console.error('CLONE_FAIL', e.message); process.exitCode = 1; })
  .finally(async () => { await prod.end(); await test.end(); });
