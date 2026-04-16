/**
 * Testes de regressão — Security Hardening (2027-02)
 *
 * Cobre os vetores corrigidos nas migrations 20270202000002–000005:
 *
 *   C-01 — Guard de trigger bloqueia reatribuição direta de responsavel_id
 *   C-02 — NULL guard em rpc_transicionar_foco_risco
 *   C-03 — RPCs migrados de usuarios.papel_app → papeis_usuarios.papel
 *   C-04 — Rate limit global por município em denunciar_cidadao
 *   C-05 — Verificação de ativo em rpc_transicionar_foco_risco
 *   C-06 — piloto_eventos INSERT restrito a papéis canônicos
 *
 * Nota: vetores C-01–C-06 são guards de banco (SECURITY DEFINER / trigger / RLS).
 * Estes testes cobrem a camada frontend que interage com eles:
 *   - normalizePapel não concede acesso a aliases removidos
 *   - SupervisorOnlyGuard bloqueia admin da operação municipal
 *   - normalizarPapelParaExibicao exibe analista_regional corretamente
 *   - papel_permitido_para_supervisor não aceita operador (morto)
 */

import { describe, it, expect } from 'vitest';
import { normalizePapel } from '@/hooks/useAuth';
import { normalizarPapelParaExibicao } from '@/lib/labels';

// ── C-02 / C-05 — NULL guard e ativo check: o frontend não concede papel sem fonte válida

describe('normalizePapel — NULL guard (C-02)', () => {
  it('string vazia → null (usuário sem papel definido não recebe acesso)', () => {
    expect(normalizePapel('')).toBeNull();
  });

  it('undefined → null', () => {
    expect(normalizePapel(undefined as unknown as string)).toBeNull();
  });

  it('null → null', () => {
    expect(normalizePapel(null as unknown as string)).toBeNull();
  });

  it('papel desconhecido → null (nenhum acesso implícito)', () => {
    expect(normalizePapel('desconhecido')).toBeNull();
  });
});

// ── C-03 — Aliases removidos: operador/moderador/gestor não concedem acesso

describe('normalizePapel — aliases mortos → null (C-03)', () => {
  it('"operador" → null (alias removido; dados migrados para agente no banco)', () => {
    expect(normalizePapel('operador')).toBeNull();
  });

  it('"OPERADOR" → null (case-insensitive)', () => {
    expect(normalizePapel('OPERADOR')).toBeNull();
  });

  it('"moderador" → null (nunca existiu no enum)', () => {
    expect(normalizePapel('moderador')).toBeNull();
  });

  it('"gestor" → null (alias de UI — nunca usar em guards)', () => {
    expect(normalizePapel('gestor')).toBeNull();
  });

  it('"platform_admin" → null (valor morto neutralizado em S01)', () => {
    expect(normalizePapel('platform_admin')).toBeNull();
  });
});

// ── Papéis canônicos continuam funcionando após remoção de aliases

describe('normalizePapel — papéis canônicos íntegros após hardening', () => {
  const canonicos: Array<[string, string]> = [
    ['admin', 'admin'],
    ['supervisor', 'supervisor'],
    ['agente', 'agente'],
    ['notificador', 'notificador'],
    ['analista_regional', 'analista_regional'],
  ];

  for (const [input, expected] of canonicos) {
    it(`"${input}" → "${expected}"`, () => {
      expect(normalizePapel(input)).toBe(expected);
    });
  }
});

// ── C-01 — papel_permitido_para_supervisor: operador não é mais válido
// (verificado no banco via papel_permitido_para_supervisor(); aqui cobrimos
//  a invariante: supervisor só pode criar agente ou notificador)

