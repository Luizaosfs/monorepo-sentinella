import { __MODELS_WITH_UPDATED_AT_FOR_TEST } from '../updated-at.extension';

describe('updated-at.extension', () => {
  describe('MODELS_WITH_UPDATED_AT', () => {
    it('deve ter exatamente 36 modelos', () => {
      expect(__MODELS_WITH_UPDATED_AT_FOR_TEST.size).toBe(36);
    });

    it('deve incluir modelos canônicos de domínio', () => {
      const canonical = [
        'focos_risco',
        'vistorias',
        'usuarios',
        'clientes',
        'sla_operacional',
      ];
      for (const m of canonical) {
        expect(__MODELS_WITH_UPDATED_AT_FOR_TEST.has(m)).toBe(true);
      }
    });

    it('deve usar snake_case (não PascalCase)', () => {
      for (const m of __MODELS_WITH_UPDATED_AT_FOR_TEST) {
        // nenhuma letra maiúscula
        expect(m).toMatch(/^[a-z_]+$/);
      }
    });

    it('NÃO deve incluir modelos sem coluna updated_at', () => {
      // amostra curada — estas tabelas existem mas NÃO têm updated_at
      const withoutUpdatedAt = [
        'foco_risco_historico',
        'audit_log',
        'canal_cidadao_rate_limit',
        'canal_cidadao_rate_log',
        'refresh_tokens',
        'push_subscriptions',
      ];
      for (const m of withoutUpdatedAt) {
        expect(__MODELS_WITH_UPDATED_AT_FOR_TEST.has(m)).toBe(false);
      }
    });
  });
});
