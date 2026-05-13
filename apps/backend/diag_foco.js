const { Client } = require('pg');
const crypto = require('crypto');

const c = new Client({ connectionString: 'postgresql://luizAntonio:Sentinella147852369@177.7.37.14:5432/sentinella' });

c.connect().then(async () => {
  // Item mais recente do teste
  const itemRes = await c.query(
    `SELECT li.id, li.prioridade, li.risco, li.latitude, li.longitude, li.endereco_curto,
            l.cliente_id, l.tipo_entrada
       FROM levantamento_itens li
       JOIN levantamentos l ON l.id = li.levantamento_id
      ORDER BY li.created_at DESC LIMIT 1`
  );
  const item = itemRes.rows[0];
  console.log('ITEM:', JSON.stringify(item));

  // Testar foco_sequencia
  try {
    const seq = await c.query(
      `INSERT INTO foco_sequencia (cliente_id, ano, ultimo)
       VALUES ($1::uuid, $2, 1)
       ON CONFLICT (cliente_id, ano) DO UPDATE SET ultimo = foco_sequencia.ultimo + 1
       RETURNING ultimo`,
      [item.cliente_id, 2026]
    );
    console.log('SEQ OK:', seq.rows[0]);
  } catch (e) {
    console.error('SEQ ERRO:', e.message);
  }

  // Testar insert em focos_risco
  const focoId = crypto.randomUUID();
  try {
    await c.query(
      `INSERT INTO focos_risco
         (id, cliente_id, imovel_id, origem_tipo, origem_levantamento_item_id,
          status, prioridade, classificacao_inicial, latitude, longitude,
          endereco_normalizado, suspeita_em, codigo_foco)
       VALUES ($1::uuid, $2::uuid, NULL, 'drone', $3::uuid,
               'em_triagem', 'P1', 'foco', $4, $5, $6, now(), '2026-00000001')`,
      [focoId, item.cliente_id, item.id, item.latitude, item.longitude, item.endereco_curto]
    );
    console.log('FOCO OK:', focoId);
  } catch (e) {
    console.error('FOCO ERRO:', e.message);
  }

  const count = await c.query('SELECT COUNT(*) FROM focos_risco');
  console.log('TOTAL focos_risco:', count.rows[0].count);

  await c.end();
}).catch(e => console.error('CONNECT:', e.message));
