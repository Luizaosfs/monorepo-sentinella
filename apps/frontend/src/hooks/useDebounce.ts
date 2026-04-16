import { useState, useEffect } from 'react';

/**
 * Debounce de valor (ex.: termo de busca) para evitar chamadas a cada tecla.
 * Padrão frontend: reduz requisições e re-renders em listas filtradas.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
