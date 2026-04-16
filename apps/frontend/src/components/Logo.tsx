import React from 'react';
import { cn } from '@/lib/utils';
import { LogoIcon } from '@/components/LogoIcon';

interface LogoProps {
  className?: string;
  /** Exibir ícone do escudo (radar) ao lado do texto. Default true. */
  showIcon?: boolean;
  /** Tamanho do ícone em pixels. Default 32. */
  iconSize?: number;
}

export const Logo = React.forwardRef<HTMLSpanElement, LogoProps>(
  ({ className, showIcon = true, iconSize = 32 }, ref) => {
    return (
      <span ref={ref} className={cn('inline-flex items-center gap-2', className)}>
        {showIcon && (
          <LogoIcon size={iconSize} className="shrink-0" />
        )}
        <span
          className={cn(
            'font-black italic tracking-tight uppercase leading-none'
          )}
        >
          SENTINELLA
        </span>
      </span>
    );
  }
);
Logo.displayName = 'Logo';
