import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';

export const useTags = () => {
  return useQuery({
    queryKey: ['tags'],
    queryFn: () => api.tags.list(),
    staleTime: STALE.LONG,
  });
};
