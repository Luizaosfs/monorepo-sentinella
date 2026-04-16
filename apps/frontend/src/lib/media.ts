import { supabaseUrl } from '@/lib/supabase';

export const resolveMediaUrl = (value?: string | null) => {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) return raw;

  const normalized = raw.replace(/^\/+/, '');
  if (normalized.startsWith('storage/v1/object/')) {
    return `${supabaseUrl}/${normalized}`;
  }

  // Expected format: bucket/path/to/file.jpg
  return `${supabaseUrl}/storage/v1/object/public/${normalized}`;
};
