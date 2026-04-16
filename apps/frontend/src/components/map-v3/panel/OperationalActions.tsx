import { Button } from '@/components/ui/button';
import { PlusCircle, Send, CheckCircle2 } from 'lucide-react';

interface OperationalActionsProps {
  onCreateTask?: () => void;
  onSendFieldTeam?: () => void;
  onMarkResolved?: () => void;
  className?: string;
}

export function OperationalActions(props: OperationalActionsProps) {
  const { onCreateTask, onSendFieldTeam, onMarkResolved, className = '' } = props;

  return (
    <div className={`space-y-2 ${className}`}>
      <Button
        className="w-full rounded-xl h-10 font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
        onClick={onCreateTask}
      >
        <PlusCircle className="w-4 h-4 mr-2" />
        Criar tarefa de correção
      </Button>
      <Button
        variant="outline"
        className="w-full rounded-xl h-10 font-semibold border-border/60 hover:bg-muted"
        onClick={onSendFieldTeam}
      >
        <Send className="w-4 h-4 mr-2" />
        Enviar equipe de campo
      </Button>
      <Button
        variant="ghost"
        className="w-full rounded-xl h-9 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10"
        onClick={onMarkResolved}
      >
        <CheckCircle2 className="w-4 h-4 mr-2" />
        Marcar como resolvido
      </Button>
    </div>
  );
}
