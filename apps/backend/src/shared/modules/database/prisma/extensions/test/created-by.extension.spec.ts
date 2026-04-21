import { ClsServiceManager } from 'nestjs-cls';
import { CLS_USER_ID_KEY } from 'src/shared/interceptors/user-context.interceptor';

import {
  __getCurrentUserIdForTest,
  __INSERT_AUTHOR_COLUMN_FOR_TEST,
  __UPDATE_AUTHOR_COLUMN_FOR_TEST,
} from '../created-by.extension';

describe('created-by.extension', () => {
  describe('INSERT_AUTHOR_COLUMN map', () => {
    it('deve mapear as 3 tabelas com created_by', () => {
      expect(__INSERT_AUTHOR_COLUMN_FOR_TEST.get('focos_risco')).toBe(
        'created_by',
      );
      expect(__INSERT_AUTHOR_COLUMN_FOR_TEST.get('casos_notificados')).toBe(
        'created_by',
      );
      expect(__INSERT_AUTHOR_COLUMN_FOR_TEST.get('vistorias')).toBe(
        'created_by',
      );
    });

    it('deve mapear as 2 tabelas-ledger com alterado_por', () => {
      expect(__INSERT_AUTHOR_COLUMN_FOR_TEST.get('foco_risco_historico')).toBe(
        'alterado_por',
      );
      expect(
        __INSERT_AUTHOR_COLUMN_FOR_TEST.get(
          'levantamento_item_status_historico',
        ),
      ).toBe('alterado_por');
    });

    it('deve ter exatamente 5 entradas (5 tabelas com autoria em INSERT)', () => {
      expect(__INSERT_AUTHOR_COLUMN_FOR_TEST.size).toBe(5);
    });

    it('NÃO deve mapear modelos fora do escopo LGPD de autoria', () => {
      expect(__INSERT_AUTHOR_COLUMN_FOR_TEST.has('usuarios')).toBe(false);
      expect(__INSERT_AUTHOR_COLUMN_FOR_TEST.has('clientes')).toBe(false);
      expect(__INSERT_AUTHOR_COLUMN_FOR_TEST.has('levantamento_itens')).toBe(
        false,
      );
    });
  });

  describe('UPDATE_AUTHOR_COLUMN map', () => {
    it('deve mapear apenas levantamento_itens → updated_by', () => {
      expect(__UPDATE_AUTHOR_COLUMN_FOR_TEST.size).toBe(1);
      expect(__UPDATE_AUTHOR_COLUMN_FOR_TEST.get('levantamento_itens')).toBe(
        'updated_by',
      );
    });
  });

  describe('getCurrentUserId (helper CLS)', () => {
    it('retorna null fora de contexto CLS (crons, seeds)', () => {
      // Sem ClsService ativo → função captura exceção e retorna null.
      expect(__getCurrentUserIdForTest()).toBeNull();
    });

    it('retorna o userId quando setado no CLS', async () => {
      const cls = ClsServiceManager.getClsService();
      await cls.runWith({}, async () => {
        cls.set(CLS_USER_ID_KEY, 'user-uuid-abc');
        expect(__getCurrentUserIdForTest()).toBe('user-uuid-abc');
      });
    });
  });
});
