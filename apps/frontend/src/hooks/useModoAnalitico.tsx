/**
 * useModoAnalitico — Toggle global do modo analítico avançado.
 *
 * Context + hook para compartilhar estado entre AppLayout (toggle) e
 * páginas de detalhe (GestorFocoDetalhe, FichaImovel360).
 *
 * - Persiste em localStorage (chave: sentinella_modo_analitico)
 * - Apenas altera visualização; nunca altera dados ou regras
 * - Exibir toggle somente para supervisor, admin e analista_regional
 */
import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

const STORAGE_KEY = 'sentinella_modo_analitico';

interface ModoAnaliticoContextValue {
  ativo: boolean;
  toggle: () => void;
}

const ModoAnaliticoContext = createContext<ModoAnaliticoContextValue>({
  ativo: false,
  toggle: () => {},
});

export function ModoAnaliticoProvider({ children }: { children: ReactNode }) {
  const [ativo, setAtivo] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const toggle = useCallback(() => {
    setAtivo((v) => {
      const next = !v;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch { /* ignore quota/private mode */ }
      return next;
    });
  }, []);

  return (
    <ModoAnaliticoContext.Provider value={{ ativo, toggle }}>
      {children}
    </ModoAnaliticoContext.Provider>
  );
}

export function useModoAnalitico() {
  return useContext(ModoAnaliticoContext);
}
