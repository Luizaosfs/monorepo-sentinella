/**
 * Testes do AnalistaRegionalGuard
 *
 * Regra: /regional/* permite analista_regional e admin (para suporte).
 * Supervisor, agente e notificador são redirecionados para /dashboard.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AnalistaRegionalGuard } from './AnalistaRegionalGuard';

vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
import { useAuth } from '@/hooks/useAuth';
const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

const renderGuard = (initialPath = '/regional/dashboard') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route
          path="/regional/*"
          element={
            <AnalistaRegionalGuard>
              <div>Painel Regional</div>
            </AnalistaRegionalGuard>
          }
        />
      </Routes>
    </MemoryRouter>
  );

describe('AnalistaRegionalGuard', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Loading ───────────────────────────────────────────────────────────────
  it('não renderiza conteúdo enquanto auth carrega', () => {
    mockUseAuth.mockReturnValue({ isAnalistaRegional: false, isAdmin: false, loading: true });
    renderGuard();
    expect(screen.queryByText('Painel Regional')).not.toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  // ── Acesso permitido ──────────────────────────────────────────────────────
  it('renderiza conteúdo para analista_regional', () => {
    mockUseAuth.mockReturnValue({ isAnalistaRegional: true, isAdmin: false, loading: false });
    renderGuard();
    expect(screen.getByText('Painel Regional')).toBeInTheDocument();
  });

  it('renderiza conteúdo para admin (suporte/visualização)', () => {
    mockUseAuth.mockReturnValue({ isAnalistaRegional: false, isAdmin: true, loading: false });
    renderGuard();
    expect(screen.getByText('Painel Regional')).toBeInTheDocument();
  });

  // ── Acesso bloqueado ──────────────────────────────────────────────────────
  it('redireciona supervisor para /dashboard', () => {
    mockUseAuth.mockReturnValue({ isAnalistaRegional: false, isAdmin: false, loading: false });
    renderGuard();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Painel Regional')).not.toBeInTheDocument();
  });

  it('redireciona agente para /dashboard', () => {
    mockUseAuth.mockReturnValue({ isAnalistaRegional: false, isAdmin: false, loading: false });
    renderGuard();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('redireciona notificador para /dashboard', () => {
    mockUseAuth.mockReturnValue({ isAnalistaRegional: false, isAdmin: false, loading: false });
    renderGuard();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
