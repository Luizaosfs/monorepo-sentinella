import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do sonner antes de importar o módulo testado
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

import { toast } from 'sonner';
import { handleQuotaError } from './quotaErrorHandler';

const toastError = toast.error as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleQuotaError', () => {
  describe('erros de quota (ERRCODE P0001)', () => {
    it('reconhece P0001 e retorna true', () => {
      const err = Object.assign(new Error('quota_usuarios_excedida: limite=5 usado=5'), { code: 'P0001' });
      expect(handleQuotaError(err)).toBe(true);
    });

    it('exibe toast amigável para quota_usuarios', () => {
      const err = Object.assign(new Error('quota_usuarios_excedida: limite=5 usado=5'), { code: 'P0001' });
      handleQuotaError(err);
      expect(toastError).toHaveBeenCalledWith(
        'Limite de usuários atingido para este cliente.',
        expect.objectContaining({ duration: 6000 }),
      );
    });

    it('exibe toast para quota_levantamentos', () => {
      const err = Object.assign(new Error('quota_levantamentos_excedida: limite=100 usado=151'), { code: 'P0001' });
      handleQuotaError(err);
      expect(toastError).toHaveBeenCalledWith(
        'Limite de levantamentos do mês atingido (incluindo carência de 50%).',
        expect.anything(),
      );
    });

    it('exibe toast para quota_voos', () => {
      const err = Object.assign(new Error('quota_voos_excedida: limite=10 usado=10'), { code: 'P0001' });
      handleQuotaError(err);
      expect(toastError).toHaveBeenCalledWith('Limite de voos do mês atingido.', expect.anything());
    });

    it('exibe toast para quota_itens', () => {
      const err = Object.assign(new Error('quota_itens_excedida: limite=200 usado=200'), { code: 'P0001' });
      handleQuotaError(err);
      expect(toastError).toHaveBeenCalledWith('Limite de itens do mês atingido.', expect.anything());
    });

    it('exibe toast para quota_ia', () => {
      const err = Object.assign(new Error('quota_ia_excedida: limite=50 usado=50'), { code: 'P0001' });
      handleQuotaError(err);
      expect(toastError).toHaveBeenCalledWith('Limite de triagens IA do mês atingido.', expect.anything());
    });

    it('usa mensagem fallback para tipo de quota desconhecido', () => {
      // quota_xyz_excedida existe na mensagem mas não está no QUOTA_MESSAGES
      const err = Object.assign(new Error('quota_xyz_excedida: limite=1 usado=1'), { code: 'P0001' });
      handleQuotaError(err);
      expect(toastError).toHaveBeenCalledWith(
        'Limite do plano atingido. Contate o administrador da plataforma.',
        expect.anything(),
      );
    });
  });

  describe('detecção por conteúdo da mensagem (sem code P0001)', () => {
    it('detecta mensagem contendo "quota_" em lowercase', () => {
      expect(handleQuotaError(new Error('quota_usuarios_excedida: limite=5 usado=5'))).toBe(true);
    });

    it('string simples com "quota_" é detectada', () => {
      expect(handleQuotaError('quota_voos_excedida')).toBe(true);
    });
  });

  describe('erros que NÃO são de quota', () => {
    it('retorna false para erro genérico', () => {
      expect(handleQuotaError(new Error('connection timeout'))).toBe(false);
    });

    it('não chama toast.error para erro não-quota', () => {
      handleQuotaError(new Error('not found'));
      expect(toastError).toHaveBeenCalledTimes(0);
    });

    it('retorna false para null', () => {
      expect(handleQuotaError(null)).toBe(false);
    });

    it('retorna false para string vazia', () => {
      expect(handleQuotaError('')).toBe(false);
    });

    it('retorna false para erro de autenticação', () => {
      expect(handleQuotaError(new Error('JWT expired'))).toBe(false);
    });

    it('retorna false para código PGRST116 (not found no Supabase)', () => {
      expect(handleQuotaError({ code: 'PGRST116', message: 'Row not found' })).toBe(false);
    });
  });

  describe('casos de borda', () => {
    it('retorna true para objeto com code P0001 e mensagem de quota', () => {
      expect(handleQuotaError({ code: 'P0001', message: 'quota_levantamentos_excedida' })).toBe(true);
    });

    it('cada chamada exibe exatamente 1 toast', () => {
      handleQuotaError(Object.assign(new Error('quota_voos_excedida'), { code: 'P0001' }));
      expect(toastError).toHaveBeenCalledTimes(1);
    });
  });
});
