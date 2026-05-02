import { tokenStore } from '@sentinella/api-client';
import { captureError } from '@/lib/sentry';

const BACKEND_URL = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3333';

type UploadBody = {
  fileBase64: string;
  filename: string;
  modulo?: string;
};

/**
 * Envia arquivo para o endpoint NestJS /cloudinary/upload-evidencia com JWT atual.
 * O backend monta a pasta automaticamente como sentinella/{tenantId}/{modulo}.
 */
export async function invokeUploadEvidencia(
  body: UploadBody,
): Promise<{ url: string; public_id?: string } | { error: Error }> {
  const accessToken = tokenStore.getAccessToken();

  if (!accessToken) {
    return { error: new Error('Sessão não encontrada. Faça login novamente.') };
  }

  const res = await fetch(`${BACKEND_URL}/cloudinary/upload-evidencia`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ fileBase64: body.fileBase64, modulo: body.modulo ?? 'vistoria' }),
    credentials: 'include',
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
    const p = parsed as { url: string; publicId?: string; public_id?: string };
    return { url: p.url, public_id: p.publicId ?? p.public_id };
  }
  return { error: new Error('Resposta inválida do upload') };
}
