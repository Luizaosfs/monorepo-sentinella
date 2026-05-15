import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /**
   * 'title' — header de listagem/home (sem voltar; título grande).
   * 'back'  — header de fluxo/formulário (botão voltar; título médio).
   */
  variant?: 'title' | 'back';
  /** Handler do botão voltar (apenas variant 'back'). */
  onBack?: () => void;
  /** Conteúdo à direita (ex.: botão de ação). */
  actions?: ReactNode;
}

/**
 * Header sticky padrão (espelha o `PageHeader` do manfrota-mobile).
 *
 * Reproduz fielmente os dois headers já usados no app — sem mudança visual:
 *  - `title`: `bg-card border-b px-4 py-4 sticky top-0 z-10` + título `text-lg font-bold`
 *  - `back` : `bg-card border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10`
 */
export function PageHeader({
  title,
  subtitle,
  variant = 'title',
  onBack,
  actions,
}: PageHeaderProps) {
  if (variant === 'back') {
    return (
      <div className="bg-card border-b px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={onBack}
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-semibold text-base leading-tight">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {actions}
      </div>
    );
  }

  return (
    <div className="bg-card border-b px-4 py-4 sticky top-0 z-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {actions}
      </div>
    </div>
  );
}
