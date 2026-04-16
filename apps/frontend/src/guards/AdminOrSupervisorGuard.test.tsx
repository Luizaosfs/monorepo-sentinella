/**
 * Testes do AdminOrSupervisorGuard
 *
 * Regra: rotas protegidas (ex: /operador/usuarios) permitem admin e supervisor.
 * Agentes, notificadores, analistas_regionais são redirecionados para /.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AdminOrSupervisorGuard } from './AdminOrSupervisorGuard';

vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
import { useAuth } from '@/hooks/useAuth';
const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

const renderGuard = (initialPath = '/operador/usuarios') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<div>Home</div>} />
        <Route
          path="/operador/*"
          element={
            <AdminOrSupervisorGuard>
              <div>Área Restrita</div>
            </AdminOrSupervisorGuard>
          }
        />
      </Routes>
    </MemoryRouter>
  );

describe('AdminOrSupervisorGuard', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Loading ───────────────────────────────────────────────────────────────
  it('não renderiza conteúdo enquanto auth carrega', () => {
    mockUseAuth.mockReturnValue({ isAdminOrSupervisor: false, loading: true });
    renderGuard();
    expect(screen.queryByText('Área Restrita')).not.toBeInTheDocument();
    expect(screen.queryByText('Home')).not.toBeInTheDocument();
  });

  // ── Acesso permitido ──────────────────────────────────────────────────────
  it('renderiza conteúdo para admin', () => {
    mockUseAuth.mockReturnValue({ isAdminOrSupervisor: true, loading: false });
    renderGuard();
    expect(screen.getByText('Área Restrita')).toBeInTheDocument();
  });

  it('renderiza conteúdo para supervisor', () => {
    mockUseAuth.mockReturnValue({ isAdminOrSupervisor: true, loading: false });
    renderGuard();
    expect(screen.getByText('Área Restrita')).toBeInTheDocument();
  });

  // ── Acesso bloqueado ──────────────────────────────────────────────────────
  it('redireciona agente para /', () => {
    mockUseAuth.mockReturnValue({ isAdminOrSupervisor: false, loading: false });
    renderGuard();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.queryByText('Área Restrita')).not.toBeInTheDocument();
  });

  it('redireciona notificador para /', () => {
    mockUseAuth.mockReturnValue({ isAdminOrSupervisor: false, loading: false });
    renderGuard();
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('redireciona analista_regional para /', () => {
    mockUseAuth.mockReturnValue({ isAdminOrSupervisor: false, loading: false });
    renderGuard();
    expect(screen.getByText('Home')).toBeInTheDocument();
  });
});
