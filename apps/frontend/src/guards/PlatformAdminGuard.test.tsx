/**
 * Testes do PlatformAdminGuard
 *
 * Regra: /admin/* é exclusivo do administrador da plataforma (cross-tenant).
 * Supervisor (gestor municipal) é redirecionado para /gestor/central.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PlatformAdminGuard } from './PlatformAdminGuard';

vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
import { useAuth } from '@/hooks/useAuth';
const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

const renderGuard = (initialPath = '/admin/dashboard') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/gestor/central" element={<div>Central do Dia</div>} />
        <Route
          path="/admin/*"
          element={
            <PlatformAdminGuard>
              <div>Painel Admin</div>
            </PlatformAdminGuard>
          }
        />
      </Routes>
    </MemoryRouter>
  );

describe('PlatformAdminGuard', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Loading ───────────────────────────────────────────────────────────────
  it('não renderiza conteúdo enquanto auth carrega', () => {
    mockUseAuth.mockReturnValue({ isAdmin: false, loading: true });
    renderGuard();
    expect(screen.queryByText('Painel Admin')).not.toBeInTheDocument();
    expect(screen.queryByText('Central do Dia')).not.toBeInTheDocument();
  });

  // ── Acesso permitido ──────────────────────────────────────────────────────
  it('renderiza conteúdo para admin da plataforma', () => {
    mockUseAuth.mockReturnValue({ isAdmin: true, loading: false });
    renderGuard();
    expect(screen.getByText('Painel Admin')).toBeInTheDocument();
  });

  // ── Acesso bloqueado ──────────────────────────────────────────────────────
  it('redireciona supervisor para /gestor/central', () => {
    mockUseAuth.mockReturnValue({ isAdmin: false, loading: false });
    renderGuard();
    expect(screen.getByText('Central do Dia')).toBeInTheDocument();
    expect(screen.queryByText('Painel Admin')).not.toBeInTheDocument();
  });

  it('redireciona agente para /gestor/central', () => {
    mockUseAuth.mockReturnValue({ isAdmin: false, loading: false });
    renderGuard();
    expect(screen.getByText('Central do Dia')).toBeInTheDocument();
  });

  it('redireciona notificador para /gestor/central', () => {
    mockUseAuth.mockReturnValue({ isAdmin: false, loading: false });
    renderGuard();
    expect(screen.getByText('Central do Dia')).toBeInTheDocument();
  });

  it('redireciona analista_regional para /gestor/central', () => {
    mockUseAuth.mockReturnValue({ isAdmin: false, loading: false });
    renderGuard();
    expect(screen.getByText('Central do Dia')).toBeInTheDocument();
  });
});
