/**
 * Testes do SupervisorOnlyGuard
 *
 * Regra: rotas /gestor/* são exclusivas de supervisor.
 * Admin da plataforma NÃO acessa operação municipal (separação de domínios).
 * Agentes, notificadores e analistas_regionais também bloqueados.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SupervisorOnlyGuard } from './SupervisorOnlyGuard';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '@/hooks/useAuth';
const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

const renderGuard = (initialPath = '/gestor/central') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route
          path="/gestor/*"
          element={
            <SupervisorOnlyGuard>
              <div>Operação Municipal</div>
            </SupervisorOnlyGuard>
          }
        />
      </Routes>
    </MemoryRouter>
  );

describe('SupervisorOnlyGuard', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Loading ───────────────────────────────────────────────────────────────

  it('não renderiza conteúdo enquanto auth carrega', () => {
    mockUseAuth.mockReturnValue({ isSupervisor: false, loading: true });
    renderGuard();
    expect(screen.queryByText('Operação Municipal')).not.toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  // ── Acesso permitido ──────────────────────────────────────────────────────

  it('renderiza conteúdo para supervisor', () => {
    mockUseAuth.mockReturnValue({ isSupervisor: true, loading: false });
    renderGuard();
    expect(screen.getByText('Operação Municipal')).toBeInTheDocument();
  });

  // ── Acesso bloqueado ──────────────────────────────────────────────────────

  it('redireciona admin para /dashboard (admin não opera fluxo municipal)', () => {
    // admin tem isSupervisor=false — separação de domínios de acesso
    mockUseAuth.mockReturnValue({ isSupervisor: false, loading: false });
    renderGuard();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Operação Municipal')).not.toBeInTheDocument();
  });

  it('redireciona agente para /dashboard', () => {
    mockUseAuth.mockReturnValue({ isSupervisor: false, loading: false });
    renderGuard();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('redireciona notificador para /dashboard', () => {
    mockUseAuth.mockReturnValue({ isSupervisor: false, loading: false });
    renderGuard();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('redireciona analista_regional para /dashboard', () => {
    mockUseAuth.mockReturnValue({ isSupervisor: false, loading: false });
    renderGuard();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('redireciona usuário sem papel (null) para /dashboard', () => {
    mockUseAuth.mockReturnValue({ isSupervisor: false, loading: false });
    renderGuard();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  // ── Regressão: admin nunca deve acessar rotas municipais ──────────────────

  it('isSupervisor=false sempre bloqueia — independente de outros flags', () => {
    mockUseAuth.mockReturnValue({ isSupervisor: false, loading: false });
    renderGuard('/gestor/focos');
    expect(screen.queryByText('Operação Municipal')).not.toBeInTheDocument();
  });
});
