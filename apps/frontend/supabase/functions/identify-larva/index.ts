// identify-larva — identifica larvas de Aedes aegypti em imagens via IA
// verify_jwt = true no config.toml — requer usuário autenticado

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const APP_ORIGIN = Deno.env.get('APP_ORIGIN');
if (!APP_ORIGIN) {
  console.warn('[identify-larva] APP_ORIGIN não configurada — usando fallback restritivo');
}
const ALLOWED_ORIGIN = APP_ORIGIN ?? 'https://app.sentinella.com.br';

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8MB

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { image_base64, deposito_tipo, vistoria_id, content_type, cliente_id } = await req.json();

    // Verificar que o usuário autenticado pertence ao cliente informado
    if (cliente_id) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Authorization header ausente' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const supabaseUser = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: podeAcessar, error: authErr } = await supabaseUser.rpc(
        'usuario_pode_acessar_cliente',
        { p_cliente_id: cliente_id },
      );
      if (authErr || !podeAcessar) {
        return new Response(JSON.stringify({ error: 'Acesso negado a este cliente' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (!image_base64) {
      return new Response(JSON.stringify({ error: 'image_base64 obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mimeType = content_type ?? 'image/jpeg';
    if (!ALLOWED_MIME.includes(mimeType)) {
      return new Response(JSON.stringify({ error: `Tipo de arquivo não permitido: ${mimeType}` }), {
        status: 415,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const estimatedBytes = Math.ceil((image_base64.length * 3) / 4);
    if (estimatedBytes > MAX_SIZE_BYTES) {
      return new Response(JSON.stringify({ error: 'Imagem muito grande. Máximo: 8MB' }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

    let identified = false;
    let confidence = 0.0;
    let classe = 'indefinido';

    if (ANTHROPIC_API_KEY) {
      try {
        const larvaAbort = new AbortController();
        const larvaTimeout = setTimeout(() => larvaAbort.abort(), 20_000);
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          signal: larvaAbort.signal,
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 256,
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: mimeType, data: image_base64 },
                },
                {
                  type: 'text',
                  text: 'Analise esta imagem de um depósito de água. Responda APENAS com JSON: {"identified": true/false, "confidence": 0.0-1.0, "classe": "larva_aedes_aegypti"|"pupa"|"adulto"|"negativo"|"inconclusivo", "motivo": "breve descrição"}. Identifique se há larvas ou formas imaturas de Aedes aegypti.',
                },
              ],
            }],
          }),
        });

        clearTimeout(larvaTimeout);
        if (resp.ok) {
          const aiData = await resp.json();
          const text = aiData.content?.[0]?.text ?? '';
          const parsed = JSON.parse(text.match(/\{.*\}/s)?.[0] ?? '{}');
          identified = parsed.identified ?? false;
          confidence = Math.min(1, Math.max(0, parsed.confidence ?? 0));
          classe = parsed.classe ?? 'inconclusivo';
        }
      } catch (aiErr) {
        console.warn('[identify-larva] Erro na análise IA:', String(aiErr));
        classe = 'inconclusivo';
      }
    } else {
      console.warn('[identify-larva] ANTHROPIC_API_KEY não configurada — resultado inconclusivo');
      classe = 'inconclusivo';
    }

    let image_url: string | null = null;
    if (vistoria_id) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        );
        const imageBytes = Uint8Array.from(atob(image_base64), (c) => c.charCodeAt(0));
        const filename = `larva-ia/${vistoria_id}/${deposito_tipo ?? 'deposito'}-${Date.now()}.jpg`;
        const { data: uploadData } = await supabase.storage
          .from('evidencias')
          .upload(filename, imageBytes, { contentType: mimeType, upsert: false });
        if (uploadData) {
          const { data: urlData } = supabase.storage.from('evidencias').getPublicUrl(filename);
          image_url = urlData.publicUrl;
        }
      } catch {
        // Storage upload é não-fatal
      }
    }

    return new Response(
      JSON.stringify({ identified, confidence, classe, deposito_tipo: deposito_tipo ?? null, image_url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
