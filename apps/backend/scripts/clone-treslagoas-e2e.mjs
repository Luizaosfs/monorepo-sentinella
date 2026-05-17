/**
 * Clona o cliente Três Lagoas (auth essencial) de PROD `sentinella`
 * para `sentinella_test` p/ o frontend e2e. Idempotente. Read-only em prod.
 *
 *   node scripts/clone-treslagoas-e2e.mjs
 *
 * Fase A: clientes + unidades_saude + usuarios(4) + papeis_usuarios.
 * (PostGIS/fixtures vêm depois, em script separado.)
 */
import pg from 'pg';

const PROD = 'postgresql://luizAntonio:Sentinella147852369@177.7.37.14:5432/sentinella';
const TEST = process.env.TEST_DB ?? 'postgresql://luizAntonio:Sentinella147852369@177.7.37.14:5432/sentinella_test';
if (!TEST.includes('sentinella_test')) throw new Error('TEST_DB precisa ser sentinella_test');

const CLIENTE = '2e3f32f3-f8bf-433b-9839-553f7f1ce2d8';
const UNIDADE = '2181c6ed-5b0a-4306-baf3-9b22d1f57447';
const EMAILS = ['admin@sentinellamap.com.br', 'supervisor@treslagoas.com.br', 'agente@treslagoas.com.br', 'notificador@treslagoas.com.br'];

const prod = new pg.Pool({ connectionString: PROD });
const test = new pg.Pool({ connectionString: TEST });

/** Copia linhas (sem PostGIS) via jsonb_populate_record. ON CONFLICT(id) DO UPDATE. */
async function copyRows(table, whereSql, params) {
  const { rows } = await prod.query(`SELECT to_jsonb(t) j FROM ${table} t WHERE ${whereSql}`, params);
  let n = 0;
  for (const r of rows) {
    await test.query(
      `INSERT INTO ${table} SELECT * FROM jsonb_populate_record(NULL::${table}, $1::jsonb)
       ON CONFLICT (id) DO UPDATE SET (${Object.keys(r.j).filter(k=>k!=='id').map(k=>`"${k}"`).join(',')})
       = (${Object.keys(r.j).filter(k=>k!=='id').map(k=>`EXCLUDED."${k}"`).join(',')})`,
      [JSON.stringify(r.j)],
    );
    n++;
  }
  console.log(`  ${table}: ${n}`);
  return rows.map((r) => r.j);
}

async function main() {
  console.log('clientes'); await copyRows('clientes', 'id = $1', [CLIENTE]);
  console.log('unidades_saude'); await copyRows('unidades_saude', 'id = $1', [UNIDADE]);
  console.log('usuarios'); const us = await copyRows('usuarios', 'email = ANY($1)', [EMAILS]);
  const authIds = us.map((u) => u.auth_id).filter(Boolean);
  console.log('papeis_usuarios');
  const { rows: pr } = await prod.query(
    `SELECT to_jsonb(t) j FROM papeis_usuarios t WHERE usuario_id = ANY($1)`, [authIds],
  );
  let pn = 0;
  for (const r of pr) {
    const ex = await test.query(
      `SELECT 1 FROM papeis_usuarios WHERE usuario_id=$1 AND papel=$2`,
      [r.j.usuario_id, r.j.papel],
    );
    if (ex.rowCount === 0) {
      await test.query(`INSERT INTO papeis_usuarios (usuario_id, papel) VALUES ($1,$2)`, [r.j.usuario_id, r.j.papel]);
      pn++;
    }
  }
  console.log(`  papeis_usuarios: +${pn} (de ${pr.length})`);
  console.log('CLONE_A_DONE');
}

main()
  .catch((e) => { console.error('CLONE_FAIL', e.message); process.exitCode = 1; })
  .finally(async () => { await prod.end(); await test.end(); });
