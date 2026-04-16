import { supabase, supabaseAnonKey, supabaseUrl } from '@/lib/supabase';
import { captureError } from '@/lib/sentry';

type UploadBody = {
  file_base64: string;
  filename: string;
  folder?: string;
};

/**
 * Invoca a Edge Function upload-evidencia com JWT atualizado.
 * Evita 401 quando a sessão expirou durante um formulário longo em campo.
 */
export async function invokeUploadEvidencia(
  body: UploadBody,
): Promise<{ url: string; public_id?: string } | { error: Error }> {
  const { data: sessionData } = await supabase.auth.getSession();
  let accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    return { error: new Error('Sessão não encontrada. Faça login novamente.') };
  }

  const { data: refreshed } = await supabase.auth.refreshSession();
  if (refreshed.session?.access_token) {
    accessToken = refreshed.session.access_token;
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/upload-evidencia`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const msg =
      parsed &&
      typeof parsed === 'object' &&
      parsed !== null &&
      'error' in parsed &&
      typeof (parsed as { error: unknown }).error === 'string'
        ? (parsed as { error: string }).error
        : text || res.statusText || `HTTP ${res.status}`;
    const err = new Error(msg);
    captureError(err, { fn: 'upload-evidencia', status: res.status, filename: body.filename });
    return { error: err };
  }

  if (parsed && typeof parsed === 'object' && parsed !== null && 'url' in parsed && (parsed as { url: unknown }).url) {
    return {
      url: (parsed as { url: string }).url,
      public_id: (parsed as { public_id?: string }).public_id,
    };
  }
  return { error: new Error('Resposta inválida do upload') };
}
