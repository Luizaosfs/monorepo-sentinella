import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const POLL_INTERVAL_MS = 30_000;

interface RealtimeInvalidatorOptions {
  table: string;
  filter?: string;
  queryKeys: unknown[][];
  enabled?: boolean;
}

export function useRealtimeInvalidator({
  table: _table,
  filter: _filter,
  queryKeys,
  enabled = true,
}: RealtimeInvalidatorOptions) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || queryKeys.length === 0) return;
    const id = setInterval(() => {
      queryKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [enabled, queryClient]); // eslint-disable-line react-hooks/exhaustive-deps
}
