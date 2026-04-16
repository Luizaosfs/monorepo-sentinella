/**
 * Testes de normalizePapel (exportada de useAuth).
 * Cobre mapeamento de papéis canônicos e valores inválidos.
 *
 * Papéis canônicos (migration 20261015000000):
 *   admin, supervisor, agente, notificador, analista_regional
 *
 * Aliases removidos (migration 20270202000003+):
 *   operador  → null  (alias morto — dado migrado para agente no banco)
 *   moderador → null  (nunca existiu no enum)
 *   gestor    → null  (alias de UI, nunca existiu no enum)
 */

import { describe, it, expect } from 'vitest';
import { normalizePapel } from './useAuth';

describe('normalizePapel', () => {
  // ── Papéis canônicos ──────────────────────────────────────────────────────

  it('admin → "admin"', () => {
    expect(normalizePapel('admin')).toBe('admin');
  });

  it('supervisor → "supervisor"', () => {
    expect(normalizePapel('supervisor')).toBe('supervisor');
  });

  it('agente → "agente" (papel canônico)', () => {
    expect(normalizePapel('agente')).toBe('agente');
  });

  it('notificador → "notificador"', () => {
    expect(normalizePapel('notificador')).toBe('notificador');
  });

  // ── Aliases removidos → null (migration 20270202000003+) ─────────────────

  it('operador → null (alias removido — dados migrados para agente no banco)', () => {
    expect(normalizePapel('operador')).toBeNull();
  });

  it('moderador → null (nunca existiu no enum)', () => {
    expect(normalizePapel('moderador')).toBeNull();
  });

  // ── Case-insensitive ──────────────────────────────────────────────────────

  it('ADMIN → "admin"', () => {
    expect(normalizePapel('ADMIN')).toBe('admin');
  });

  it('Supervisor → "supervisor"', () => {
    expect(normalizePapel('Supervisor')).toBe('supervisor');
  });

  it('AGENTE → "agente"', () => {
    expect(normalizePapel('AGENTE')).toBe('agente');
  });

  it('OPERADOR → null (alias removido, case-insensitive)', () => {
    expect(normalizePapel('OPERADOR')).toBeNull();
  });

  it('MODERADOR → null (nunca existiu no enum)', () => {
    expect(normalizePapel('MODERADOR')).toBeNull();
  });

  it('NOTIFICADOR → "notificador"', () => {
    expect(normalizePapel('NOTIFICADOR')).toBe('notificador');
  });

  // ── Espaços ao redor ──────────────────────────────────────────────────────

  it('" admin " (com espaços) → "admin"', () => {
    expect(normalizePapel(' admin ')).toBe('admin');
  });

  it('" agente " (com espaços) → "agente"', () => {
    expect(normalizePapel(' agente ')).toBe('agente');
  });

  // ── Valores mortos/inválidos → null ───────────────────────────────────────

  it('platform_admin → null (valor morto)', () => {
    expect(normalizePapel('platform_admin')).toBeNull();
  });

  it('usuario → null (papel legado removido)', () => {
    expect(normalizePapel('usuario')).toBeNull();
  });

  it('gestor → null (alias de UI, não papel)', () => {
    expect(normalizePapel('gestor')).toBeNull();
  });

  it('string desconhecida → null', () => {
    expect(normalizePapel('xyz')).toBeNull();
  });

  it('string vazia → null', () => {
    expect(normalizePapel('')).toBeNull();
  });

  it('null → null', () => {
    expect(normalizePapel(null as unknown as string)).toBeNull();
  });

  it('undefined → null', () => {
    expect(normalizePapel(undefined as unknown as string)).toBeNull();
  });

  // ── P5: analista_regional ─────────────────────────────────────────────────

  it('analista_regional → "analista_regional"', () => {
    expect(normalizePapel('analista_regional')).toBe('analista_regional');
  });

  it('ANALISTA_REGIONAL → "analista_regional" (case-insensitive)', () => {
    expect(normalizePapel('ANALISTA_REGIONAL')).toBe('analista_regional');
  });

  it('analista_regional retorna não-null (tem acesso ao sistema)', () => {
    expect(normalizePapel('analista_regional')).not.toBeNull();
  });

  // ── Regressão: nenhum dos papéis canônicos retorna null ───────────────────

  it('todos os papéis canônicos retornam não-null', () => {
    const canonicos = ['admin', 'supervisor', 'agente', 'notificador', 'analista_regional'];
    for (const p of canonicos) {
      expect(normalizePapel(p)).not.toBeNull();
    }
  });

  it('operador (alias removido) retorna null — não concede acesso', () => {
    expect(normalizePapel('operador')).toBeNull();
  });

  // ── Regressão: papéis mortos nunca concedem acesso ────────────────────────

  it('platform_admin nunca concede acesso', () => {
    expect(normalizePapel('platform_admin')).toBeNull();
  });

  it('usuario nunca concede acesso', () => {
    expect(normalizePapel('usuario')).toBeNull();
  });

  it('cliente nunca concede acesso', () => {
    expect(normalizePapel('cliente')).toBeNull();
  });
});
