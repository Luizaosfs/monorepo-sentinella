// Upload de imagem para o Cloudinary via backend (Basic Auth).
// Usado por evidências do atendimento e outros fluxos que devem subir pelo Edge.
// Envie POST com JSON: { file_base64: string, content_type?: string, folder?: string }
//
// Autenticação (SECURITY FIX — 20261001):
//   - Usuários autenticados: enviar Bearer <jwt> no header Authorization.
//   - Cidadãos (página pública): sem JWT → modo cidadão com rate limit por IP
//     (max CITIZEN_UPLOADS_PER_WINDOW por janela de CITIZEN_WINDOW_MIN minutos).
//   - Requisições sem JWT e sem header x-citizen-upload são bloqueadas.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const APP_ORIGIN_CLOUDINARY = Deno.env.get('APP_ORIGIN');
if (!APP_ORIGIN_CLOUDINARY) {
  console.warn('[cloudinary-upload-image] APP_ORIGIN não configurada — usando fallback restritivo');
}

const PRODUCTION_ORIGIN = APP_ORIGIN_CLOUDINARY ?? 'https://app.sentinella.com.br';

// Origens permitidas: produção + localhost para desenvolvimento local
const ALLOWED_ORIGINS = new Set([
  PRODUCTION_ORIGIN,
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000',
]);

function getCorsHeaders(requestOrigin: string | null) {
  const origin = requestOrigin && ALLOWED_ORIGINS.has(requestOrigin)
    ? requestOrigin
    : PRODUCTION_ORIGIN;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-citizen-upload',
  };
}

// Limites para uploads anônimos (cidadão via canal público)
const CITIZEN_UPLOADS_PER_WINDOW = 5;
const CITIZEN_WINDOW_MIN = 30;

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Verifica rate limit de upload anônimo usando canal_cidadao_rate_limit.
 *  Retorna true se o request deve ser bloqueado. */
async function citizenRateLimitExceeded(ipRaw: string): Promise<boolean> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return false; // se env não configurado, não bloquear

  const supabase = createClient(supabaseUrl, serviceKey);

  // Bucket compartilhado: 'upload_citizen:' + ip sem cliente_id (uploads são pré-RPC)
  const encoder   = new TextEncoder();
  const hashBuf   = await crypto.subtle.digest('SHA-256', encoder.encode('upload_citizen:' + ipRaw));
  const ipHash    = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  const now       = new Date();
  const minute    = now.getUTCMinutes();
  const windowMin = Math.floor(minute / CITIZEN_WINDOW_MIN) * CITIZEN_WINDOW_MIN;
  const janela    = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
                              now.getUTCHours(), windowMin, 0, 0)).toISOString();

  // Reutiliza canal_cidadao_rate_limit; cliente_id fixo como nil UUID para uploads sem contexto
  const NIL_UUID = '00000000-0000-0000-0000-000000000000';
  const { data, error } = await supabase.rpc('incrementar_upload_rate', {
    p_ip_hash:    ipHash,
    p_cliente_id: NIL_UUID,
    p_janela:     janela,
    p_limite:     CITIZEN_UPLOADS_PER_WINDOW,
  }).single<{ bloqueado: boolean }>();

  if (error) {
    // Se a RPC não existir ainda (deploy incremental), permitir e logar
    console.warn('[cloudinary-upload-image] rate limit RPC indisponível:', error.message);
    return false;
  }
  return data?.bloqueado ?? false;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // ── Verificação de autenticação ───────────────────────────────────────────
  const authHeader      = req.headers.get('Authorization') ?? '';
  const citizenHeader   = req.headers.get('x-citizen-upload') ?? '';
  const isAuthenticated = authHeader.startsWith('Bearer ') && authHeader.length > 20;
  const isCitizenUpload = citizenHeader === 'true';

  if (!isAuthenticated && !isCitizenUpload) {
    return new Response(
      JSON.stringify({ error: 'Não autorizado. Envie Bearer token ou header x-citizen-upload.' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Rate limit para uploads de cidadãos (sem JWT)
  if (!isAuthenticated && isCitizenUpload) {
    const ipRaw = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    if (ipRaw !== 'unknown') {
      const blocked = await citizenRateLimitExceeded(ipRaw);
      if (blocked) {
        return new Response(
          JSON.stringify({ error: `Muitos uploads. Aguarde ${CITIZEN_WINDOW_MIN} minutos.` }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
  }

  const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
  const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
  const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');

  if (!cloudName || !apiKey || !apiSecret) {
    return new Response(
      JSON.stringify({ error: 'Cloudinary não configurado na função (env).' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let body: { file_base64?: string; content_type?: string; folder?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Body JSON inválido' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const fileBase64 = body?.file_base64;
  if (!fileBase64 || typeof fileBase64 !== 'string') {
    return new Response(JSON.stringify({ error: 'file_base64 é obrigatório' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Validação de tamanho: base64 de ~8MB = ~10.7MB em caracteres
  const MAX_BASE64_LEN = 11_000_000;
  if (fileBase64.length > MAX_BASE64_LEN) {
    return new Response(JSON.stringify({ error: 'Arquivo muito grande. Limite: 8MB' }), {
      status: 413,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Validação de MIME type
  const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
  const rawContentType = body.content_type || 'image/jpeg';
  const contentType = ALLOWED_MIME.includes(rawContentType) ? rawContentType : null;
  if (!contentType) {
    return new Response(
      JSON.stringify({ error: `Tipo de arquivo não permitido. Use: ${ALLOWED_MIME.join(', ')}` }),
      { status: 415, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const folder = body.folder?.trim() || 'evidencias';
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';

  let bytes: Uint8Array;
  try {
    bytes = base64ToUint8Array(fileBase64);
  } catch {
    return new Response(JSON.stringify({ error: 'file_base64 inválido' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const blob = new Blob([bytes], { type: contentType });
  const formData = new FormData();
  formData.append('file', blob, `upload.${ext}`);
  if (folder) formData.append('folder', folder);

  const auth = btoa(`${apiKey}:${apiSecret}`);
  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
      },
      body: formData,
    }
  );

  const result = (await uploadRes.json().catch(() => ({}))) as {
    secure_url?: string;
    public_id?: string;
    error?: { message?: string };
  };

  if (!uploadRes.ok) {
    return new Response(
      JSON.stringify({ error: result?.error?.message || 'Falha no upload no Cloudinary' }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!result.secure_url) {
    return new Response(
      JSON.stringify({ error: 'Resposta do Cloudinary sem URL' }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ secure_url: result.secure_url, public_id: result.public_id || '' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
