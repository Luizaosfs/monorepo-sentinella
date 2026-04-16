import { describe, it, expect } from 'vitest';
import { validateSenhaForte } from './senhaValidacao';

describe('validateSenhaForte', () => {
  // ── Rejeições ─────────────────────────────────────────────────────────────

  it('rejeita string vazia', () => {
    expect(validateSenhaForte('').valid).toBe(false);
  });

  it('rejeita null/undefined como string vazia', () => {
    expect(validateSenhaForte(null as unknown as string).valid).toBe(false);
    expect(validateSenhaForte(undefined as unknown as string).valid).toBe(false);
  });

  it('rejeita senha com menos de 8 caracteres', () => {
    expect(validateSenhaForte('Ab1!').valid).toBe(false);
    expect(validateSenhaForte('Ab1!').error).toMatch(/8/);
  });

  it('rejeita senha sem letra maiúscula', () => {
    expect(validateSenhaForte('abc123!@#').valid).toBe(false);
    expect(validateSenhaForte('abc123!@#').error).toMatch(/maiúscula/);
  });

  it('rejeita senha sem número', () => {
    expect(validateSenhaForte('Abcdef!@#').valid).toBe(false);
    expect(validateSenhaForte('Abcdef!@#').error).toMatch(/número/);
  });

  it('rejeita senha sem caractere especial', () => {
    expect(validateSenhaForte('Abcdef123').valid).toBe(false);
    expect(validateSenhaForte('Abcdef123').error).toMatch(/especial/);
  });

  // ── Aprovações ────────────────────────────────────────────────────────────

  it('aprova senha que satisfaz todos os critérios', () => {
    const r = validateSenhaForte('Senha@123');
    expect(r.valid).toBe(true);
    expect(r.error).toBeNull();
  });

  it('aprova senha longa com todos os critérios', () => {
    expect(validateSenhaForte('Prefeitura@2027!').valid).toBe(true);
  });

  // ── Mensagens de erro ─────────────────────────────────────────────────────

  it('retorna mensagem de erro como string não-nula em caso de falha', () => {
    const r = validateSenhaForte('fraca');
    expect(typeof r.error).toBe('string');
    expect(r.error!.length).toBeGreaterThan(0);
  });

  // ── Cobertura de onboarding (P6) ──────────────────────────────────────────

  it('supervisor com senha fraca é rejeitado', () => {
    expect(validateSenhaForte('supervisor').valid).toBe(false);
  });

  it('supervisor com senha forte é aceito (payload válido)', () => {
    expect(validateSenhaForte('Supervisor@2027').valid).toBe(true);
  });

  it('papel supervisor requer mesma força de senha que outros papéis', () => {
    // A regra é uniforme — não existe exceção por papel
    const casos = ['Agente@123', 'Admin@123!', 'Supervisor@Abc1!'];
    for (const c of casos) {
      expect(validateSenhaForte(c).valid).toBe(true);
    }
  });
});
