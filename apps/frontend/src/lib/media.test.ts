import { describe, expect, it } from 'vitest';
import { resolveMediaUrl } from './media';

describe('resolveMediaUrl', () => {
  it('retorna null para vazio', () => {
    expect(resolveMediaUrl(null)).toBeNull();
    expect(resolveMediaUrl(undefined)).toBeNull();
    expect(resolveMediaUrl('   ')).toBeNull();
  });

  it('preserva URL absoluta http(s)', () => {
    expect(resolveMediaUrl('https://cdn.example.com/x.jpg')).toBe('https://cdn.example.com/x.jpg');
    expect(resolveMediaUrl('http://local/x')).toBe('http://local/x');
  });

  it('retorna null para caminho relativo storage/v1/object/', () => {
    expect(resolveMediaUrl('storage/v1/object/public/bucket/f.jpg')).toBeNull();
  });

  it('retorna null para caminho relativo bucket/path', () => {
    expect(resolveMediaUrl('avatars/user.png')).toBeNull();
  });

  it('retorna null para caminho com barras iniciais', () => {
    expect(resolveMediaUrl('//avatars/x.png')).toBeNull();
  });
});
