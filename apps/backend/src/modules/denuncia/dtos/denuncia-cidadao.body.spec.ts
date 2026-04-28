import { denunciaCidadaoSchema } from './denuncia-cidadao.body';

const BASE = { slug: 'test-slug', descricao: 'Criadouro identificado' };

describe('denunciaCidadaoSchema — fotoUrl', () => {
  it('aceita URL Cloudinary válida (image/upload)', () => {
    expect(() =>
      denunciaCidadaoSchema.parse({
        ...BASE,
        fotoUrl:
          'https://res.cloudinary.com/dxma95f9c/image/upload/v1234567890/denuncias/foto.jpg',
      }),
    ).not.toThrow();
  });

  it('rejeita URL de domínio externo', () => {
    expect(() =>
      denunciaCidadaoSchema.parse({
        ...BASE,
        fotoUrl: 'https://attacker.com/track?denuncia=xyz',
      }),
    ).toThrow();
  });

  it('rejeita URL Cloudinary sem /image/upload/ no path', () => {
    expect(() =>
      denunciaCidadaoSchema.parse({
        ...BASE,
        fotoUrl: 'https://res.cloudinary.com/dxma95f9c/raw/upload/file.jpg',
      }),
    ).toThrow();
  });

  it('aceita ausência de fotoUrl (campo nullish)', () => {
    expect(() => denunciaCidadaoSchema.parse(BASE)).not.toThrow();
  });

  it('aceita fotoUrl explicitamente null', () => {
    expect(() =>
      denunciaCidadaoSchema.parse({ ...BASE, fotoUrl: null }),
    ).not.toThrow();
  });
});
