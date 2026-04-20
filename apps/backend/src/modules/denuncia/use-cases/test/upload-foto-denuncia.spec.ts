import { mock } from 'jest-mock-extended';
import { uploadFotoDenunciaSchema } from '../../dtos/upload-foto-denuncia.body';
import { UploadFotoDenuncia } from '../upload-foto-denuncia';
import type { CloudinaryService } from '../../../cloudinary/cloudinary.service';

const makeInput = (overrides: Record<string, unknown> = {}) => ({
  fileBase64: 'A'.repeat(200),
  contentType: 'image/jpeg' as const,
  folder: 'denuncias' as const,
  ...overrides,
});

describe('UploadFotoDenuncia', () => {
  it('upload válido com image/jpeg pequeno retorna { secure_url, public_id }', async () => {
    const cloudinaryService = mock<CloudinaryService>();
    cloudinaryService.uploadBase64Public.mockResolvedValue({
      secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/denuncias/abc.jpg',
      public_id: 'denuncias/abc',
    });
    const useCase = new UploadFotoDenuncia(cloudinaryService);

    const result = await useCase.execute(makeInput());

    expect(result).toEqual({
      secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/denuncias/abc.jpg',
      public_id: 'denuncias/abc',
    });
    expect(cloudinaryService.uploadBase64Public).toHaveBeenCalledWith(
      makeInput().fileBase64,
      'image/jpeg',
      'denuncias',
    );
  });

  it('content-type image/gif lança invalidContentType', async () => {
    const cloudinaryService = mock<CloudinaryService>();
    const useCase = new UploadFotoDenuncia(cloudinaryService);

    await expect(
      useCase.execute(makeInput({ contentType: 'image/gif' })),
    ).rejects.toMatchObject({ message: 'Tipo de arquivo não permitido' });
    expect(cloudinaryService.uploadBase64Public).not.toHaveBeenCalled();
  });

  it('base64 que decodifica para mais de 8MB lança fileTooLarge', async () => {
    const cloudinaryService = mock<CloudinaryService>();
    const useCase = new UploadFotoDenuncia(cloudinaryService);

    // 11_200_000 chars de 'A' decodificam para ~8.4MB (> limite de 8MB)
    const oversized = 'A'.repeat(11_200_000);
    await expect(
      useCase.execute(makeInput({ fileBase64: oversized })),
    ).rejects.toMatchObject({ message: 'Arquivo maior que 8 MB' });
    expect(cloudinaryService.uploadBase64Public).not.toHaveBeenCalled();
  });

  it('folder diferente de "denuncias" é rejeitado pelo schema Zod', () => {
    const result = uploadFotoDenunciaSchema.safeParse({
      fileBase64: 'A'.repeat(200),
      contentType: 'image/jpeg',
      folder: 'evidencias',
    });
    expect(result.success).toBe(false);
  });

  it('CloudinaryService lança erro → use-case lança uploadFailed', async () => {
    const cloudinaryService = mock<CloudinaryService>();
    cloudinaryService.uploadBase64Public.mockRejectedValue(new Error('Network timeout'));
    const useCase = new UploadFotoDenuncia(cloudinaryService);

    await expect(useCase.execute(makeInput())).rejects.toMatchObject({
      message: 'Falha ao enviar a foto',
    });
  });
});
