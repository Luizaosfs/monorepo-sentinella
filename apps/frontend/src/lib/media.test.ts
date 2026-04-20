import { describe, expect, it, vi } from 'vitest';

// vi.hoisted roda antes de qualquer import — garante que a constante de módulo
// em media.ts leia a URL de teste e não a URL real do .env.
vi.hoisted(() => {
  (import.meta.env as Record<string, string>).VITE_SUPABASE_URL = 'https://test-project.supabase.co';
});

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

  it('prefixa caminho storage/v1/object/', () => {
    expect(resolveMediaUrl('storage/v1/object/public/bucket/f.jpg')).toBe(
      'https://test-project.supabase.co/storage/v1/object/public/bucket/f.jpg',
    );
  });

  it('prefixa bucket/path como public object', () => {
    expect(resolveMediaUrl('avatars/user.png')).toBe(
      'https://test-project.supabase.co/storage/v1/object/public/avatars/user.png',
    );
  });

  it('remove barras iniciais do path relativo', () => {
    expect(resolveMediaUrl('//avatars/x.png')).toBe(
      'https://test-project.supabase.co/storage/v1/object/public/avatars/x.png',
    );
  });
});
