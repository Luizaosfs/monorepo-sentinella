import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from '@/App';

// Mock useAuth — controla o estado de sessão sem tocar no Supabase
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  normalizePapel: vi.fn(),
}));

// Mock useClienteAtivo para não precisar de contexto real
vi.mock('@/hooks/useClienteAtivo', () => ({
  useClienteAtivo: () => ({ clienteId: null, clienteAtivo: null, clientes: [], loading: false, setClienteId: vi.fn() }),
  ClienteAtivoProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { useAuth } from '@/hooks/useAuth';

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

const renderWithRouter = (ui: React.ReactNode, initialPath = '/') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>Página de Login</div>} />
        <Route path="/trocar-senha" element={<div>Trocar Senha</div>} />
        <Route path="/" element={ui} />
      </Routes>
    </MemoryRouter>
  );

describe('ProtectedRoute', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('exibe loader enquanto autenticação está carregando', () => {
    mockUseAuth.mockReturnValue({ session: null, loading: true, mustChangePassword: false });

    renderWithRouter(
      <ProtectedRoute>
        <div>Conteúdo protegido</div>
      </ProtectedRoute>
    );

    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument();
    // Loader é um SVG animado; verifica que o conteúdo não foi renderizado
  });

  it('redireciona para /login quando não há sessão', () => {
    mockUseAuth.mockReturnValue({ session: null, loading: false, mustChangePassword: false });

    renderWithRouter(
      <ProtectedRoute>
        <div>Conteúdo protegido</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Página de Login')).toBeInTheDocument();
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument();
  });

  it('redireciona para /trocar-senha quando mustChangePassword=true', () => {
    mockUseAuth.mockReturnValue({
      usuario: { id: '1' },
      loading: false,
      mustChangePassword: true,
    });

    renderWithRouter(
      <ProtectedRoute>
        <div>Conteúdo protegido</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Trocar Senha')).toBeInTheDocument();
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument();
  });

  it('renderiza filhos quando sessão é válida e senha não precisa ser trocada', () => {
    mockUseAuth.mockReturnValue({
      usuario: { id: '1' },
      loading: false,
      mustChangePassword: false,
    });

    renderWithRouter(
      <ProtectedRoute>
        <div>Conteúdo protegido</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument();
  });
});
