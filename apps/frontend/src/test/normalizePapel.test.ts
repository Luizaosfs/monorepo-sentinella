import { describe, it, expect } from 'vitest';
import { normalizePapel } from '@/hooks/useAuth';

describe('normalizePapel', () => {
  describe('papel admin', () => {
    it('reconhece "admin"', () => expect(normalizePapel('admin')).toBe('admin'));
    it('é case-insensitive', () => expect(normalizePapel('ADMIN')).toBe('admin'));
    it('ignora espaços', () => expect(normalizePapel('  admin  ')).toBe('admin'));
  });

  describe('papel supervisor', () => {
    it('reconhece "supervisor"', () => expect(normalizePapel('supervisor')).toBe('supervisor'));
    it('é case-insensitive', () => expect(normalizePapel('SUPERVISOR')).toBe('supervisor'));
    it('"moderador" → null (nunca existiu no enum)', () => expect(normalizePapel('moderador')).toBeNull());
  });

  describe('papel agente (canônico)', () => {
    it('reconhece "agente"', () => expect(normalizePapel('agente')).toBe('agente'));
    it('é case-insensitive', () => expect(normalizePapel('AGENTE')).toBe('agente'));
    it('ignora espaços', () => expect(normalizePapel('  agente  ')).toBe('agente'));
  });

  describe('operador → null (alias removido em 20270202000003+)', () => {
    it('"operador" retorna null — alias morto, dados migrados para agente no banco', () => expect(normalizePapel('operador')).toBeNull());
    it('case-insensitive: "OPERADOR" também retorna null', () => expect(normalizePapel('OPERADOR')).toBeNull());
  });

  describe('papel notificador', () => {
    it('reconhece "notificador"', () => expect(normalizePapel('notificador')).toBe('notificador'));
    it('é case-insensitive', () => expect(normalizePapel('NOTIFICADOR')).toBe('notificador'));
  });

  describe('valores mortos/inválidos → null (sem acesso)', () => {
    it('retorna null para string vazia', () => expect(normalizePapel('')).toBeNull());
    it('retorna null para role desconhecida', () => expect(normalizePapel('gestor')).toBeNull());
    it('retorna null para "usuario" (papel morto)', () => expect(normalizePapel('usuario')).toBeNull());
    it('retorna null para "cliente" (papel morto)', () => expect(normalizePapel('cliente')).toBeNull());
    it('retorna null para "platform_admin" (papel morto)', () => expect(normalizePapel('platform_admin')).toBeNull());
  });

  describe('regressão: papéis mortos nunca concedem acesso', () => {
    const mortos = ['platform_admin', 'usuario', 'cliente'];
    for (const p of mortos) {
      it(`"${p}" retorna null`, () => expect(normalizePapel(p)).toBeNull());
    }
  });
});
