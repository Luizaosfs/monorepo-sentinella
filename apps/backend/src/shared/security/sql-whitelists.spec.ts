import { BadRequestException } from '@nestjs/common';
import {
  assertFocoStatus,
  assertPrioridade,
  assertOperacaoStatus,
  assertTipoVinculo,
  assertPrioridadeVistoria,
  FOCO_STATUS_PERMITIDOS,
} from './sql-whitelists';

describe('sql-whitelists', () => {
  // ─── assertFocoStatus ────────────────────────────────────────────────────────

  describe('assertFocoStatus', () => {
    it('aceita todos os status válidos individualmente', () => {
      for (const s of FOCO_STATUS_PERMITIDOS) {
        expect(() => assertFocoStatus([s])).not.toThrow();
      }
    });

    it('aceita array com múltiplos status válidos', () => {
      expect(() =>
        assertFocoStatus(['suspeita', 'em_triagem', 'aguardando_nova_tentativa']),
      ).not.toThrow();
    });

    it('aceita aguardando_nova_tentativa (status do fluxo de sem acesso)', () => {
      expect(() => assertFocoStatus(['aguardando_nova_tentativa'])).not.toThrow();
    });

    it('rejeita status inválido com BadRequestException', () => {
      expect(() => assertFocoStatus(['status_inexistente'])).toThrow(BadRequestException);
    });

    it('rejeita tentativa de SQL injection — DROP TABLE', () => {
      expect(() =>
        assertFocoStatus(["'; DROP TABLE focos_risco; --"]),
      ).toThrow(BadRequestException);
    });

    it('rejeita tentativa de SQL injection — OR 1=1', () => {
      expect(() => assertFocoStatus(["suspeita' OR '1'='1"])).toThrow(BadRequestException);
    });

    it('rejeita tentativa de SQL injection — DESC; DELETE', () => {
      expect(() => assertFocoStatus(['DESC; DELETE FROM focos_risco'])).toThrow(BadRequestException);
    });

    it('rejeita array misto com um status inválido', () => {
      expect(() => assertFocoStatus(['suspeita', 'status_invalido'])).toThrow(BadRequestException);
    });

    it('mensagem de erro inclui o valor inválido', () => {
      try {
        assertFocoStatus(['valor_malicioso']);
        fail('deveria ter lançado');
      } catch (e) {
        expect(e).toBeInstanceOf(BadRequestException);
        expect((e as BadRequestException).message).toContain('valor_malicioso');
      }
    });

    it('retorna array tipado quando válido', () => {
      const result = assertFocoStatus(['suspeita', 'em_triagem']);
      expect(result).toEqual(['suspeita', 'em_triagem']);
    });
  });

  // ─── assertPrioridade ────────────────────────────────────────────────────────

  describe('assertPrioridade', () => {
    it('aceita P1 a P5', () => {
      expect(() => assertPrioridade(['P1', 'P2', 'P3', 'P4', 'P5'])).not.toThrow();
    });

    it('rejeita prioridade fora do enum', () => {
      expect(() => assertPrioridade(['P6'])).toThrow(BadRequestException);
    });

    it('rejeita string vazia', () => {
      expect(() => assertPrioridade([''])).toThrow(BadRequestException);
    });

    it('rejeita tentativa de injection', () => {
      expect(() => assertPrioridade(["P1' OR '1'='1"])).toThrow(BadRequestException);
    });
  });

  // ─── assertOperacaoStatus ────────────────────────────────────────────────────

  describe('assertOperacaoStatus', () => {
    it('aceita pendente', () => expect(() => assertOperacaoStatus('pendente')).not.toThrow());
    it('aceita em_andamento', () => expect(() => assertOperacaoStatus('em_andamento')).not.toThrow());
    it('aceita concluido', () => expect(() => assertOperacaoStatus('concluido')).not.toThrow());
    it('aceita cancelado', () => expect(() => assertOperacaoStatus('cancelado')).not.toThrow());

    it('rejeita status inválido', () => {
      expect(() => assertOperacaoStatus('ativo')).toThrow(BadRequestException);
    });

    it('rejeita tentativa de injection', () => {
      expect(() =>
        assertOperacaoStatus("pendente'; DROP TABLE operacoes; --"),
      ).toThrow(BadRequestException);
    });
  });

  // ─── assertTipoVinculo ───────────────────────────────────────────────────────

  describe('assertTipoVinculo', () => {
    it('aceita operacional, levantamento, regiao', () => {
      for (const v of ['operacional', 'levantamento', 'regiao']) {
        expect(() => assertTipoVinculo(v)).not.toThrow();
      }
    });

    it('rejeita tipo inválido', () => {
      expect(() => assertTipoVinculo('foco')).toThrow(BadRequestException);
    });

    it('rejeita tentativa de injection', () => {
      expect(() => assertTipoVinculo("levantamento' OR '1'='1")).toThrow(BadRequestException);
    });
  });

  // ─── assertPrioridadeVistoria ────────────────────────────────────────────────

  describe('assertPrioridadeVistoria', () => {
    it('aceita P1 a P5', () => {
      expect(() => assertPrioridadeVistoria(['P1', 'P3', 'P5'])).not.toThrow();
    });

    it('rejeita valor fora do enum', () => {
      expect(() => assertPrioridadeVistoria(['P0'])).toThrow(BadRequestException);
    });

    it('rejeita injection no array de prioridades', () => {
      expect(() =>
        assertPrioridadeVistoria(["P1'; DELETE FROM vistorias; --"]),
      ).toThrow(BadRequestException);
    });
  });
});