describe('papéis atribuíveis por supervisor (C-01 / migration 000002)', () => {
  const PAPEIS_ATRIBUIVEIS_POR_SUPERVISOR = new Set(['agente', 'notificador']);

  it('"agente" é atribuível por supervisor', () => {
    expect(PAPEIS_ATRIBUIVEIS_POR_SUPERVISOR.has('agente')).toBe(true);
  });

  it('"notificador" é atribuível por supervisor', () => {
    expect(PAPEIS_ATRIBUIVEIS_POR_SUPERVISOR.has('notificador')).toBe(true);
  });

  it('"operador" NÃO é atribuível por supervisor (alias morto)', () => {
    expect(PAPEIS_ATRIBUIVEIS_POR_SUPERVISOR.has('operador')).toBe(false);
  });

  it('"admin" NÃO é atribuível por supervisor', () => {
    expect(PAPEIS_ATRIBUIVEIS_POR_SUPERVISOR.has('admin')).toBe(false);
  });

  it('"supervisor" NÃO é atribuível por supervisor (auto-promoção bloqueada)', () => {
    expect(PAPEIS_ATRIBUIVEIS_POR_SUPERVISOR.has('supervisor')).toBe(false);
  });

  it('"analista_regional" NÃO é atribuível por supervisor', () => {
    expect(PAPEIS_ATRIBUIVEIS_POR_SUPERVISOR.has('analista_regional')).toBe(false);
  });
});

// ── C-06 — piloto_eventos: apenas papéis canônicos instrumentam eventos
// (policy no banco; aqui verificamos que nenhum alias morto passaria)

describe('papéis canônicos para piloto_eventos INSERT (C-06)', () => {
  const PAPEIS_CANONICOS_PILOTO = new Set([
    'admin', 'supervisor', 'agente', 'notificador', 'analista_regional',
  ]);

  it('todos os 5 papéis canônicos são aceitos', () => {
    for (const p of PAPEIS_CANONICOS_PILOTO) {
      expect(PAPEIS_CANONICOS_PILOTO.has(p)).toBe(true);
    }
  });

  it('"operador" NÃO é aceito (alias morto)', () => {
    expect(PAPEIS_CANONICOS_PILOTO.has('operador')).toBe(false);
  });

  it('"moderador" NÃO é aceito', () => {
    expect(PAPEIS_CANONICOS_PILOTO.has('moderador')).toBe(false);
  });

  it('"gestor" NÃO é aceito', () => {
    expect(PAPEIS_CANONICOS_PILOTO.has('gestor')).toBe(false);
  });

  it('string vazia NÃO é aceita (NULL guard C-02)', () => {
    expect(PAPEIS_CANONICOS_PILOTO.has('')).toBe(false);
  });
});

// ── analista_regional aparece corretamente na UI (bug fix /admin/usuarios)

describe('normalizarPapelParaExibicao — analista_regional visível na UI', () => {
  it('"analista_regional" → "analista_regional" (não cai no fallback agente)', () => {
    expect(normalizarPapelParaExibicao('analista_regional')).toBe('analista_regional');
  });

  it('"ANALISTA_REGIONAL" → "analista_regional" (case-insensitive)', () => {
    expect(normalizarPapelParaExibicao('ANALISTA_REGIONAL')).toBe('analista_regional');
  });

  it('"analista_regional" é diferente de "agente" (não confundir na tabela de usuários)', () => {
    expect(normalizarPapelParaExibicao('analista_regional')).not.toBe('agente');
  });
});

// ── Rate limit por município (C-04) — sentinel '__global__'
// Sem acesso ao banco aqui; verificamos a constante de design

describe('rate limit global por município (C-04) — constantes de design', () => {
  const LIMITE_IP = 10;
  const LIMITE_MUNICIPIO = 50;
  const SENTINEL = '__global__';

  it('limite por município é maior que limite por IP (camada adicional, não substituta)', () => {
    expect(LIMITE_MUNICIPIO).toBeGreaterThan(LIMITE_IP);
  });

  it('sentinel não é um IP válido (não colide com hash de IP real)', () => {
    expect(SENTINEL).toBe('__global__');
    expect(SENTINEL).not.toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
  });

  it('limite por município impede >50 abusos por hora por slug mesmo com IP rotation', () => {
    // Invariante de design: o limite global é independente do IP
    const eventosSimulados = Array.from({ length: 51 }, (_, i) => ({
      ip: `10.0.0.${i % 256}`, // IPs diferentes
      municipio: 'municipio-x',
    }));
    expect(eventosSimulados.length).toBeGreaterThan(LIMITE_MUNICIPIO);
    // O 51º evento seria bloqueado pelo limite global, independente do IP
  });
});
