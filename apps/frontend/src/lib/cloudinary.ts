/**
 * Upload de imagens para Cloudinary (upload não assinado).
 * Parâmetros permitidos em unsigned: upload_preset, folder, public_id, tags, etc.
 * Não use return_delete_token (não permitido em unsigned). Exclusão via Edge Function + public_id.
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;

const UPLOAD_URL = CLOUD_NAME
  ? `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`
  : '';

export function isCloudinaryConfigured(): boolean {
  return Boolean(CLOUD_NAME && UPLOAD_PRESET);
}

export interface UploadImageResult {
  secure_url: string;
  /** public_id para excluir a imagem via backend se o cadastro não for concluído. */
  public_id: string;
}

/**
 * Envia um arquivo de imagem para o Cloudinary (apenas parâmetros permitidos em unsigned).
 */
export async function uploadImage(file: File): Promise<UploadImageResult> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      'Cloudinary não configurado. Defina VITE_CLOUDINARY_CLOUD_NAME e VITE_CLOUDINARY_UPLOAD_PRESET no .env'
    );
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);

  const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: { message?: string } })?.error?.message ||
        `Falha no upload: ${res.status} ${res.statusText}`
    );
  }

  const data = (await res.json()) as { secure_url?: string; public_id?: string };
  if (!data.secure_url) throw new Error('Resposta do Cloudinary sem URL.');
  return {
    secure_url: data.secure_url,
    public_id: data.public_id || '',
  };
}
