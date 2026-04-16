import { useState, useCallback } from 'react';

/**
 * Hook para estado booleano toggle (ex.: modal aberto/fechado, dropdown).
 * Padrão frontend: evita repetição de useState + handler.
 */
export function useToggle(initialValue = false): [boolean, () => void] {
  const [value, setValue] = useState(initialValue);
  const toggle = useCallback(() => {
    setValue((v) => !v);
  }, []);
  return [value, toggle];
}
