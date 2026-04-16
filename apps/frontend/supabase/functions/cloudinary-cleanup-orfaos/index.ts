/**
 * cloudinary-cleanup-orfaos — QW-10B
 *
 * Processa a fila cloudinary_orfaos: exclui do Cloudinary arquivos cujo
 * retention_until < now() e marca o registro como processado.
 *
 * Parâmetros (body JSON):
 *   dry_run?: boolean  — se true, apenas lista o que seria deletado (padrão: false)
 *   limite?:  number   — máximo de registros por execução (padrão: 50)
 *
 * Segurança: requer Authorization Bearer com JWT de papel 'admin'.
 * NÃO executar via cron automático sem dry_run=true primeiro.
 *
 * Execução manual recomendada:
 *   curl -X POST .../functions/v1/cloudinary-cleanup-orfaos \
 *     -H "Authorization: Bearer <admin-jwt>" \
 *     -d '{"dry_run": true}'
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CLOUDINARY_CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME')!;
const CLOUDINARY_API_KEY    = Deno.env.get('CLOUDINARY_API_KEY')!;
const CLOUDINARY_API_SECRET = Deno.env.get('CLOUDINARY_API_SECRET')!;

interface OrfaoRow {
  id: string;
  public_id: string;
  url: string | null;
  origem_tabela: string;
  origem_id: string | null;
  cliente_id: string | null;
  motivo: string;
  retention_until: string;
}

async function sha1Hex(input: string): Promise<string> {
  const enc  = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-1', enc.encode(input));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function deleteFromCloudinary(publicId: string): Promise<{ ok: boolean; error?: string }> {
  const timestamp    = Math.floor(Date.now() / 1000).toString();
  const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}`;
  const signature    = await sha1Hex(paramsToSign + CLOUDINARY_API_SECRET);

  const form = new FormData();
  form.append('public_id', publicId);
  form.append('timestamp', timestamp);
  form.append('api_key', CLOUDINARY_API_KEY);
  form.append('signature', signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`,
    { method: 'POST', body: form },
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => res.statusText);
    return { ok: false, error: `HTTP ${res.status}: ${txt}` };
  }

  const data = (await res.json().catch(() => ({}))) as { result?: string; error?: { message?: string } };
  if (data.result === 'ok' || data.result === 'not found') {
    return { ok: true };
  }
  return { ok: false, error: data.error?.message || `result=${data.result}` };
}

Deno.serve(async (req) => {
  const allowedOrigin = Deno.env.get('APP_ORIGIN') ?? 'https://app.sentinella.com.br';
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const jwt = authHeader.slice(7);

  // Valida papel admin
  const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: { user }, error: authErr } = await userClient.auth.getUser(jwt);
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: 'Token inválido' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: papelRow } = await userClient
    .from('papeis_usuarios')
    .select('papel')
    .eq('usuario_id', user.id)
    .limit(1)
    .single();

  if (!papelRow || String(papelRow.papel).toLowerCase() !== 'admin') {
    return new Response(JSON.stringify({ error: 'Apenas administradores podem executar limpeza de arquivos.' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await req.json().catch(() => ({})) as { dry_run?: boolean; limite?: number };
  const dryRun = body.dry_run !== false; // padrão: dry_run=true para segurança
  const limite = Math.min(body.limite ?? 50, 200);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: orfaos, error: queryErr } = await supabase
    .from('cloudinary_orfaos')
    .select('id, public_id, url, origem_tabela, origem_id, cliente_id, motivo, retention_until')
    .lt('retention_until', new Date().toISOString())
    .is('processado_em', null)
    .is('deletado_em', null)
    .order('retention_until', { ascending: true })
    .limit(limite);

  if (queryErr) {
    return new Response(JSON.stringify({ error: queryErr.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const rows = (orfaos ?? []) as OrfaoRow[];
  const resultados: Array<{
    id: string;
    public_id: string;
    origem_tabela: string;
    status: 'deletado' | 'erro' | 'simulado';
    erro?: string;
  }> = [];

  for (const row of rows) {
    if (dryRun) {
      resultados.push({ id: row.id, public_id: row.public_id, origem_tabela: row.origem_tabela, status: 'simulado' });
      continue;
    }

    const { ok, error: delErr } = await deleteFromCloudinary(row.public_id);

    if (ok) {
      await supabase
        .from('cloudinary_orfaos')
        .update({ processado_em: new Date().toISOString(), deletado_em: new Date().toISOString() })
        .eq('id', row.id);
      resultados.push({ id: row.id, public_id: row.public_id, origem_tabela: row.origem_tabela, status: 'deletado' });
    } else {
      await supabase
        .from('cloudinary_orfaos')
        .update({ processado_em: new Date().toISOString(), erro: delErr ?? 'desconhecido' })
        .eq('id', row.id);
      resultados.push({ id: row.id, public_id: row.public_id, origem_tabela: row.origem_tabela, status: 'erro', erro: delErr });
    }
  }

  const summary = {
    dry_run:   dryRun,
    total:     rows.length,
    deletados: resultados.filter((r) => r.status === 'deletado').length,
    erros:     resultados.filter((r) => r.status === 'erro').length,
    simulados: resultados.filter((r) => r.status === 'simulado').length,
    resultados,
  };

  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
