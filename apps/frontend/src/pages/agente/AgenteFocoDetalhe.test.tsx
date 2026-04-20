/**
 * AgenteFocoDetalhe — testes de CTAs por status
 *
 * Valida que cada status exibe exatamente os botões corretos
 * conforme o fluxo canônico do agente:
 *
 *   aguarda_inspecao → "Iniciar inspeção" only
 *   em_inspecao      → "Confirmar foco" + "Descartar foco"
 *   confirmado       → "Iniciar tratamento" only
 *   em_tratamento    → "Resolver foco" only
 *   terminal (null)  → "Foco não disponível" (sem CTAs operacionais)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { FocoRiscoAtivo } from '@/types/database';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/components/foco/FocoRiscoTimeline', () => ({
  FocoRiscoTimeline: () => <div data-testid="timeline" />,
}));

vi.mock('@/components/foco/StatusBadge', () => ({
  StatusBadge: ({ status }: { status: string }) => <span data-testid="status-badge">{status}</span>,
}));

vi.mock('@/components/foco/PrioridadeBadge', () => ({
  PrioridadeBadge: () => null,
}));

vi.mock('@/components/foco/SlaBadge', () => ({
  SlaBadge: () => null,
}));

const mockIniciarInspecao = vi.fn();
const mockAtualizarStatus = vi.fn();

vi.mock('@/hooks/queries/useFocosRisco', () => ({
  useIniciarInspecaoFoco: () => ({
    mutateAsync: mockIniciarInspecao,
    isPending: false,
  }),
  useAtualizarStatusFoco: () => ({
    mutateAsync: mockAtualizarStatus,
    isPending: false,
  }),
}));

vi.mock('@/services/api', () => ({
  api: {
    focosRisco: {
      getAtivoById: vi.fn(),
    },
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFoco(status: string): FocoRiscoAtivo {
  return {
    id: 'foco-test-id',
    status: status as FocoRiscoAtivo['status'],
    prioridade: 'P3',
    codigo_foco: '2026-00000001',
    logradouro: 'Rua das Flores',
    numero: '42',
    bairro: 'Centro',
    quarteirao: null,
    tipo_imovel: null,
    regiao_nome: null,
    sla_status: null,
    sla_prazo_em: null,
    endereco_normalizado: null,
    imovel_id: 'imovel-1',
    foco_risco_id: null,
    cliente_id: 'cliente-1',
    suspeita_em: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as FocoRiscoAtivo;
}

function renderPage(focoData: FocoRiscoAtivo | null) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  // Pre-populate the cache so the query resolves synchronously
  qc.setQueryData(['foco_risco_agente', 'foco-test-id'], focoData);

  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/agente/focos/foco-test-id']}>
        <Routes>
          <Route path="/agente/focos/:focoId" element={<AgenteFocoDetalhe />} />
          <Route path="/agente/hoje" element={<div>hoje</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// Lazy import after mocks are set up
let AgenteFocoDetalhe: React.ComponentType;

beforeEach(async () => {
  vi.clearAllMocks();
  const mod = await import('./AgenteFocoDetalhe');
  AgenteFocoDetalhe = mod.default;
});

// ── Testes de CTAs por status ─────────────────────────────────────────────────

describe('AgenteFocoDetalhe — CTAs por status', () => {
  it('aguarda_inspecao: exibe SOMENTE "Iniciar inspeção"', () => {
    renderPage(makeFoco('aguarda_inspecao'));

    expect(screen.getByRole('button', { name: /iniciar inspeção/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /descartar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirmar foco/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /iniciar tratamento/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /resolver foco/i })).not.toBeInTheDocument();
  });

  it('em_inspecao: exibe "Realizar vistoria completa" e "Descartar foco"', () => {
    renderPage(makeFoco('em_inspecao'));

    expect(screen.getByRole('button', { name: /realizar vistoria completa/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /descartar foco/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /iniciar inspeção/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /iniciar tratamento/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /resolver foco/i })).not.toBeInTheDocument();
  });

  it('confirmado: exibe SOMENTE "Iniciar tratamento"', () => {
    renderPage(makeFoco('confirmado'));

    expect(screen.getByRole('button', { name: /iniciar tratamento/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /descartar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /iniciar inspeção/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirmar foco/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /resolver foco/i })).not.toBeInTheDocument();
  });

  it('em_tratamento: exibe SOMENTE "Resolver foco"', () => {
    renderPage(makeFoco('em_tratamento'));

    expect(screen.getByRole('button', { name: /resolver foco/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /descartar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /iniciar inspeção/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirmar foco/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /iniciar tratamento/i })).not.toBeInTheDocument();
  });

  it('foco encerrado (null): exibe "Foco não disponível" sem CTAs operacionais', () => {
    renderPage(null);

    expect(screen.getByText(/foco não disponível/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /iniciar inspeção/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirmar foco/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /iniciar tratamento/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /resolver foco/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /descartar/i })).not.toBeInTheDocument();
  });
});

// ── codigo_foco ────────────────────────────────────────────────────────────────

describe('AgenteFocoDetalhe — codigo_foco', () => {
  it('exibe o codigo_foco no header quando disponível', () => {
    renderPage(makeFoco('aguarda_inspecao'));
    expect(screen.getByText('2026-00000001')).toBeInTheDocument();
  });

  it('não exibe linha de codigo quando null', () => {
    const foco = makeFoco('aguarda_inspecao');
    (foco as Record<string, unknown>).codigo_foco = null;
    renderPage(foco);
    expect(screen.queryByText(/2026-/)).not.toBeInTheDocument();
  });
});
