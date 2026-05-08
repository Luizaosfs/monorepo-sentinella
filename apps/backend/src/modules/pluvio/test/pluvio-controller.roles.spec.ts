import 'reflect-metadata';
import { ROLES_KEY } from '@/decorators/roles.decorator';
import { PluvioController } from '../pluvio.controller';

/**
 * Valida que as rotas leitura do módulo pluvio não expõem dados municipais
 * para o papel 'admin' (SaaS) nem para papéis não operacionais.
 *
 * RolesGuard lê ROLES_KEY via Reflector — este teste verifica a mesma metadata
 * que o guard consumiria em runtime, sem precisar subir o servidor HTTP.
 */

function getRoles(methodName: keyof PluvioController): string[] {
  // NestJS SetMetadata usa descriptor.value (a função em si) como target de metadado
  const fn = PluvioController.prototype[methodName as string];
  return Reflect.getMetadata(ROLES_KEY, fn) ?? [];
}

describe('PluvioController — metadados de papéis', () => {
  describe('alertaTerritorial (GET /pluvio/alerta-territorial)', () => {
    const roles = getRoles('alertaTerritorial');

    it('permite supervisor', () => expect(roles).toContain('supervisor'));

    it('bloqueia admin (SaaS não acessa operação municipal)', () =>
      expect(roles).not.toContain('admin'));

    it('bloqueia agente (tela gerencial, não operacional de campo)', () =>
      expect(roles).not.toContain('agente'));

    it('bloqueia notificador', () =>
      expect(roles).not.toContain('notificador'));

    it('bloqueia analista_regional', () =>
      expect(roles).not.toContain('analista_regional'));

    it('contém exatamente ["supervisor"]', () =>
      expect(roles).toEqual(['supervisor']));
  });

  describe('stormForecast (GET /pluvio/storm-forecast)', () => {
    const roles = getRoles('stormForecast');

    it('permite supervisor', () => expect(roles).toContain('supervisor'));
    it('permite agente (previsão de campo)', () => expect(roles).toContain('agente'));

    it('bloqueia admin (SaaS não acessa dados municipais)', () =>
      expect(roles).not.toContain('admin'));

    it('bloqueia notificador', () =>
      expect(roles).not.toContain('notificador'));

    it('bloqueia analista_regional', () =>
      expect(roles).not.toContain('analista_regional'));
  });

  describe('riscoByCliente (GET /pluvio/risco/by-cliente)', () => {
    const roles = getRoles('riscoByCliente');

    it('permite supervisor', () => expect(roles).toContain('supervisor'));
    it('permite agente', () => expect(roles).toContain('agente'));

    it('bloqueia admin', () =>
      expect(roles).not.toContain('admin'));
  });
});
