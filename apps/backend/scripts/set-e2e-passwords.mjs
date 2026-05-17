/**
 * Define senha_hash dos usuários e2e no sentinella_test = bcrypt(senha do
 * .env.e2e). Prod NUNCA é tocado (guard exige sentinella_test). Idempotente.
 */
import bcrypt from 'bcryptjs';
import pg from 'pg';

const DB = process.env.DATABASE_URL ?? 'postgresql://luizAntonio:Sentinella147852369@177.7.37.14:5432/sentinella_test';
if (!DB.includes('sentinella_test')) throw new Error('Recuso: DATABASE_URL não é sentinella_test');

// email → senha (espelha apps/frontend/.env.e2e)
const CREDS = [
  ['admin@sentinellamap.com.br', '1234@Mudar'],
  ['supervisor@treslagoas.com.br', '1234@Mudar'],
  ['agente@treslagoas.com.br', '1234@Mudar'],
  ['notificador@treslagoas.com.br', '1234@Mudar'],
];

const pool = new pg.Pool({ connectionString: DB });
try {
  for (const [email, senha] of CREDS) {
    const hash = bcrypt.hashSync(senha, 10);
    const r = await pool.query(
      `UPDATE usuarios SET senha_hash=$1, ativo=true WHERE email=$2`,
      [hash, email],
    );
    console.log(`${email}: ${r.rowCount} atualizado(s)`);
  }
  console.log('PASSWORDS_SET');
} finally {
  await pool.end();
}
