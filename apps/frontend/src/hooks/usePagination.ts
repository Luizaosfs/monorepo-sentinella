import { useState, useMemo, useCallback } from 'react';

const DEFAULT_PAGE_SIZE = 10; // default items per page

export function usePagination<T>(items: T[], initialPageSize = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginated = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  );

  const goTo = useCallback((p: number) => setPage(Math.max(1, Math.min(p, totalPages))), [totalPages]);
  const next = useCallback(() => goTo(safePage + 1), [goTo, safePage]);
  const prev = useCallback(() => goTo(safePage - 1), [goTo, safePage]);
  const reset = useCallback(() => setPage(1), []);
  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPage(1);
  }, []);

  return { page: safePage, totalPages, paginated, goTo, next, prev, reset, total: items.length, pageSize, setPageSize };
}
