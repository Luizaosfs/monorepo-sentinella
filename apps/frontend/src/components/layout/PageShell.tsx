import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageShellProps {
  children: ReactNode;
  /** Classes extras compostas após a base `min-h-screen bg-background`. */
  className?: string;
}

/**
 * Wrapper de página padrão (espelha o `AppLayout` do manfrota-mobile).
 *
 * Base mínima e neutra: `min-h-screen bg-background`. Layout específico
 * (ex.: `flex flex-col`, `pb-24`) vem via `className` para não alterar
 * o visual das telas existentes ao adotar.
 */
export function PageShell({ children, className }: PageShellProps) {
  return <div className={cn('min-h-screen bg-background', className)}>{children}</div>;
}
