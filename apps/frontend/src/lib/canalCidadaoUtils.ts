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

const MAX_DIM = 1280;
const MAX_BYTES = 900_000; // 900KB — folga para o overhead base64 (~33%)

function compressToJpeg(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width >= height) { height = Math.round(height * MAX_DIM / width); width = MAX_DIM; }
        else { width = Math.round(width * MAX_DIM / height); height = MAX_DIM; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      const tryQuality = (q: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error('canvas.toBlob falhou')); return; }
            if (blob.size <= MAX_BYTES || q <= 0.3) resolve(blob);
            else tryQuality(Math.max(0.3, q - 0.15));
          },
          'image/jpeg',
          q,
        );
      };
      tryQuality(0.82);
    };
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Upload de foto de denúncia via base64 + JSON.
 * Comprime para JPEG ≤ 900KB antes de enviar.
 * Endpoint público — não requer autenticação.
 * NÃO lança exceção; retorna null em caso de falha.
 */
export async function uploadDenunciaFoto(
  file: File,
): Promise<{ url: string; public_id: string } | null> {
  try {
    const compressed = await compressToJpeg(file);
    const fileBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => { resolve((reader.result as string).split(',')[1]); };
      reader.onerror = reject;
      reader.readAsDataURL(compressed);
    });
    const result = await http.post('/denuncias/upload-foto', {
      fileBase64,
      contentType: 'image/jpeg',
      folder: 'denuncias',
    }) as { secure_url?: string; public_id?: string };
    return result.secure_url ? { url: result.secure_url, public_id: result.public_id ?? '' } : null;
  } catch {
    return null;
  }
}
