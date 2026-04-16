import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, ExternalLink, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
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

      const { data: vistorias } = await supabase
        .from('vistorias')
        .select(`
          id, agente_id, status, created_at,
          lat_chegada, lng_chegada, checkin_em,
          imovel:imoveis(logradouro, numero, bairro),
          agente:usuarios(id, nome)
        `)
        .eq('cliente_id', clienteId)
        .gte('created_at', hoje)
        .order('created_at', { ascending: false });

      const byAgente = new Map<string, AgenteStatus>();

      for (const v of (vistorias ?? [])) {
        const ag = v.agente as { id: string; nome: string } | null;
        if (!ag) continue;

        if (!byAgente.has(ag.id)) {
          byAgente.set(ag.id, {
            agente: ag,
            total: 0,
            ultima_lat: null,
            ultima_lng: null,
            ultima_endereco: null,
            ultima_em: null,
          });
        }

        const entry = byAgente.get(ag.id)!;
        entry.total++;

        if (!entry.ultima_em) {
          const im = v.imovel as { logradouro: string; numero: string; bairro: string } | null;
          entry.ultima_lat = v.lat_chegada;
          entry.ultima_lng = v.lng_chegada;
          entry.ultima_endereco = im ? `${im.logradouro}, ${im.numero} — ${im.bairro}` : null;
          entry.ultima_em = v.checkin_em ?? v.created_at;
        }
      }

      return [...byAgente.values()];
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
      // Passo 1: auth_ids com papel 'agente'
      const { data: papeis } = await supabase
        .from('papeis_usuarios')
        .select('usuario_id')
        .eq('papel', 'agente');
      const authIds = (papeis ?? []).map((p: { usuario_id: string }) => p.usuario_id);
      if (authIds.length === 0) return [];
      // Passo 2: usuários do cliente que têm esse papel
      const { data: usuarios } = await supabase
        .from('usuarios')
        .select('id, nome')
        .eq('cliente_id', clienteId)
        .eq('ativo', true)
        .in('auth_id', authIds);
      return usuarios ?? [];
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
