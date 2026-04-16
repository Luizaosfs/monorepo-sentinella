import { cn } from '@/lib/utils';
import { COR_CLASSIFICACAO_INICIAL, LABEL_CLASSIFICACAO_INICIAL } from '@/types/database';
import type { FocoRiscoClassificacao } from '@/types/database';

interface Props {
  classificacao: FocoRiscoClassificacao | null | undefined;
  size?: 'sm' | 'default';
  className?: string;
}

export function ClassificacaoBadge({ classificacao, size = 'default', className }: Props) {
  if (!classificacao) return null;
  const colorClass = COR_CLASSIFICACAO_INICIAL[classificacao] ?? '';
  const label = LABEL_CLASSIFICACAO_INICIAL[classificacao] ?? classificacao;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-semibold',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs',
        colorClass,
        className,
      )}
    >
      {label}
    </span>
  );
}
