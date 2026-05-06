export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  /** Tamanho máximo em bytes. Quando definido, reduz qualidade iterativamente até atingir o limite. */
  maxBytes?: number;
}

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Falha ao comprimir imagem'))),
      'image/jpeg',
      quality,
    ),
  );

/**
 * Comprime imagem via canvas antes do upload.
 * Padrão: 1920×1920px, qualidade 0.85, JPEG.
 * Com `maxBytes`: reduz qualidade (0.85 → 0.3) até o blob caber no limite.
 */
export async function compressImage(
  file: File,
  { maxWidth = 1920, maxHeight = 1920, quality = 0.85, maxBytes }: CompressOptions = {},
): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    const url = URL.createObjectURL(file);
    el.onload  = () => { URL.revokeObjectURL(url); resolve(el); };
    el.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagem inválida')); };
    el.src = url;
  });

  const scale = Math.min(1, maxWidth / img.naturalWidth, maxHeight / img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width  = Math.round(img.naturalWidth  * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas não disponível');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  if (!maxBytes) return canvasToBlob(canvas, quality);

  // Se a imagem original for maior que o limite, reduz as dimensões proporcionalmente
  // antes de iterar qualidade — fator = sqrt(maxBytes / tamanho_original)
  if (file.size > maxBytes) {
    const fator = Math.sqrt(maxBytes / file.size);
    canvas.width  = Math.max(1, Math.round(canvas.width  * fator));
    canvas.height = Math.max(1, Math.round(canvas.height * fator));
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }

  // Itera qualidade para garantir o limite de tamanho
  let q = quality;
  while (q >= 0.3) {
    const blob = await canvasToBlob(canvas, q);
    if (blob.size <= maxBytes) return blob;
    q = Math.round((q - 0.1) * 10) / 10;
  }
  // Última tentativa com qualidade mínima
  return canvasToBlob(canvas, 0.3);
}

/** Converte File para base64 puro (sem prefixo data:...). */
export function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
