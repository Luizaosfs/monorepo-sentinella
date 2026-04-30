import { tokenStore } from '@sentinella/api-client';
import { captureError } from '@/lib/sentry';

const BACKEND_URL = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3333';

type UploadBody = {
  file_base64: string;
  filename: string;
  folder?: string;
};

/**
 * Envia arquivo para o endpoint NestJS /cloudinary/upload com JWT atual.
 */
export async function invokeUploadEvidencia(
  body: UploadBody,
): Promise<{ url: string; public_id?: string } | { error: Error }> {
  const accessToken = tokenStore.getAccessToken();

  if (!accessToken) {
    return { error: new Error('Sessão não encontrada. Faça login novamente.') };
  }

  const res = await fetch(`${BACKEND_URL}/cloudinary/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
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
    return {
      url: (parsed as { url: string }).url,
      public_id: (parsed as { public_id?: string }).public_id,
    };
  }
  return { error: new Error('Resposta inválida do upload') };
}
