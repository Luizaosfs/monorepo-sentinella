import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { FocoRiscoAtivo } from '@/types/database';

const ACTIVE_STATUSES = ['suspeita', 'em_triagem', 'aguarda_inspecao', 'em_inspecao', 'confirmado', 'em_tratamento'] as const;
const POLL_INTERVAL_MS = 30_000;

export function useMapaFocosRealtime(clienteId: string | null | undefined) {
  const [focos, setFocos] = useState<FocoRiscoAtivo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFocos = useCallback(() => {
    if (!clienteId) return;
    api.focosRisco.list(clienteId, { status: [...ACTIVE_STATUSES], pageSize: 1000 })
      .then(({ data }) => { setFocos(data); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, [clienteId]);

  useEffect(() => {
    if (!clienteId) return;
    setIsLoading(true);
    fetchFocos();
    const id = setInterval(fetchFocos, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [clienteId, fetchFocos]);

  return { focos, isLoading };
}
