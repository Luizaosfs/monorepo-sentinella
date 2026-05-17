// Diagnóstico: testa /auth/login no backend :3334 com os 4 TEST_*.
const base = process.env.E2E_API ?? 'http://localhost:3334';
const users = [
  ['admin', 'admin@sentinellamap.com.br', '1234@Mudar'],
  ['supervisor', 'supervisor@treslagoas.com.br', '1234@Mudar'],
  ['agente', 'agente@treslagoas.com.br', '1234@Mudar'],
  ['notificador', 'notificador@treslagoas.com.br', '1234@Mudar'],
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
