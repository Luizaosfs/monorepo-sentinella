export const resolveMediaUrl = (value?: string | null): string | null => {
  if (!value) return null;
  const raw = value.trim();
  return /^https?:\/\//i.test(raw) ? raw : null;
};
