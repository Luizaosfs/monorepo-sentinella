/**
 * Seed sintético de casos_notificados p/ Três Lagoas no sentinella_test
 * (e2e). SEM PII (a tabela não armazena nome/CPF/nascimento — LGPD).
 * Idempotente (UUIDs fixos, ON CONFLICT DO UPDATE). Recusa fora de _test.
 *
 *   node scripts/seed-e2e-casos.mjs
 */
import pg from 'pg';

const DB = process.env.DATABASE_URL ?? 'postgresql://luizAntonio:Sentinella147852369@177.7.37.14:5432/sentinella_test';
if (!DB.includes('sentinella_test')) throw new Error('Recuso: DATABASE_URL não é sentinella_test');

const CLIENTE = '2e3f32f3-f8bf-433b-9839-553f7f1ce2d8';
const UNIDADE = '2181c6ed-5b0a-4306-baf3-9b22d1f57447';
const BAIRROS = {
  Centro: 'f2ec093e-ac13-41e2-bcc5-204aada7e393',
  'Vila Alegre': '30f7a2fa-c207-4594-ae9e-c32c85f93ac6',
  Colinos: '5a62fde6-7e13-49b3-a107-ba2825f30fcb',
  'Santa Luzia': 'b5ac8bd5-f91d-4f2f-8143-6ce5d1449cf8',
};

// Variedade p/ os specs (lista/tabela/filtros por status e doença).
const CASOS = [
  ['suspeito', 'dengue', 'Centro', -20.751, -51.678],
  ['confirmado', 'dengue', 'Centro', -20.753, -51.681],
  ['confirmado', 'chikungunya', 'Vila Alegre', -20.760, -51.690],
  ['suspeito', 'zika', 'Vila Alegre', -20.762, -51.692],
  ['descartado', 'dengue', 'Colinos', -20.770, -51.700],
  ['em_investigacao', 'dengue', 'Colinos', -20.772, -51.702],
  ['confirmado', 'dengue', 'Santa Luzia', -20.780, -51.710],
  ['suspeito', 'chikungunya', 'Santa Luzia', -20.782, -51.712],
  ['suspeito', 'dengue', 'Centro', -20.754, -51.679],
  ['confirmado', 'zika', 'Colinos', -20.771, -51.701],
];

const pool = new pg.Pool({ connectionString: DB });
try {
  const u = await pool.query(
    `SELECT id FROM usuarios WHERE email='notificador@treslagoas.com.br'`,
  );
  const notificadorId = u.rows[0]?.id ?? null;
  let n = 0;
  for (let i = 0; i < CASOS.length; i++) {
    const [status, doenca, bairroNome, lat, lng] = CASOS[i];
    const id = `c0000000-e2e0-4000-8000-${String(i + 1).padStart(12, '0')}`;
    const diasAtras = i + 1;
    await pool.query(
      `INSERT INTO casos_notificados
         (id, cliente_id, unidade_saude_id, notificador_id, doenca, status,
          data_inicio_sintomas, data_notificacao, bairro, bairro_id,
          latitude, longitude, observacao, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,
               CURRENT_DATE - ($7||' days')::interval, CURRENT_DATE - ($8||' days')::interval,
               $9,$10,$11,$12,$13,$4)
       ON CONFLICT (id) DO UPDATE SET
         status=EXCLUDED.status, doenca=EXCLUDED.doenca, bairro=EXCLUDED.bairro,
         bairro_id=EXCLUDED.bairro_id, latitude=EXCLUDED.latitude,
         longitude=EXCLUDED.longitude, deleted_at=NULL`,
      [id, CLIENTE, UNIDADE, notificadorId, doenca, status,
       diasAtras + 2, diasAtras, bairroNome, BAIRROS[bairroNome],
       lat, lng, `Caso sintético e2e #${i + 1}`],
    );
    n++;
  }
  console.log(`notificador_id=${notificadorId}`);
  console.log(`casos_notificados seed: ${n}`);
  console.log('SEED_CASOS_DONE');
} finally {
  await pool.end();
}
