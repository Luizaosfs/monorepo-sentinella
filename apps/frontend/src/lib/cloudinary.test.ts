import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('cloudinary', () => {
  const origFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = origFetch;
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('isCloudinaryConfigured é false e uploadImage lança sem env', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_CLOUDINARY_CLOUD_NAME', '');
    vi.stubEnv('VITE_CLOUDINARY_UPLOAD_PRESET', '');
    const { isCloudinaryConfigured, uploadImage } = await import('./cloudinary');
    expect(isCloudinaryConfigured()).toBe(false);
    await expect(uploadImage(new File(['x'], 'a.jpg'))).rejects.toThrow('não configurado');
  });

  it('uploadImage envia FormData e retorna URL em sucesso', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_CLOUDINARY_CLOUD_NAME', 'demo');
    vi.stubEnv('VITE_CLOUDINARY_UPLOAD_PRESET', 'ml_default');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ secure_url: 'https://res.cloudinary.com/x', public_id: 'pid1' }),
    } as Response);

    const { isCloudinaryConfigured, uploadImage } = await import('./cloudinary');
    expect(isCloudinaryConfigured()).toBe(true);

    const file = new File(['bytes'], 'f.png', { type: 'image/png' });
    const r = await uploadImage(file);
    expect(r.secure_url).toBe('https://res.cloudinary.com/x');
    expect(r.public_id).toBe('pid1');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.cloudinary.com/v1_1/demo/image/upload',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('uploadImage lança com mensagem da API quando !ok', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_CLOUDINARY_CLOUD_NAME', 'demo');
    vi.stubEnv('VITE_CLOUDINARY_UPLOAD_PRESET', 'ml_default');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad',
      json: async () => ({ error: { message: 'preset inválido' } }),
    } as Response);

    const { uploadImage } = await import('./cloudinary');
    await expect(uploadImage(new File(['x'], 'a.jpg'))).rejects.toThrow('preset inválido');
  });

  it('uploadImage usa status quando JSON sem mensagem', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_CLOUDINARY_CLOUD_NAME', 'demo');
    vi.stubEnv('VITE_CLOUDINARY_UPLOAD_PRESET', 'ml_default');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Err',
      json: async () => ({}),
    } as Response);

    const { uploadImage } = await import('./cloudinary');
    await expect(uploadImage(new File(['x'], 'a.jpg'))).rejects.toThrow('Falha no upload');
  });

  it('uploadImage lança se resposta sem secure_url', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_CLOUDINARY_CLOUD_NAME', 'demo');
    vi.stubEnv('VITE_CLOUDINARY_UPLOAD_PRESET', 'ml_default');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ public_id: 'x' }),
    } as Response);

    const { uploadImage } = await import('./cloudinary');
    await expect(uploadImage(new File(['x'], 'a.jpg'))).rejects.toThrow('sem URL');
  });
});
