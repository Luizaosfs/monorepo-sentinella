/**
 * Utilitários compartilhados: PortalDenuncia + DenunciaCidadao
 * - extractErrorMessage: normaliza erros para mensagens amigáveis
 * - uploadDenunciaFoto: base64 + anon key (funciona sem sessão autenticada)
 * - DenunciaResult: tipo de retorno da RPC denunciar_cidadao
 */

export interface DenunciaResult {
  ok: boolean;
  error?: string;
  foco_id?: string;
  deduplicado?: boolean;
}

export function extractErrorMessage(err: unknown): string {
  const raw = (() => {
    if (err instanceof Error && err.message) return err.message;
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object') {
      const e = err as Record<string, unknown>;
      return [e.message, e.details, e.hint].filter((v) => typeof v === 'string' && v).join(' | ');
    }
    return '';
  })();
  if (!raw) return 'Não foi possível enviar. Verifique sua conexão e tente novamente.';
  if (/fetch|network|Failed to fetch|NetworkError/i.test(raw))
    return 'Sem conexão com a internet. Verifique sua rede e tente novamente.';
  if (/rate.?limit|too many/i.test(raw))
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.';
  if (/foto|image|upload|cloudinary/i.test(raw))
    return 'Não foi possível enviar a foto. Tente com uma imagem menor ou sem foto.';
  if (/slug|bairro|not found|invalid/i.test(raw))
    return 'Link inválido. Use o QR code fornecido pela prefeitura.';
  return 'Não foi possível registrar sua denúncia. Tente novamente em instantes.';
}

/**
 * Upload de foto de denúncia via base64 + JSON.
 * Usa anon key como fallback — funciona sem sessão autenticada (cidadão sem login).
 * NÃO lança exceção; retorna null em caso de falha.
 */
export async function uploadDenunciaFoto(
  file: File,
  accessToken?: string | null,
): Promise<{ url: string; public_id: string } | null> {
  try {
    const fileBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => { resolve((reader.result as string).split(',')[1]); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const anonKey   = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const resp = await fetch(`${supabaseUrl}/functions/v1/cloudinary-upload-image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken ?? anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ file_base64: fileBase64, content_type: file.type, folder: 'denuncias' }),
    });
    if (!resp.ok) return null;
    const json = await resp.json() as { secure_url?: string; public_id?: string };
    return json.secure_url ? { url: json.secure_url, public_id: json.public_id ?? '' } : null;
  } catch {
    return null;
  }
}
