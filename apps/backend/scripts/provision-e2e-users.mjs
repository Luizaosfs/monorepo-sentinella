/**
 * Provisiona os usuários TEST_* (.env.e2e do frontend) no DB sentinella_test
 * para a suíte Playwright. Idempotente. NÃO usar contra prod.
 *
 *   node scripts/provision-e2e-users.mjs
 *
 * Requer env DATABASE_URL apontando para *sentinella_test*.
 */
import bcrypt from 'bcryptjs';
import pg from 'pg';

const DB = process.env.DATABASE_URL ?? '';
if (!DB.includes('sentinella_test')) {
  throw new Error(`Recuso rodar: DATABASE_URL não é sentinella_test (${DB})`);
}

const CLIENTE_ID = '11111111-e2e0-4000-8000-000000000001';
const UNIDADE_ID = '11111111-e2e0-4000-8000-0000000000f1';

const USERS = [
  { k: 'admin', id: '11111111-e2e0-4000-8000-0000000000a1', auth: '11111111-e2e0-4000-8000-0000000000a2', nome: 'E2E Admin', email: 'luizantoniooliveira.digital@gmail.com', senha: '123456', papel: 'admin', cliente: null, unidade: null },
  { k: 'supervisor', id: '11111111-e2e0-4000-8000-0000000000b1', auth: '11111111-e2e0-4000-8000-0000000000b2', nome: 'E2E Supervisor', email: 'supervisor@sentinellamap.com.br', senha: '12345@Mudar', papel: 'supervisor', cliente: CLIENTE_ID, unidade: null },
  { k: 'agente', id: '11111111-e2e0-4000-8000-0000000000c1', auth: '11111111-e2e0-4000-8000-0000000000c2', nome: 'E2E Agente', email: 'agente@sentinellamap.com.br', senha: '12345@Mudar', papel: 'agente', cliente: CLIENTE_ID, unidade: null },
  { k: 'notificador', id: '11111111-e2e0-4000-8000-0000000000d1', auth: '11111111-e2e0-4000-8000-0000000000d2', nome: 'E2E Notificador', email: 'notificador@sentinellamap.com.br', senha: '12345@Mudar', papel: 'notificador', cliente: CLIENTE_ID, unidade: UNIDADE_ID },
];

const pool = new pg.Pool({ connectionString: DB });

async function main() {
  const c = await pool.connect();
  try {
    await c.query(
      `INSERT INTO clientes (id, slug, nome, ativo)
       VALUES ($1,$2,$3,true)
       ON CONFLICT (id) DO UPDATE SET slug=EXCLUDED.slug, nome=EXCLUDED.nome, ativo=true`,
      [CLIENTE_ID, 'pref.-tres-lagoas', 'E2E Pref. Três Lagoas'],
    );

    await c.query(
      `INSERT INTO unidades_saude (id, cliente_id, nome, tipo, tipo_sentinela, origem, ativo)
       VALUES ($1,$2,$3,'ubs','UBS','manual',true)
       ON CONFLICT (id) DO UPDATE SET cliente_id=EXCLUDED.cliente_id, ativo=true`,
      [UNIDADE_ID, CLIENTE_ID, 'E2E UBS Central'],
    );

    for (const u of USERS) {
      const hash = bcrypt.hashSync(u.senha, 10);
      await c.query(
        `INSERT INTO usuarios (id, auth_id, nome, email, cliente_id, senha_hash, ativo, unidade_saude_id)
         VALUES ($1,$2,$3,$4,$5,$6,true,$7)
         ON CONFLICT (id) DO UPDATE SET
           auth_id=EXCLUDED.auth_id, nome=EXCLUDED.nome, email=EXCLUDED.email,
           cliente_id=EXCLUDED.cliente_id, senha_hash=EXCLUDED.senha_hash,
           ativo=true, unidade_saude_id=EXCLUDED.unidade_saude_id`,
        [u.id, u.auth, u.nome, u.email, u.cliente, hash, u.unidade],
      );
      const r = await c.query(
        `SELECT 1 FROM papeis_usuarios WHERE usuario_id=$1 AND papel=$2`,
        [u.auth, u.papel],
      );
      if (r.rowCount === 0) {
        await c.query(
          `INSERT INTO papeis_usuarios (usuario_id, papel) VALUES ($1,$2)`,
          [u.auth, u.papel],
        );
      }
      console.log(`ok ${u.k} <${u.email}> papel=${u.papel} cliente=${u.cliente ?? 'null'} unidade=${u.unidade ?? 'null'}`);
    }
    console.log('PROVISION_DONE');
  } finally {
    c.release();
    await pool.end();
  }
}

main().catch((e) => { console.error('PROVISION_FAIL', e.message); process.exit(1); });
