import { describe, it, expect } from 'vitest';
import { HOME_BY_PAPEL, getHomeByPapel } from './roleRedirect';

describe('HOME_BY_PAPEL', () => {
  it('mapeia admin para /admin/dashboard', () => {
    expect(HOME_BY_PAPEL.admin).toBe('/admin/dashboard');
  });

  it('mapeia supervisor para /gestor/central', () => {
    expect(HOME_BY_PAPEL.supervisor).toBe('/gestor/central');
  });

  it('mapeia operador para /agente/hoje', () => {
    expect(HOME_BY_PAPEL.operador).toBe('/agente/hoje');
  });

  it('mapeia notificador para /notificador/registrar', () => {
    expect(HOME_BY_PAPEL.notificador).toBe('/notificador/registrar');
  });

  it('mapeia analista_regional para /regional/dashboard', () => {
    expect(HOME_BY_PAPEL.analista_regional).toBe('/regional/dashboard');
  });

  it('cobre os 5 papéis canônicos do sistema', () => {
    const papeis = Object.keys(HOME_BY_PAPEL);
    expect(papeis).toContain('admin');
    expect(papeis).toContain('supervisor');
    expect(papeis).toContain('agente');
    expect(papeis).toContain('notificador');
    expect(papeis).toContain('analista_regional');
  });

  it('contém operador como alias legado de agente', () => {
    expect(HOME_BY_PAPEL.operador).toBe('/agente/hoje');
    expect(HOME_BY_PAPEL.operador).toBe(HOME_BY_PAPEL.agente);
  });

  it('não contém papel "usuario" (legado removido)', () => {
    expect(HOME_BY_PAPEL).not.toHaveProperty('usuario');
  });

  it('não contém papel "platform_admin" (dead value)', () => {
    expect(HOME_BY_PAPEL).not.toHaveProperty('platform_admin');
  });

  it('todos os destinos começam com /', () => {
    for (const rota of Object.values(HOME_BY_PAPEL)) {
      expect(rota).toMatch(/^\//);
    }
  });
});

describe('getHomeByPapel', () => {
  it('admin → /admin/dashboard', () => {
    expect(getHomeByPapel('admin')).toBe('/admin/dashboard');
  });

  it('supervisor → /gestor/central', () => {
    expect(getHomeByPapel('supervisor')).toBe('/gestor/central');
  });

  it('agente → /agente/hoje', () => {
    expect(getHomeByPapel('agente')).toBe('/agente/hoje');
  });

  it('operador → /agente/hoje (alias legado pré-migration)', () => {
    expect(getHomeByPapel('operador')).toBe('/agente/hoje');
  });

  it('notificador → /notificador/registrar', () => {
    expect(getHomeByPapel('notificador')).toBe('/notificador/registrar');
  });

  it('analista_regional → /regional/dashboard', () => {
    expect(getHomeByPapel('analista_regional')).toBe('/regional/dashboard');
  });

  it('papel desconhecido retorna /dashboard', () => {
    expect(getHomeByPapel('gestor')).toBe('/dashboard');
    expect(getHomeByPapel('moderador')).toBe('/dashboard');
    expect(getHomeByPapel('xyz')).toBe('/dashboard');
  });

  it('string vazia retorna /dashboard', () => {
    expect(getHomeByPapel('')).toBe('/dashboard');
  });

  it('null retorna /dashboard', () => {
    expect(getHomeByPapel(null)).toBe('/dashboard');
  });

  it('undefined retorna /dashboard', () => {
    expect(getHomeByPapel(undefined)).toBe('/dashboard');
  });

  it('resultado é sempre uma string não-vazia', () => {
    const casos = ['admin', 'supervisor', 'agente', 'operador', 'notificador', 'analista_regional', null, undefined, ''];
    for (const c of casos) {
      const result = getHomeByPapel(c as string | null | undefined);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }
  });
});
