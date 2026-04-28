import { uploadFotoDenunciaSchema } from './upload-foto-denuncia.body';

const BASE_VALID = { contentType: 'image/jpeg' as const, folder: 'denuncias' as const };

describe('uploadFotoDenunciaSchema — fileBase64 size limits', () => {
  it('aceita payload exatamente no limite de 4 MB base64', () => {
    expect(() =>
      uploadFotoDenunciaSchema.parse({
        ...BASE_VALID,
        fileBase64: 'A'.repeat(4_000_000),
      }),
    ).not.toThrow();
  });

  it('rejeita payload 1 byte acima do limite (4_000_001)', () => {
    expect(() =>
      uploadFotoDenunciaSchema.parse({
        ...BASE_VALID,
        fileBase64: 'A'.repeat(4_000_001),
      }),
    ).toThrow();
  });

  it('aceita payload mínimo válido (100 chars)', () => {
    expect(() =>
      uploadFotoDenunciaSchema.parse({
        ...BASE_VALID,
        fileBase64: 'A'.repeat(100),
      }),
    ).not.toThrow();
  });

  it('rejeita contentType não permitido', () => {
    expect(() =>
      uploadFotoDenunciaSchema.parse({
        ...BASE_VALID,
        fileBase64: 'A'.repeat(100),
        contentType: 'image/gif',
      }),
    ).toThrow();
  });
});
