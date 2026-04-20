/**
 * Utilitários compartilhados: PortalDenuncia + DenunciaCidadao
 * - extractErrorMessage: normaliza erros para mensagens amigáveis
 * - uploadDenunciaFoto: base64 para endpoint público /denuncias/upload-foto
 * - DenunciaResult: tipo de retorno da RPC denunciar_cidadao
 */
import '@/lib/api-client-config';
import { http } from '@sentinella/api-client';

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
 * Endpoint público — não requer autenticação.
 * NÃO lança exceção; retorna null em caso de falha.
 */
export async function uploadDenunciaFoto(
  file: File,
): Promise<{ url: string; public_id: string } | null> {
  try {
    const fileBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => { resolve((reader.result as string).split(',')[1]); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const result = await http.post('/denuncias/upload-foto', {
      fileBase64,
      contentType: file.type,
      folder: 'denuncias',
    }) as { secure_url?: string; public_id?: string };
    return result.secure_url ? { url: result.secure_url, public_id: result.public_id ?? '' } : null;
  } catch {
    return null;
  }
}
