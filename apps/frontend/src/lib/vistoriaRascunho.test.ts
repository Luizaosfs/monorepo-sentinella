import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatarTempoRascunho, salvarRascunhoEmergencia } from './vistoriaRascunho';
import type { VistoriaRascunho } from './vistoriaRascunho';

// ── formatarTempoRascunho ─────────────────────────────────────────────────────

describe('formatarTempoRascunho', () => {
  it('retorna "há poucos segundos" para diff menor que 1 minuto', () => {
    const savedAt = new Date(Date.now() - 30_000).toISOString(); // 30s atrás
    expect(formatarTempoRascunho(savedAt)).toBe('há poucos segundos');
  });

  it('retorna "há poucos segundos" para diff de exatamente 0ms', () => {
    const savedAt = new Date(Date.now()).toISOString();
    expect(formatarTempoRascunho(savedAt)).toBe('há poucos segundos');
  });

  it('retorna "há 1 min" para diff de exatamente 1 minuto', () => {
    const savedAt = new Date(Date.now() - 60_000).toISOString();
    expect(formatarTempoRascunho(savedAt)).toBe('há 1 min');
  });

  it('retorna "há 5 min" para diff de 5 minutos', () => {
    const savedAt = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatarTempoRascunho(savedAt)).toBe('há 5 min');
  });

  it('retorna "há 59 min" para diff de 59 minutos', () => {
    const savedAt = new Date(Date.now() - 59 * 60_000).toISOString();
    expect(formatarTempoRascunho(savedAt)).toBe('há 59 min');
  });

  it('retorna "há 1h" para diff de exatamente 1 hora', () => {
    const savedAt = new Date(Date.now() - 60 * 60_000).toISOString();
    expect(formatarTempoRascunho(savedAt)).toBe('há 1h');
  });

  it('retorna "há 3h" para diff de 3 horas', () => {
    const savedAt = new Date(Date.now() - 3 * 60 * 60_000).toISOString();
    expect(formatarTempoRascunho(savedAt)).toBe('há 3h');
  });

  it('retorna "há 23h" para diff de 23 horas', () => {
    const savedAt = new Date(Date.now() - 23 * 60 * 60_000).toISOString();
    expect(formatarTempoRascunho(savedAt)).toBe('há 23h');
  });

  it('retorna "há 1 dia(s)" para diff de exatamente 24 horas', () => {
    const savedAt = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    expect(formatarTempoRascunho(savedAt)).toBe('há 1 dia(s)');
  });

  it('retorna "há 2 dia(s)" para diff de 48 horas', () => {
    const savedAt = new Date(Date.now() - 48 * 60 * 60_000).toISOString();
    expect(formatarTempoRascunho(savedAt)).toBe('há 2 dia(s)');
  });

  it('retorna "há 7 dia(s)" para diff de 7 dias', () => {
    const savedAt = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
    expect(formatarTempoRascunho(savedAt)).toBe('há 7 dia(s)');
  });
});

// ── salvarRascunhoEmergencia ──────────────────────────────────────────────────

describe('salvarRascunhoEmergencia', () => {
  const mockLocalStorage = (() => {
    const store: Record<string, string> = {};
    return {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
      removeItem: vi.fn((key: string) => { delete store[key]; }),
      clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
    };
  })();

  beforeEach(() => {
    vi.stubGlobal('localStorage', mockLocalStorage);
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function makeRascunho(overrides: Partial<VistoriaRascunho> = {}): VistoriaRascunho {
    return {
      imovelId: 'imovel-1',
      agenteId: 'agente-1',
      clienteId: 'cliente-1',
      atividade: 'tratamento',
      etapa: 2,
      status: 'em_andamento',
      etapaPre: {} as never,
      etapa1: {} as never,
      etapa2: {} as never,
      etapa3: {} as never,
      etapa4: {} as never,
      etapa5: {} as never,
      savedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  it('persiste rascunho no localStorage com chave correta', () => {
    const rascunho = makeRascunho();
    salvarRascunhoEmergencia(rascunho);
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'vistoria_rascunho_imovel-1_agente-1',
      expect.any(String),
    );
  });

  it('serializa o rascunho como JSON válido', () => {
    const rascunho = makeRascunho({ etapa: 3 });
    salvarRascunhoEmergencia(rascunho);
    const raw = mockLocalStorage.setItem.mock.calls[0][1] as string;
    const parsed = JSON.parse(raw) as VistoriaRascunho;
    expect(parsed.imovelId).toBe('imovel-1');
    expect(parsed.agenteId).toBe('agente-1');
    expect(parsed.etapa).toBe(3);
  });

  it('usa chave derivada de imovelId e agenteId diferentes', () => {
    const rascunho = makeRascunho({ imovelId: 'imovel-X', agenteId: 'agente-Y' });
    salvarRascunhoEmergencia(rascunho);
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'vistoria_rascunho_imovel-X_agente-Y',
      expect.any(String),
    );
  });

  it('não lança quando localStorage não está disponível', () => {
    vi.stubGlobal('localStorage', {
      setItem: vi.fn(() => { throw new Error('QuotaExceededError'); }),
    });
    expect(() => salvarRascunhoEmergencia(makeRascunho())).not.toThrow();
  });

  it('preserva o campo savedAt no payload serializado', () => {
    const savedAt = '2026-04-10T10:00:00.000Z';
    const rascunho = makeRascunho({ savedAt });
    salvarRascunhoEmergencia(rascunho);
    const raw = mockLocalStorage.setItem.mock.calls[0][1] as string;
    expect(JSON.parse(raw).savedAt).toBe(savedAt);
  });
});
