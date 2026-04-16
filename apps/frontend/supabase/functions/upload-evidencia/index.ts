import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const PRODUCTION_ORIGIN = Deno.env.get('APP_ORIGIN') ?? 'https://app.sentinella.com.br';
const ALLOWED_ORIGINS_EV = new Set([
  PRODUCTION_ORIGIN,
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000',
]);

function getCors(requestOrigin: string | null) {
  const origin = requestOrigin && ALLOWED_ORIGINS_EV.has(requestOrigin)
    ? requestOrigin
    : PRODUCTION_ORIGIN;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp'] as const;

function extToMime(ext: string): string {
  const e = ext.toLowerCase();
  if (e === 'png') return 'image/png';
  if (e === 'gif') return 'image/gif';
  if (e === 'webp') return 'image/webp';
  return 'image/jpeg';
}

/** Quando o filename não traz extensão válida, identifica JPEG/PNG/GIF/WebP pelos primeiros bytes do base64. */
function sniffImageMimeFromBase64(b64: string): string | null {
  const clean = b64.replace(/\s/g, '');
  if (clean.length < 12) return null;
  let bin: string;
  try {
    bin = atob(clean.slice(0, 64));
  } catch {
    return null;
  }
  const b0 = bin.charCodeAt(0);
  const b1 = bin.charCodeAt(1);
  const b2 = bin.charCodeAt(2);
  const b3 = bin.charCodeAt(3);
  if (b0 === 0xff && b1 === 0xd8) return 'image/jpeg';
  if (b0 === 0x89 && b1 === 0x50 && b2 === 0x4e && b3 === 0x47) return 'image/png';
  if (b0 === 0x47 && b1 === 0x49 && b2 === 0x46) return 'image/gif';
  if (b0 === 0x52 && b1 === 0x49 && b2 === 0x46 && b3 === 0x46) return 'image/webp';
  return null;
}

serve(async (req) => {
  const CORS = getCors(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Authorization obrigatório' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: 'Configuração do servidor incompleta' }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const jwt = authHeader.slice(7);
  // getUser(jwt) com anon pode falhar em alguns ambientes; service role é o padrão server-side.
  const authClient = createClient(
    supabaseUrl,
    serviceRoleKey ?? supabaseAnonKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data: userData, error: userErr } = await authClient.auth.getUser(jwt);
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: 'Sessão inválida ou expirada' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { file_base64, filename, folder } = await req.json() as {
      file_base64: string;
      filename: string;
      folder?: string;
    };

    if (!file_base64 || !filename) {
      return new Response(JSON.stringify({ error: 'file_base64 e filename são obrigatórios' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (file_base64.length > 14_000_000) {
      return new Response(JSON.stringify({ error: 'Arquivo muito grande. Limite: 10MB' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const segments = filename.split('.');
    const lastSeg = segments.length > 1 ? segments[segments.length - 1].toLowerCase() : '';
    const extOk = lastSeg !== '' && (ALLOWED_EXTS as readonly string[]).includes(lastSeg);
    if (segments.length > 1 && !extOk) {
      return new Response(
        JSON.stringify({
          error: `Tipo de arquivo não permitido: .${lastSeg}. Use: ${ALLOWED_EXTS.join(', ')}`,
        }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    const mime = extOk ? extToMime(lastSeg) : sniffImageMimeFromBase64(file_base64);
    if (!mime) {
      return new Response(
        JSON.stringify({
          error:
            'Não foi possível identificar a imagem. Use um filename com extensão (.jpg, .png, .webp, .gif) ou envie um arquivo válido.',
        }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
    const uploadPreset = Deno.env.get('CLOUDINARY_UPLOAD_PRESET');

    if (!cloudName || !uploadPreset) {
      return new Response(JSON.stringify({ error: 'Cloudinary não configurado no servidor' }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const formData = new FormData();
    formData.append('file', `data:${mime};base64,${file_base64}`);
    formData.append('upload_preset', uploadPreset);
    formData.append('public_id', `${folder ?? 'evidencias'}/${filename}`);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: 'POST', body: formData },
    );

    if (!res.ok) {
      const body = await res.text();
      return new Response(JSON.stringify({ error: `Cloudinary retornou ${res.status}: ${body}` }), {
        status: 502,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const json = await res.json() as { secure_url: string; public_id: string };
    return new Response(
      JSON.stringify({ url: json.secure_url, public_id: json.public_id }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
