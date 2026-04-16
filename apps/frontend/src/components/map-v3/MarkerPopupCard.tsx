import { LevantamentoItem } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { resolveMediaUrl } from "@/lib/media";
import { Button } from "@/components/ui/button";

interface Props {
  item: LevantamentoItem;
  onOpenDetails: () => void;
}

const riskProps = (risco: string | null) => {
  switch ((risco || '').toLowerCase()) {
    case 'critico': 
    case 'alto': return { color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' };
    case 'medio': return { color: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/20' };
    case 'baixo': return { color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' };
    default: return { color: 'text-gray-400', bg: 'bg-muted border-border/60' };
  }
};

export function MarkerPopupCard({ item, onOpenDetails }: Props) {
  const meta = riskProps(item.risco);
  const imgUrl = resolveMediaUrl(item.image_url);
  const score = item.score_final ?? item.peso;

  return (
    <div className="flex flex-col gap-3 min-w-[200px] font-sans">
      {imgUrl && (
        <div className="w-full h-32 rounded-lg bg-muted overflow-hidden border border-border/40 object-cover">
          <img src={imgUrl} className="w-full h-full object-cover" alt="Detecção" />
        </div>
      )}
      
      <div>
        <h4 className="font-bold text-sm text-foreground m-0 leading-tight">
          {item.item || 'Item não especificado'}
        </h4>
        <p className="text-xs text-muted-foreground mt-1 mb-0 w-full truncate max-w-[220px]">
          {item.endereco_curto || item.endereco_completo || 'Sem endereço'}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline" className={`capitalize shadow-none text-[10px] px-2 py-0 h-5 font-bold ${meta.bg} ${meta.color}`}>
          {item.risco || 'Sem classif.'}
        </Badge>
        {score != null && (
          <Badge variant="secondary" className="shadow-none text-[10px] px-2 py-0 h-5 font-bold">
            Score {score}
          </Badge>
        )}
      </div>

      <Button onClick={onOpenDetails} className="w-full h-8 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90">
        Ver detalhes
      </Button>
    </div>
  );
}
