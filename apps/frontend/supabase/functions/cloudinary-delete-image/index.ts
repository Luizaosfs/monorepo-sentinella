// Exclui uma imagem do Cloudinary pelo public_id (Destroy API assinada).
// Usado quando o usuário envia foto no "Criar item manual" mas não conclui o cadastro.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGIN = Deno.env.get('APP_ORIGIN') ?? 'https://app.sentinella.com.br';
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function sha1Hex(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  return crypto.subtle.digest('SHA-1', data).then((buffer) => {
    const arr = Array.from(new Uint8Array(buffer));
    return arr.map((b) => b.toString(16).padStart(2, '0')).join('');
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── Autenticação obrigatória ───────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return new Response(JSON.stringify({ error: 'Autenticação obrigatória' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  {
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida ou expirada' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // Verifica papel — apenas admin ou supervisor podem deletar imagens da plataforma
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data: papel } = await callerClient.rpc('get_meu_papel');
    if (!papel || !['admin', 'supervisor', 'moderador'].includes(String(papel).toLowerCase())) {
      return new Response(JSON.stringify({ error: 'Papel insuficiente para esta operação' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────

  const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
  const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
  const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');

  if (!cloudName || !apiKey || !apiSecret) {
    return new Response(
      JSON.stringify({ error: 'Cloudinary não configurado na função (env).' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let body: { public_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Body JSON inválido' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const publicId = body?.public_id?.trim();
  if (!publicId) {
    return new Response(JSON.stringify({ error: 'public_id é obrigatório' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}`;
  const signature = await sha1Hex(paramsToSign + apiSecret);

  const form = new URLSearchParams();
  form.set('public_id', publicId);
  form.set('timestamp', timestamp);
  form.set('signature', signature);
  form.set('api_key', apiKey);

  const destroyRes = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    }
  );

  const result = await destroyRes.json().catch(() => ({})) as { result?: string; error?: { message?: string } };
  if (!destroyRes.ok) {
    return new Response(
      JSON.stringify({ error: result?.error?.message || 'Falha ao excluir no Cloudinary' }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify({ ok: true, result: result?.result }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
