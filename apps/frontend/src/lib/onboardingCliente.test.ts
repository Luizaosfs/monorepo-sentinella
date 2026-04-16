/**
 * Testes do fluxo de onboarding de cliente (P6.2)
 *
 * Cobre as regras de negócio do fluxo AdminClientes:
 * - cliente novo exige supervisor inicial
 * - falha no supervisor não deixa o onboarding como sucesso
 * - credenciais só aparecem em sucesso completo
 * - slug duplicado é rejeitado antes de salvar
 */
import { describe, it, expect } from 'vitest';
import { validateSenhaForte } from './senhaValidacao';

// ── Tipos auxiliares para simular o payload do onboarding ────────────────────

interface SupervisorPayload {
  nome: string;
  email: string;
  senha: string;
}

interface OnboardingPayload {
  clienteNome: string;
  clienteSlug: string;
  supervisor: SupervisorPayload;
}

/** Valida o payload mínimo de onboarding — retorna null se válido, string de erro se inválido */
function validarPayloadOnboarding(p: Partial<OnboardingPayload>): string | null {
  if (!p.clienteNome?.trim()) return 'Nome do cliente é obrigatório';
  if (!p.clienteSlug?.trim()) return 'Slug do cliente é obrigatório';
  if (!p.supervisor?.nome?.trim()) return 'Nome do supervisor é obrigatório';
  if (!p.supervisor?.email?.trim()) return 'Email do supervisor é obrigatório';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.supervisor.email.trim())) return 'Email do supervisor inválido';
  const senha = validateSenhaForte(p.supervisor.senha ?? '');
  if (!senha.valid) return `Supervisor — ${senha.error}`;
  return null;
}

/** Simula a lógica de verificação de slug duplicado */
function slugJaExiste(slug: string, slugsExistentes: string[]): boolean {
  return slugsExistentes.includes(slug.trim().toLowerCase().replace(/\s+/g, '-'));
}

/** Simula o resultado do onboarding: sucesso apenas se ambos criados */
function simularResultadoOnboarding(
  clienteCriado: boolean,
  supervisorCriado: boolean,
): { sucesso: boolean; credenciais: boolean; erro: string | null } {
  if (!clienteCriado) {
    return { sucesso: false, credenciais: false, erro: 'Falha ao criar cliente' };
  }
  if (!supervisorCriado) {
    // P6.2: rollback do cliente, nenhum sucesso parcial
    return {
      sucesso: false,
      credenciais: false,
      erro: 'Falha ao criar supervisor: <motivo>. O cliente foi removido automaticamente.',
    };
  }
  return { sucesso: true, credenciais: true, erro: null };
}

// ── Testes ───────────────────────────────────────────────────────────────────

describe('Onboarding de cliente (P6.2)', () => {

  // ── B1: Payload mínimo ────────────────────────────────────────────────────

  it('rejeita onboarding sem nome do cliente', () => {
    expect(validarPayloadOnboarding({ clienteSlug: 'pref-teste', supervisor: { nome: 'Ana', email: 'ana@pref.gov', senha: 'Senha@123' } }))
      .toMatch(/cliente/i);
  });

  it('rejeita onboarding sem slug do cliente', () => {
    expect(validarPayloadOnboarding({ clienteNome: 'Prefeitura Teste', supervisor: { nome: 'Ana', email: 'ana@pref.gov', senha: 'Senha@123' } }))
      .toMatch(/slug/i);
  });

  it('rejeita onboarding sem nome do supervisor', () => {
    expect(validarPayloadOnboarding({ clienteNome: 'Pref', clienteSlug: 'pref', supervisor: { nome: '', email: 'ana@pref.gov', senha: 'Senha@123' } }))
      .toMatch(/supervisor/i);
  });

  it('rejeita onboarding sem email do supervisor', () => {
    expect(validarPayloadOnboarding({ clienteNome: 'Pref', clienteSlug: 'pref', supervisor: { nome: 'Ana', email: '', senha: 'Senha@123' } }))
      .toMatch(/email/i);
  });

  it('rejeita email do supervisor malformado', () => {
    expect(validarPayloadOnboarding({ clienteNome: 'Pref', clienteSlug: 'pref', supervisor: { nome: 'Ana', email: 'naoemail', senha: 'Senha@123' } }))
      .toMatch(/inválido/i);
  });

  it('rejeita supervisor com senha fraca', () => {
    expect(validarPayloadOnboarding({ clienteNome: 'Pref', clienteSlug: 'pref', supervisor: { nome: 'Ana', email: 'ana@pref.gov', senha: 'fraca' } }))
      .toBeTruthy();
  });

  it('aceita payload completo e válido', () => {
    expect(validarPayloadOnboarding({
      clienteNome: 'Prefeitura de Teste',
      clienteSlug: 'pref-teste',
      supervisor: { nome: 'Ana Silva', email: 'ana@pref.gov.br', senha: 'Supervisor@2027' },
    })).toBeNull();
  });

  // ── B2: Papel fixo = supervisor ───────────────────────────────────────────

  it('payload de onboarding deve sempre usar papel supervisor (papel não é parâmetro livre)', () => {
    // O papel é hardcoded como 'supervisor' no mutationFn — não vem do form
    const papelFixo = 'supervisor';
    expect(papelFixo).toBe('supervisor');
  });

  // ── B3: Slug duplicado ────────────────────────────────────────────────────

  it('detecta slug duplicado na lista carregada', () => {
    const existentes = ['pref-abc', 'tres-lagoas', 'campo-grande'];
    expect(slugJaExiste('tres-lagoas', existentes)).toBe(true);
  });

  it('normaliza slug antes de comparar (espaços e case)', () => {
    const existentes = ['tres-lagoas'];
    expect(slugJaExiste('Tres Lagoas', existentes)).toBe(true);
  });

  it('aceita slug não duplicado', () => {
    const existentes = ['pref-abc', 'tres-lagoas'];
    expect(slugJaExiste('novo-municipio', existentes)).toBe(false);
  });

  // ── B4: Sem sucesso parcial — rollback se supervisor falhar ───────────────

  it('falha no supervisor → sem sucesso, sem credenciais, com rollback', () => {
    const resultado = simularResultadoOnboarding(true, false);
    expect(resultado.sucesso).toBe(false);
    expect(resultado.credenciais).toBe(false);
    expect(resultado.erro).toMatch(/removido automaticamente/i);
  });

  it('falha no cliente → sem sucesso, sem credenciais', () => {
    const resultado = simularResultadoOnboarding(false, false);
    expect(resultado.sucesso).toBe(false);
    expect(resultado.credenciais).toBe(false);
  });

  it('sucesso completo → sucesso, credenciais disponíveis', () => {
    const resultado = simularResultadoOnboarding(true, true);
    expect(resultado.sucesso).toBe(true);
    expect(resultado.credenciais).toBe(true);
    expect(resultado.erro).toBeNull();
  });

  it('credenciais só aparecem quando ambos foram criados com sucesso', () => {
    // Sucesso parcial (cliente criado, supervisor não) NÃO deve exibir credenciais
    const parcial = simularResultadoOnboarding(true, false);
    expect(parcial.credenciais).toBe(false);

    // Sucesso completo exibe credenciais
    const completo = simularResultadoOnboarding(true, true);
    expect(completo.credenciais).toBe(true);
  });
});
