/**
 * Testes do NotificadorGuard
 *
 * Regra: /notificador/* é exclusivo de notificador.
 * Admin e supervisor têm fluxo próprio em /admin/casos — não acessam aqui.
 * Todos os outros papéis são redirecionados para /dashboard.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { NotificadorGuard } from './NotificadorGuard';

vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
import { useAuth } from '@/hooks/useAuth';
const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

const renderGuard = (initialPath = '/notificador/registrar') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route
          path="/notificador/*"
          element={
            <NotificadorGuard>
              <div>Área Notificador</div>
            </NotificadorGuard>
          }
        />
      </Routes>
    </MemoryRouter>
  );

describe('NotificadorGuard', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Loading ───────────────────────────────────────────────────────────────
  it('não renderiza conteúdo enquanto auth carrega', () => {
    mockUseAuth.mockReturnValue({ isNotificador: false, loading: true });
    renderGuard();
    expect(screen.queryByText('Área Notificador')).not.toBeInTheDocument();
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  // ── Acesso permitido ──────────────────────────────────────────────────────
  it('renderiza conteúdo para notificador', () => {
    mockUseAuth.mockReturnValue({ isNotificador: true, loading: false });
    renderGuard();
    expect(screen.getByText('Área Notificador')).toBeInTheDocument();
  });

  // ── Acesso bloqueado ──────────────────────────────────────────────────────
  it('redireciona admin para /dashboard (admin usa /admin/casos)', () => {
    mockUseAuth.mockReturnValue({ isNotificador: false, loading: false });
    renderGuard();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Área Notificador')).not.toBeInTheDocument();
  });

  it('redireciona supervisor para /dashboard', () => {
    mockUseAuth.mockReturnValue({ isNotificador: false, loading: false });
    renderGuard();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('redireciona agente para /dashboard', () => {
    mockUseAuth.mockReturnValue({ isNotificador: false, loading: false });
    renderGuard();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('redireciona analista_regional para /dashboard', () => {
    mockUseAuth.mockReturnValue({ isNotificador: false, loading: false });
    renderGuard();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
