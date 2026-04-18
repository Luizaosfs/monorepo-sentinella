import { useQuery } from '@tanstack/react-query';
import { Radio, ExternalLink, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { http } from '@sentinella/api-client';
import { STALE } from '@/lib/queryConfig';
import AdminPageHeader from '@/components/AdminPageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const META_DIARIA = 15; // meta padrão por dia

interface AgenteStatus {
  agente: { id: string; nome: string };
  total: number;
  ultima_lat: number | null;
  ultima_lng: number | null;
  ultima_endereco: string | null;
  ultima_em: string | null;
}

export default function AdminSupervisorTempoReal() {
  const { clienteId } = useClienteAtivo();

  const { data: agentes = [], isLoading } = useQuery<AgenteStatus[]>({
    queryKey: ['supervisor_tempo_real', clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      const hoje = new Date().toISOString().split('T')[0];
      try {
        const vistorias = await http.get(
          `/vistorias?clienteId=${encodeURIComponent(clienteId)}&createdAfter=${encodeURIComponent(hoje)}`,
        ) as Array<Record<string, unknown>>;

        const byAgente = new Map<string, AgenteStatus>();
        for (const v of (vistorias ?? [])) {
          const ag = (v.agente ?? { id: v.agente_id, nome: null }) as { id: string; nome: string } | null;
          if (!ag?.id) continue;
          if (!byAgente.has(ag.id)) {
            byAgente.set(ag.id, { agente: ag, total: 0, ultima_lat: null, ultima_lng: null, ultima_endereco: null, ultima_em: null });
          }
          const entry = byAgente.get(ag.id)!;
          entry.total++;
          if (!entry.ultima_em) {
            const im = v.imovel as { logradouro: string; numero: string; bairro: string } | null;
            entry.ultima_lat = (v.lat_chegada ?? v.latChegada) as number | null;
            entry.ultima_lng = (v.lng_chegada ?? v.lngChegada) as number | null;
            entry.ultima_endereco = im ? `${im.logradouro}, ${im.numero} — ${im.bairro}` : null;
            entry.ultima_em = (v.checkin_em ?? v.checkinEm ?? v.created_at ?? v.createdAt) as string | null;
          }
        }
        return [...byAgente.values()];
      } catch {
        return [];
      }
    },
    enabled: !!clienteId,
    staleTime: STALE.SHORT,
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <AdminPageHeader
        title="Supervisão em tempo real"
        description="Posição e progresso de cada agente hoje"
        icon={Radio}
      />

      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
          Atualiza automaticamente a cada minuto
        </Badge>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </div>
      ) : agentes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            Nenhuma atividade registrada hoje.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agentes.map(({ agente, total, ultima_lat, ultima_lng, ultima_endereco, ultima_em }) => {
            const atingiu = total >= META_DIARIA;
            const temAtividade = total > 0;

            return (
              <Card key={agente.id} className="rounded-2xl border-border/60">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm text-foreground">{agente.nome}</h3>
                    <Badge
                      variant="outline"
                      className={
                        !temAtividade
                          ? 'text-muted-foreground border-border/60 text-[10px]'
                          : atingiu
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-400/40 text-[10px]'
                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-400/40 text-[10px]'
                      }
                    >
                      {total} vistoria{total !== 1 ? 's' : ''} hoje
                    </Badge>
                  </div>

                  {ultima_endereco ? (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Último local visitado:</p>
                      <p className="text-xs font-medium text-foreground line-clamp-1">{ultima_endereco}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Sem endereço registrado</p>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    {ultima_em ? (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>
                          {formatDistanceToNow(new Date(ultima_em), { locale: ptBR, addSuffix: true })}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}

                    {ultima_lat != null && ultima_lng != null && (
                      <a
                        href={`https://www.google.com/maps?q=${ultima_lat},${ultima_lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" /> Ver no mapa
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
