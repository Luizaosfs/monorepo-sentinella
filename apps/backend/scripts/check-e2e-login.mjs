// Diagnóstico: testa /auth/login no backend :3334 com os 4 TEST_*.
const base = process.env.E2E_API ?? 'http://localhost:3334';
const users = [
  ['admin', 'luizantoniooliveira.digital@gmail.com', '123456'],
  ['supervisor', 'supervisor@sentinellamap.com.br', '12345@Mudar'],
  ['agente', 'agente@sentinellamap.com.br', '12345@Mudar'],
  ['notificador', 'notificador@sentinellamap.com.br', '12345@Mudar'],
];
for (const [k, email, password] of users) {
  try {
    const r = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const t = await r.text();
    console.log(`${k} HTTP ${r.status} ${t.slice(0, 160)}`);
  } catch (e) {
    console.log(`${k} ERR ${e.message}`);
  }
}
