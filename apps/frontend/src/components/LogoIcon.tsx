import { cn } from '@/lib/utils';

const ASPECT = 140 / 120;

/**
 * Ícone do logo Sentinella (escudo + radar) — asset em `/logo-icon.png`
 * (mesmo desenho da marca; escalável via width/height).
 */
export function LogoIcon({ size = 32, className }: { size?: number; className?: string }) {
  const h = Math.round(size * ASPECT);
  return (
    <img
      src="/logo-icon.png"
      alt=""
      width={size}
      height={h}
      className={cn('shrink-0 object-contain select-none', className)}
      aria-hidden
      decoding="async"
      draggable={false}
    />
  );
}
