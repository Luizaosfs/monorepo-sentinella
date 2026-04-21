import {
  __SENSITIVE_FIELDS_FOR_TEST,
  AUDIT_CONFIG,
  pick,
  sanitize,
} from '../audit-log.config';
import { __TEST_ONLY } from '../audit-log.extension';

describe('audit-log.config', () => {
  describe('SENSITIVE_FIELDS', () => {
    it('blocklista senha_hash e api_key', () => {
      expect(__SENSITIVE_FIELDS_FOR_TEST.has('senha_hash')).toBe(true);
      expect(__SENSITIVE_FIELDS_FOR_TEST.has('api_key')).toBe(true);
    });

    it('NÃO blocklista api_key_masked (sufixo público visível)', () => {
      expect(__SENSITIVE_FIELDS_FOR_TEST.has('api_key_masked')).toBe(false);
    });

    it('NÃO blocklista campos comuns (nome, email, ativo)', () => {
      expect(__SENSITIVE_FIELDS_FOR_TEST.has('nome')).toBe(false);
      expect(__SENSITIVE_FIELDS_FOR_TEST.has('email')).toBe(false);
      expect(__SENSITIVE_FIELDS_FOR_TEST.has('ativo')).toBe(false);
    });
  });

  describe('AUDIT_CONFIG map', () => {
    it('tem exatamente 4 entradas (escopo fechado da Fase B.3)', () => {
      expect(AUDIT_CONFIG.size).toBe(4);
    });

    it('cobre papeis_usuarios, cliente_plano, cliente_integracoes, usuarios', () => {
      expect(AUDIT_CONFIG.has('papeis_usuarios')).toBe(true);
      expect(AUDIT_CONFIG.has('cliente_plano')).toBe(true);
      expect(AUDIT_CONFIG.has('cliente_integracoes')).toBe(true);
      expect(AUDIT_CONFIG.has('usuarios')).toBe(true);
    });

    it('NÃO inclui sla_config (escopo próprio com versionamento dedicado)', () => {
      expect(AUDIT_CONFIG.has('sla_config')).toBe(false);
    });

    it('NÃO inclui modelos fora de escopo (focos_risco, vistorias)', () => {
      expect(AUDIT_CONFIG.has('focos_risco')).toBe(false);
      expect(AUDIT_CONFIG.has('vistorias')).toBe(false);
    });

    it('cliente_integracoes NÃO projeta api_key em columns', () => {
      const cfg = AUDIT_CONFIG.get('cliente_integracoes');
      expect(cfg?.columns).not.toContain('api_key');
      expect(cfg?.columns).toContain('api_key_masked');
    });

    it('usuarios NÃO projeta senha_hash em columns', () => {
      const cfg = AUDIT_CONFIG.get('usuarios');
      expect(cfg?.columns).not.toContain('senha_hash');
    });

    it('todas as tabelas auditam INSERT/UPDATE/DELETE', () => {
      for (const cfg of AUDIT_CONFIG.values()) {
        expect(cfg.operations).toEqual(
          expect.arrayContaining(['INSERT', 'UPDATE', 'DELETE']),
        );
      }
    });
  });

  describe('sanitize()', () => {
    it('remove campos sensíveis mantendo o resto', () => {
      const input = {
        id: 'abc',
        nome: 'João',
        senha_hash: '$2b$10$...',
        api_key: 'secret-token',
        api_key_masked: '****abcd',
      };
      expect(sanitize(input)).toEqual({
        id: 'abc',
        nome: 'João',
        api_key_masked: '****abcd',
      });
    });

    it('retorna null para snapshot null/undefined', () => {
      expect(sanitize(null)).toBeNull();
      expect(sanitize(undefined)).toBeNull();
    });

    it('retorna objeto vazio se só havia campos sensíveis', () => {
      expect(sanitize({ senha_hash: 'x', api_key: 'y' })).toEqual({});
    });
  });

  describe('pick()', () => {
    it('projeta apenas colunas declaradas', () => {
      const src = { id: '1', nome: 'x', email: 'x@y', extra: 'drop' };
      expect(pick(src, ['id', 'nome'])).toEqual({ id: '1', nome: 'x' });
    });

    it('ignora colunas ausentes no source', () => {
      expect(pick({ id: '1' }, ['id', 'inexistente'])).toEqual({ id: '1' });
    });

    it('retorna null para source null', () => {
      expect(pick(null, ['id'])).toBeNull();
    });
  });

  describe('usuarios.shouldAudit (auditoria condicional)', () => {
    const cfg = AUDIT_CONFIG.get('usuarios');

    it('audita INSERT sempre', () => {
      expect(cfg?.shouldAudit?.(null, { id: '1' }, 'INSERT')).toBe(true);
    });

    it('audita DELETE sempre', () => {
      expect(cfg?.shouldAudit?.({ id: '1' }, null, 'DELETE')).toBe(true);
    });

    it('UPDATE: audita quando `ativo` muda', () => {
      const before = { id: '1', ativo: true };
      const after = { id: '1', ativo: false };
      expect(cfg?.shouldAudit?.(before, after, 'UPDATE')).toBe(true);
    });

    it('UPDATE: NÃO audita quando apenas nome/email mudam (ativo idêntico)', () => {
      const before = { id: '1', ativo: true, nome: 'A' };
      const after = { id: '1', ativo: true, nome: 'B' };
      expect(cfg?.shouldAudit?.(before, after, 'UPDATE')).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // PATCH (abr/2026): ações nomeadas + cliente_plano.shouldAudit
  // ═══════════════════════════════════════════════════════════════════════

  describe('papeis_usuarios.resolveAction', () => {
    const cfg = AUDIT_CONFIG.get('papeis_usuarios');

    it('INSERT → papel_atribuido', () => {
      expect(cfg?.resolveAction?.(null, { papel: 'agente' }, 'INSERT')).toBe(
        'papel_atribuido',
      );
    });

    it('UPDATE → papel_alterado', () => {
      expect(
        cfg?.resolveAction?.(
          { papel: 'agente' },
          { papel: 'supervisor' },
          'UPDATE',
        ),
      ).toBe('papel_alterado');
    });

    it('DELETE → papel_removido', () => {
      expect(cfg?.resolveAction?.({ papel: 'agente' }, null, 'DELETE')).toBe(
        'papel_removido',
      );
    });
  });

  describe('cliente_plano.shouldAudit', () => {
    const cfg = AUDIT_CONFIG.get('cliente_plano');

    it('INSERT/DELETE sempre auditam', () => {
      expect(cfg?.shouldAudit?.(null, { status: 'ativo' }, 'INSERT')).toBe(
        true,
      );
      expect(cfg?.shouldAudit?.({ status: 'ativo' }, null, 'DELETE')).toBe(
        true,
      );
    });

    it('UPDATE sem mudança em status/plano_id NÃO audita (ruído)', () => {
      const before = {
        status: 'ativo',
        plano_id: 'p1',
        contrato_ref: 'abc',
      };
      const after = {
        status: 'ativo',
        plano_id: 'p1',
        contrato_ref: 'xyz',
      };
      expect(cfg?.shouldAudit?.(before, after, 'UPDATE')).toBe(false);
    });

    it('UPDATE com mudança em status audita', () => {
      expect(
        cfg?.shouldAudit?.(
          { status: 'ativo', plano_id: 'p1' },
          { status: 'suspenso', plano_id: 'p1' },
          'UPDATE',
        ),
      ).toBe(true);
    });

    it('UPDATE com mudança em plano_id audita', () => {
      expect(
        cfg?.shouldAudit?.(
          { status: 'ativo', plano_id: 'p1' },
          { status: 'ativo', plano_id: 'p2' },
          'UPDATE',
        ),
      ).toBe(true);
    });
  });

  describe('cliente_plano.resolveAction', () => {
    const cfg = AUDIT_CONFIG.get('cliente_plano');

    it.each([
      ['suspenso', 'tenant_suspenso'],
      ['cancelado', 'tenant_cancelado'],
      ['inadimplente', 'tenant_inadimplente'],
      ['trial', 'tenant_trial_iniciado'],
      ['ativo', 'tenant_reativado'],
    ])('status mudou para %s → %s', (newStatus, expectedAction) => {
      expect(
        cfg?.resolveAction?.(
          { status: 'outro', plano_id: 'p1' },
          { status: newStatus, plano_id: 'p1' },
          'UPDATE',
        ),
      ).toBe(expectedAction);
    });

    it('status mudou para valor fora do mapa → plano_status_alterado', () => {
      expect(
        cfg?.resolveAction?.(
          { status: 'ativo', plano_id: 'p1' },
          { status: 'estado_novo_nao_mapeado', plano_id: 'p1' },
          'UPDATE',
        ),
      ).toBe('plano_status_alterado');
    });

    it('só plano_id mudou → plano_alterado', () => {
      expect(
        cfg?.resolveAction?.(
          { status: 'ativo', plano_id: 'p1' },
          { status: 'ativo', plano_id: 'p2' },
          'UPDATE',
        ),
      ).toBe('plano_alterado');
    });

    it('INSERT/DELETE → null (fallback para uppercase genérico)', () => {
      expect(
        cfg?.resolveAction?.(null, { status: 'ativo' }, 'INSERT'),
      ).toBeNull();
      expect(
        cfg?.resolveAction?.({ status: 'ativo' }, null, 'DELETE'),
      ).toBeNull();
    });
  });

  describe('cliente_integracoes.resolveAction', () => {
    const cfg = AUDIT_CONFIG.get('cliente_integracoes');

    it('INSERT → integracao_criada', () => {
      expect(cfg?.resolveAction?.(null, { tipo: 'esus' }, 'INSERT')).toBe(
        'integracao_criada',
      );
    });

    it('UPDATE → integracao_alterada', () => {
      expect(
        cfg?.resolveAction?.(
          { tipo: 'esus', ativo: false },
          { tipo: 'esus', ativo: true },
          'UPDATE',
        ),
      ).toBe('integracao_alterada');
    });

    it('DELETE → integracao_removida', () => {
      expect(cfg?.resolveAction?.({ tipo: 'esus' }, null, 'DELETE')).toBe(
        'integracao_removida',
      );
    });
  });

  describe('usuarios.resolveAction', () => {
    const cfg = AUDIT_CONFIG.get('usuarios');

    it('DELETE → usuario_removido', () => {
      expect(cfg?.resolveAction?.({ email: 'a@b.c' }, null, 'DELETE')).toBe(
        'usuario_removido',
      );
    });

    it('UPDATE ativo true→false → usuario_desativado', () => {
      expect(
        cfg?.resolveAction?.(
          { ativo: true, email: 'a@b.c' },
          { ativo: false, email: 'a@b.c' },
          'UPDATE',
        ),
      ).toBe('usuario_desativado');
    });

    it('UPDATE ativo false→true → usuario_reativado', () => {
      expect(
        cfg?.resolveAction?.(
          { ativo: false, email: 'a@b.c' },
          { ativo: true, email: 'a@b.c' },
          'UPDATE',
        ),
      ).toBe('usuario_reativado');
    });

    it('INSERT → null (legado não auditava, fallback)', () => {
      expect(
        cfg?.resolveAction?.(null, { ativo: true, email: 'a@b.c' }, 'INSERT'),
      ).toBeNull();
    });

    it('UPDATE sem mudança em ativo → null (fallback)', () => {
      // Caso raro: shouldAudit já filtra; aqui defendemos contra regressão.
      expect(
        cfg?.resolveAction?.(
          { ativo: true, email: 'a@b.c' },
          { ativo: true, email: 'novo@b.c' },
          'UPDATE',
        ),
      ).toBeNull();
    });
  });
});

describe('audit-log.extension helpers', () => {
  describe('toAuditOp', () => {
    it('mapeia create/createMany → INSERT', () => {
      expect(__TEST_ONLY.toAuditOp('create')).toBe('INSERT');
      expect(__TEST_ONLY.toAuditOp('createMany')).toBe('INSERT');
    });

    it('mapeia update/updateMany → UPDATE', () => {
      expect(__TEST_ONLY.toAuditOp('update')).toBe('UPDATE');
      expect(__TEST_ONLY.toAuditOp('updateMany')).toBe('UPDATE');
    });

    it('mapeia delete/deleteMany → DELETE', () => {
      expect(__TEST_ONLY.toAuditOp('delete')).toBe('DELETE');
      expect(__TEST_ONLY.toAuditOp('deleteMany')).toBe('DELETE');
    });

    it('retorna null para operações não-CRUD (findUnique, count, aggregate)', () => {
      expect(__TEST_ONLY.toAuditOp('findUnique')).toBeNull();
      expect(__TEST_ONLY.toAuditOp('count')).toBeNull();
      expect(__TEST_ONLY.toAuditOp('aggregate')).toBeNull();
    });
  });

  describe('extractSingleIdFromWhere', () => {
    it('extrai id string direto', () => {
      expect(__TEST_ONLY.extractSingleIdFromWhere({ id: 'abc-123' })).toBe(
        'abc-123',
      );
    });

    it('extrai id via operador equals', () => {
      expect(
        __TEST_ONLY.extractSingleIdFromWhere({ id: { equals: 'abc-123' } }),
      ).toBe('abc-123');
    });

    it('retorna null para where sem id (ex.: compound key)', () => {
      expect(
        __TEST_ONLY.extractSingleIdFromWhere({ cliente_id: 'x', tipo: 'y' }),
      ).toBeNull();
    });

    it('retorna null para operadores complexos (in, not)', () => {
      expect(
        __TEST_ONLY.extractSingleIdFromWhere({ id: { in: ['a', 'b'] } }),
      ).toBeNull();
    });

    it('retorna null para where não-objeto', () => {
      expect(__TEST_ONLY.extractSingleIdFromWhere(null)).toBeNull();
      expect(__TEST_ONLY.extractSingleIdFromWhere(undefined)).toBeNull();
    });
  });

  describe('WATCHED_OPS', () => {
    it('inclui 7 operações de mutação', () => {
      expect(__TEST_ONLY.WATCHED_OPS.size).toBe(7);
    });

    it('NÃO inclui operações de leitura', () => {
      expect(__TEST_ONLY.WATCHED_OPS.has('findUnique')).toBe(false);
      expect(__TEST_ONLY.WATCHED_OPS.has('findMany')).toBe(false);
      expect(__TEST_ONLY.WATCHED_OPS.has('count')).toBe(false);
    });

    it('inclui upsert (tratado com detecção de INSERT vs UPDATE)', () => {
      expect(__TEST_ONLY.WATCHED_OPS.has('upsert')).toBe(true);
    });
  });
});
