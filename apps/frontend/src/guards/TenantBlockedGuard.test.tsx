/**
 * Testes do TenantBlockedGuard
 *
 * Regra: bloqueia acesso quando tenantStatus.isBlocked === true.
 * - Admin da plataforma nunca é bloqueado (bypass por isAdmin).
 * - tenantStatus null (carregando) → deixa passar para evitar flash.
 * - 'inadimplente' → isInadimplente=true mas isBlocked=false → NÃO bloqueia.
 * - 'suspenso' / 'cancelado' → isBlocked=true → mostra tela de bloqueio.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TenantBlockedGuard } from './TenantBlockedGuard';

vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('@/hooks/useClienteAtivo', () => ({ useClienteAtivo: vi.fn() }));

import { useAuth } from '@/hooks/useAuth';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
const mockUseClienteAtivo = useClienteAtivo as ReturnType<typeof vi.fn>;

const buildTenantStatus = (overrides: object) => ({
  status: 'ativo',
  planoNome: null,
  isBlocked: false,
  isInadimplente: false,
  isTrialing: false,
  trialDaysLeft: null,
  ...overrides,
});

const renderGuard = () =>
  render(
    <TenantBlockedGuard>
      <div>Conteúdo</div>
    </TenantBlockedGuard>
  );

describe('TenantBlockedGuard', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── Admin sempre passa ────────────────────────────────────────────────────
  it('admin da plataforma sempre acessa, mesmo com isBlocked=true', () => {
    mockUseAuth.mockReturnValue({ isAdmin: true, signOut: vi.fn() });
    mockUseClienteAtivo.mockReturnValue({
      tenantStatus: buildTenantStatus({ isBlocked: true, status: 'suspenso' }),
    });
    renderGuard();
    expect(screen.getByText('Conteúdo')).toBeInTheDocument();
  });

  // ── tenantStatus null (carregando) ────────────────────────────────────────
  it('passa quando tenantStatus ainda é null (evita flash de bloqueio no boot)', () => {
    mockUseAuth.mockReturnValue({ isAdmin: false, signOut: vi.fn() });
    mockUseClienteAtivo.mockReturnValue({ tenantStatus: null });
    renderGuard();
    expect(screen.getByText('Conteúdo')).toBeInTheDocument();
  });

  // ── Tenant ativo ──────────────────────────────────────────────────────────
  it('renderiza conteúdo quando status é ativo', () => {
    mockUseAuth.mockReturnValue({ isAdmin: false, signOut: vi.fn() });
    mockUseClienteAtivo.mockReturnValue({
      tenantStatus: buildTenantStatus({ status: 'ativo', isBlocked: false }),
    });
    renderGuard();
    expect(screen.getByText('Conteúdo')).toBeInTheDocument();
  });

  it('renderiza conteúdo quando status é trial ativo', () => {
    mockUseAuth.mockReturnValue({ isAdmin: false, signOut: vi.fn() });
    mockUseClienteAtivo.mockReturnValue({
      tenantStatus: buildTenantStatus({ status: 'trial', isBlocked: false, isTrialing: true }),
    });
    renderGuard();
    expect(screen.getByText('Conteúdo')).toBeInTheDocument();
  });

  // ── Inadimplente NÃO bloqueia ─────────────────────────────────────────────
  it('inadimplente renderiza conteúdo (é aviso, não bloqueio)', () => {
    mockUseAuth.mockReturnValue({ isAdmin: false, signOut: vi.fn() });
    mockUseClienteAtivo.mockReturnValue({
      tenantStatus: buildTenantStatus({
        status: 'inadimplente',
        isBlocked: false,
        isInadimplente: true,
      }),
    });
    renderGuard();
    expect(screen.getByText('Conteúdo')).toBeInTheDocument();
  });

  // ── Bloqueados ────────────────────────────────────────────────────────────
  it('exibe tela de bloqueio quando status é suspenso', () => {
    mockUseAuth.mockReturnValue({ isAdmin: false, signOut: vi.fn() });
    mockUseClienteAtivo.mockReturnValue({
      tenantStatus: buildTenantStatus({ status: 'suspenso', isBlocked: true }),
    });
    renderGuard();
    expect(screen.queryByText('Conteúdo')).not.toBeInTheDocument();
    expect(screen.getByText(/conta suspensa/i)).toBeInTheDocument();
  });

  it('exibe tela de bloqueio quando status é cancelado', () => {
    mockUseAuth.mockReturnValue({ isAdmin: false, signOut: vi.fn() });
    mockUseClienteAtivo.mockReturnValue({
      tenantStatus: buildTenantStatus({ status: 'cancelado', isBlocked: true }),
    });
    renderGuard();
    expect(screen.queryByText('Conteúdo')).not.toBeInTheDocument();
    expect(screen.getByText(/conta cancelada/i)).toBeInTheDocument();
  });

  it('exibe tela de bloqueio quando trial expirou', () => {
    mockUseAuth.mockReturnValue({ isAdmin: false, signOut: vi.fn() });
    mockUseClienteAtivo.mockReturnValue({
      tenantStatus: buildTenantStatus({
        status: 'trial',
        isBlocked: true,
        isTrialing: false,
        trialDaysLeft: 0,
      }),
    });
    renderGuard();
    expect(screen.queryByText('Conteúdo')).not.toBeInTheDocument();
    expect(screen.getByText(/período de avaliação encerrado/i)).toBeInTheDocument();
  });

  it('exibe botão de sair na tela de bloqueio', () => {
    mockUseAuth.mockReturnValue({ isAdmin: false, signOut: vi.fn() });
    mockUseClienteAtivo.mockReturnValue({
      tenantStatus: buildTenantStatus({ status: 'suspenso', isBlocked: true }),
    });
    renderGuard();
    expect(screen.getByRole('button', { name: /sair/i })).toBeInTheDocument();
  });
});
