import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { supabase } from '@/lib/supabase';
import type { FocoRiscoAtivo } from '@/types/database';

export function useMapaFocosRealtime(clienteId: string | null | undefined) {
  const [focos, setFocos] = useState<FocoRiscoAtivo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!clienteId) return;

    setIsLoading(true);

    // Carga inicial — apenas focos ativos
    api.focosRisco.list(clienteId, {
      status: ['suspeita', 'em_triagem', 'aguarda_inspecao', 'em_inspecao', 'confirmado', 'em_tratamento'],
      pageSize: 1000,
    }).then(({ data }) => {
      setFocos(data);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));

    // Realtime subscription
    const channel = supabase
      .channel(`focos-mapa-${clienteId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'focos_risco',
        filter: `cliente_id=eq.${clienteId}`,
      }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setFocos((prev) => prev.filter((f) => f.id !== (payload.old as { id: string }).id));
        } else if (payload.eventType === 'INSERT') {
          const newId = (payload.new as { id: string }).id;
          api.focosRisco.list(clienteId, { pageSize: 1000 }).then(({ data }) => {
            const novo = data.find((f) => f.id === newId);
            if (novo) setFocos((prev) => [...prev.filter((f) => f.id !== newId), novo]);
          });
        } else if (payload.eventType === 'UPDATE') {
          const updatedId = (payload.new as { id: string }).id;
          api.focosRisco.list(clienteId, {
            status: ['suspeita', 'em_triagem', 'aguarda_inspecao', 'em_inspecao', 'confirmado', 'em_tratamento'],
            pageSize: 1000,
          }).then(({ data }) => {
            const updated = data.find((f) => f.id === updatedId);
            setFocos((prev) =>
              updated
                ? prev.map((f) => (f.id === updatedId ? updated : f))
                : prev.filter((f) => f.id !== updatedId), // saiu dos ativos
            );
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clienteId]);

  return { focos, isLoading };
}
