import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://app.sentinella.com.br',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Autenticação obrigatória ─────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Autenticação obrigatória' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const anonClient = createClient(
      SUPABASE_URL,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: authUser, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !authUser.user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida ou expirada' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    const { cliente_id, ciclo } = await req.json();
    if (!cliente_id || ciclo === undefined) {
      return new Response(JSON.stringify({ error: 'cliente_id e ciclo são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verifica acesso ao tenant antes de usar service_role
    const { data: temAcesso } = await anonClient.rpc('usuario_pode_acessar_cliente', {
      p_cliente_id: cliente_id,
    });
    if (!temAcesso) {
      return new Response(JSON.stringify({ error: 'Acesso negado ao cliente informado' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Busca dados — filtra explicitamente por cliente_id (service_role bypassa RLS)
    const { data, error } = await supabase
      .from('v_liraa_quarteirao')
      .select('*')
      .eq('cliente_id', cliente_id)
      .eq('ciclo', ciclo)
      .order('bairro')
      .order('quarteirao');

    if (error) throw error;

    // Gera HTML do boletim
    const rows = (data ?? []).map((r: Record<string, unknown>) => `
      <tr>
        <td>${r.bairro ?? '—'}</td>
        <td>${r.quarteirao ?? '—'}</td>
        <td>${r.imoveis_inspecionados}</td>
        <td>${r.imoveis_positivos}</td>
        <td style="font-weight:bold;color:${Number(r.iip) >= 4 ? '#dc2626' : Number(r.iip) >= 1 ? '#d97706' : '#059669'}">${Number(r.iip).toFixed(1)}%</td>
        <td>${Number(r.ibp).toFixed(1)}</td>
        <td>${r.focos_a1}</td><td>${r.focos_a2}</td><td>${r.focos_b}</td>
        <td>${r.focos_c}</td><td>${r.focos_d1}</td><td>${r.focos_d2}</td><td>${r.focos_e}</td>
        <td>${r.larvicida_total_g}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Boletim LIRAa — Ciclo ${ciclo}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th { background: #f3f4f6; padding: 6px 8px; border: 1px solid #d1d5db; text-align: left; font-size: 11px; }
    td { padding: 5px 8px; border: 1px solid #e5e7eb; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>Boletim LIRAa — Ciclo ${ciclo}</h1>
  <p>Gerado em: ${new Date().toLocaleDateString('pt-BR')}</p>
  <table>
    <thead>
      <tr>
        <th>Bairro</th><th>Quarteirão</th><th>Insp.</th><th>Positivos</th>
        <th>IIP (%)</th><th>IBP</th>
        <th>A1</th><th>A2</th><th>B</th><th>C</th><th>D1</th><th>D2</th><th>E</th>
        <th>Larvicida (g)</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="liraa-ciclo-${ciclo}.html"`,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
