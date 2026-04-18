#!/usr/bin/env node
/**
 * Auditoria do estado de migração de senha_hash.
 *
 * Uso: node apps/backend/scripts/check-senha-hash-status.mjs
 *
 * Exit code:
 *   0 — todos os usuários com auth_id têm senha_hash (migração completa)
 *   1 — há usuários legados com auth_id mas sem senha_hash (backfill pendente)
 */

import pg from 'pg';

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  console.error('❌  DATABASE_URL não está definida.');
  process.exit(2);
}

const client = new pg.Client({ connectionString: DATABASE_URL });

try {
  await client.connect();

  const { rows } = await client.query(`
    SELECT
      COUNT(*)                                                              AS total,
      COUNT(*) FILTER (WHERE auth_id IS NULL)                              AS sem_auth_id,
      COUNT(*) FILTER (WHERE auth_id IS NOT NULL AND senha_hash IS NULL)   AS legados_pendentes,
      COUNT(*) FILTER (WHERE senha_hash IS NOT NULL)                       AS ja_migrados,
      COUNT(*) FILTER (WHERE ativo = true)                                 AS ativos
    FROM public.usuarios
  `);

  const r = rows[0];
  const total             = Number(r.total);
  const semAuthId         = Number(r.sem_auth_id);
  const legadosPendentes  = Number(r.legados_pendentes);
  const jaMigrados        = Number(r.ja_migrados);
  const ativos            = Number(r.ativos);
  const pct = total === 0 ? 100 : Math.round((jaMigrados / total) * 100);

  const pad = (s, n) => String(s).padStart(n);
  const line = (label, value, extra = '') =>
    `  ${label.padEnd(30)} ${pad(value, 8)}${extra ? '  ' + extra : ''}`;

  console.log('');
  console.log('┌─────────────────────────────────────────────────────┐');
  console.log('│        check-senha-hash-status — resultado          │');
  console.log('├─────────────────────────────────────────────────────┤');
  console.log(line('Total de usuários',      total));
  console.log(line('Sem auth_id (órfãos)',   semAuthId));
  console.log(line('Já migrados (com hash)', jaMigrados,  `${pct}%`));
  console.log(line('Legados pendentes',      legadosPendentes,
    legadosPendentes > 0 ? '⚠️  BACKFILL NECESSÁRIO' : '✅ ok'));
  console.log(line('Usuários ativos',        ativos));
  console.log('└─────────────────────────────────────────────────────┘');
  console.log('');

  if (legadosPendentes > 0) {
    console.log(`⚠️  ${legadosPendentes} usuário(s) com auth_id mas sem senha_hash.`);
    console.log('   Execute o backfill conforme MIGRATION_OPS.md antes de desligar a bridge Supabase.');
    process.exit(1);
  } else {
    console.log('✅  Migração de senha_hash completa. Nenhum backfill necessário.');
    process.exit(0);
  }
} catch (err) {
  console.error('❌  Erro ao conectar ou executar query:', err.message);
  process.exit(2);
} finally {
  await client.end().catch(() => {});
}
