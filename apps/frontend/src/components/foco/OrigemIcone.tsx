import { Radio, User, MessageSquare, CloudRain, Edit } from 'lucide-react';
import { LABEL_ORIGEM } from '@/types/focoRisco';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const ICONE_MAP: Record<string, React.ElementType> = {
  drone:   Radio,
  agente:  User,
  cidadao: MessageSquare,
  pluvio:  CloudRain,
  manual:  Edit,
};

interface Props {
  origem: string;
  className?: string;
}

export function OrigemIcone({ origem, className }: Props) {
  const Icon = ICONE_MAP[origem] ?? Edit;
  const label = LABEL_ORIGEM[origem] ?? origem;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={className}>
          <Icon className="w-4 h-4 text-muted-foreground" />
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
