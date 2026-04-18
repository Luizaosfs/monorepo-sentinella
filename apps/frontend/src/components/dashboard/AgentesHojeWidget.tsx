import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, ExternalLink, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { http } from '@sentinella/api-client';
import { STALE } from '@/lib/queryConfig';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const META_DIARIA = 15;

interface AgenteStatus {
  agente: { id: string; nome: string };
  total: number;
  ultima_lat: number | null;
  ultima_lng: number | null;
  ultima_endereco: string | null;
  ultima_em: string | null;
}

/**
 * Widget de agentes em campo hoje — reutilizável em CentralOperacional e AdminSupervisorTempoReal.
 * Exibe progresso de vistorias e última localização de cada agente ativo.
 */
export function AgentesHojeWidget() {
  const { clienteId } = useClienteAtivo();

  const { data: agentes = [], isLoading } = useQuery<AgenteStatus[]>({
    queryKey: ['agentes-hoje', clienteId],
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

  // G2: Busca todos os agentes do cliente para incluir quem não fez vistoria hoje
  const { data: todosAgentes = [] } = useQuery<{ id: string; nome: string }[]>({
    queryKey: ['agentes-lista-cliente', clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      try {
        const papeis = await http.get(
          `/usuarios/papeis?clienteId=${encodeURIComponent(clienteId)}`,
        ) as Array<{ usuario_id: string; papel: string }>;
        const agenteIds = new Set((papeis ?? []).filter(p => p.papel === 'agente').map(p => p.usuario_id));
        if (agenteIds.size === 0) return [];
        const usuarios = await http.get(
          `/usuarios?clienteId=${encodeURIComponent(clienteId)}&ativo=true`,
        ) as Array<{ id: string; nome: string }>;
        return (usuarios ?? []).filter(u => agenteIds.has(u.id));
      } catch {
        return [];
      }
    },
    enabled: !!clienteId,
    staleTime: STALE.LONG,
  });

  // Merge: agentes com vistoria + agentes com zero vistorias hoje
  const agentesCompletos = useMemo(() => {
    const porId = new Map(agentes.map((a) => [a.agente.id, a]));
    const extras: AgenteStatus[] = todosAgentes
      .filter((u) => !porId.has(u.id))
      .map((u) => ({ agente: u, total: 0, ultima_lat: null, ultima_lng: null, ultima_endereco: null, ultima_em: null }));
    return [...agentes, ...extras].sort((a, b) => b.total - a.total);
  }, [agentes, todosAgentes]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    );
  }

  if (agentesCompletos.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
        <Users className="h-4 w-4 shrink-0" />
        Nenhuma atividade de campo registrada hoje.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {agentesCompletos.map(({ agente, total, ultima_lat, ultima_lng, ultima_endereco, ultima_em }) => {
        const atingiu = total >= META_DIARIA;
        return (
          <Card key={agente.id} className="rounded-xl border-border/60">
            <CardContent className="p-3.5 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-sm text-foreground truncate">{agente.nome}</p>
                <Badge
                  variant="outline"
                  className={
                    total === 0
                      ? 'bg-red-50 text-red-600 border-red-300 dark:bg-red-950/20 dark:text-red-400 text-[10px] shrink-0'
                      : atingiu
                      ? 'bg-emerald-500/15 text-emerald-700 border-emerald-400/40 text-[10px] shrink-0'
                      : 'bg-amber-500/15 text-amber-700 border-amber-400/40 text-[10px] shrink-0'
                  }
                >
                  {total === 0 ? 'Sem vistoria hoje' : `${total} vistoria${total !== 1 ? 's' : ''}`}
                </Badge>
              </div>

              {ultima_endereco ? (
                <p className="text-xs text-muted-foreground line-clamp-1">{ultima_endereco}</p>
              ) : (
                <p className="text-xs text-muted-foreground italic">Sem endereço registrado</p>
              )}

              <div className="flex items-center justify-between gap-2">
                {ultima_em ? (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(ultima_em), { locale: ptBR, addSuffix: true })}
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
                    <ExternalLink className="w-3 h-3" /> Mapa
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
