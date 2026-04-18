const _supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || '';

export const resolveMediaUrl = (value?: string | null) => {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) return raw;

  // Legacy Supabase Storage paths — resolved via env var if still present in DB
  const normalized = raw.replace(/^\/+/, '');
  if (normalized.startsWith('storage/v1/object/')) {
    return _supabaseUrl ? `${_supabaseUrl}/${normalized}` : null;
  }

  // Expected format: bucket/path/to/file.jpg (Supabase Storage legacy)
  return _supabaseUrl ? `${_supabaseUrl}/storage/v1/object/public/${normalized}` : null;
};
