import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface RealtimeInvalidatorOptions {
  table: string;
  filter?: string; // e.g. 'cliente_id=eq.abc123'
  queryKeys: unknown[][];
  enabled?: boolean;
}

export function useRealtimeInvalidator({
  table,
  filter,
  queryKeys,
  enabled = true,
}: RealtimeInvalidatorOptions) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const channelName = filter
      ? `realtime-${table}-${filter}`
      : `realtime-${table}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          ...(filter ? { filter } : {}),
        },
        () => {
          queryKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}
