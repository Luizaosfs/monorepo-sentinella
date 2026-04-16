import { describe, it, expect, vi, afterEach } from 'vitest';
import { SLA_RULES } from '@/types/sla';
import { DEFAULT_SLA_CONFIG } from '@/types/sla-config';
import {
  calcularSlaHoras,
  getSlaVisualStatus,
  getSlaLocalLabel,
  getSlaOrigem,
  getSlaReductionReason,
  getTempoRestante,
} from '@/types/sla';
import type { SlaOperacional } from '@/types/sla';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSla(overrides: Partial<SlaOperacional> = {}): SlaOperacional {
  const now = new Date();
  const inicio = new Date(now.getTime() - 60 * 60 * 1000).toISOString(); // 1h atrás
  const prazo  = new Date(now.getTime() + 60 * 60 * 1000).toISOString(); // 1h à frente
  return {
    id: 'sla-1',
    item_id: null,
    levantamento_item_id: null,
    cliente_id: 'cliente-1',
    operador_id: null,
    prioridade: 'Alta',
    sla_horas: 12,
    inicio,
    prazo_final: prazo,
    concluido_em: null,
    status: 'pendente',
    violado: false,
    escalonado: false,
    escalonado_em: null,
    escalado_por: null,
    reaberto_por: null,
    prioridade_original: null,
    created_at: inicio,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ── DEFAULT_SLA_CONFIG × SLA_RULES ────────────────────────────────────────────

describe('DEFAULT_SLA_CONFIG consistency with SLA_RULES', () => {
  it('prioridade Crítica tem horas === 4', () => {
    expect(DEFAULT_SLA_CONFIG.prioridades['Crítica'].horas).toBe(SLA_RULES['Crítica'].horas);
    expect(DEFAULT_SLA_CONFIG.prioridades['Crítica'].horas).toBe(4);
  });

  it('prioridade Alta tem horas === 12', () => {
    expect(DEFAULT_SLA_CONFIG.prioridades['Alta'].horas).toBe(SLA_RULES['Alta'].horas);
    expect(DEFAULT_SLA_CONFIG.prioridades['Alta'].horas).toBe(12);
  });

  it('prioridade Baixa tem horas === 72', () => {
    expect(DEFAULT_SLA_CONFIG.prioridades['Baixa'].horas).toBe(SLA_RULES['Baixa'].horas);
    expect(DEFAULT_SLA_CONFIG.prioridades['Baixa'].horas).toBe(72);
  });

  it('fatores.risco_muito_alto_pct === 30', () => {
    expect(DEFAULT_SLA_CONFIG.fatores.risco_muito_alto_pct).toBe(30);
  });

  it('fatores.persistencia_dias_min === 3', () => {
    expect(DEFAULT_SLA_CONFIG.fatores.persistencia_dias_min).toBe(3);
  });

  it('fatores.temperatura_min === 30', () => {
    expect(DEFAULT_SLA_CONFIG.fatores.temperatura_min).toBe(30);
  });

  it('horario_comercial.ativo === false', () => {
    expect(DEFAULT_SLA_CONFIG.horario_comercial.ativo).toBe(false);
  });

  it('horario_comercial.dias_semana inclui dias 1 a 5 (seg a sex)', () => {
    const dias = DEFAULT_SLA_CONFIG.horario_comercial.dias_semana;
    [1, 2, 3, 4, 5].forEach((d) => expect(dias).toContain(d));
  });

  it('horario_comercial.dias_semana NÃO inclui 0 (domingo)', () => {
    expect(DEFAULT_SLA_CONFIG.horario_comercial.dias_semana).not.toContain(0);
  });

  it('horario_comercial.dias_semana NÃO inclui 6 (sábado)', () => {
    expect(DEFAULT_SLA_CONFIG.horario_comercial.dias_semana).not.toContain(6);
  });

  it('todas as prioridades do SLA_RULES existem em DEFAULT_SLA_CONFIG.prioridades', () => {
    const configKeys = Object.keys(DEFAULT_SLA_CONFIG.prioridades);
    for (const prioridade of Object.keys(SLA_RULES)) {
      expect(configKeys).toContain(prioridade);
    }
  });

  it('nenhuma prioridade tem horas <= 0', () => {
    for (const [, val] of Object.entries(DEFAULT_SLA_CONFIG.prioridades)) {
      expect(val.horas).toBeGreaterThan(0);
    }
  });
});

// ── calcularSlaHoras ─────────────────────────────────────────────────────────

describe('calcularSlaHoras', () => {
  it('retorna horas base sem modificadores', () => {
    expect(calcularSlaHoras('Alta')).toBe(12);
    expect(calcularSlaHoras('Crítica')).toBe(4);
    expect(calcularSlaHoras('Baixa')).toBe(72);
    expect(calcularSlaHoras('Moderada')).toBe(24);
  });

  it('prioridade desconhecida faz fallback para Baixa (72h)', () => {
    expect(calcularSlaHoras('Desconhecida')).toBe(72);
  });

  it('risco "Muito Alto" reduz 30% (Alta: 12 * 0.7 = 8.4 → 8)', () => {
    expect(calcularSlaHoras('Alta', 'Muito Alto')).toBe(8);
  });

  it('risco case-insensitive "muito alto"', () => {
    expect(calcularSlaHoras('Alta', 'muito alto')).toBe(8);
  });

  it('risco "Alto" (não "Muito Alto") não reduz', () => {
    expect(calcularSlaHoras('Alta', 'Alto')).toBe(12);
  });

  it('persistência > 3 dias reduz 20% (Alta: 12 * 0.8 = 9.6 → 10)', () => {
    expect(calcularSlaHoras('Alta', null, '5')).toBe(10);
  });

  it('persistência = 3 dias não reduz', () => {
    expect(calcularSlaHoras('Alta', null, '3')).toBe(12);
  });

  it('persistência inválida/NaN não reduz', () => {
    expect(calcularSlaHoras('Alta', null, 'abc')).toBe(12);
  });

  it('temperatura > 30°C reduz 10% (Alta: 12 * 0.9 = 10.8 → 11)', () => {
    expect(calcularSlaHoras('Alta', null, null, 35)).toBe(11);
  });

  it('temperatura = 30°C não reduz', () => {
    expect(calcularSlaHoras('Alta', null, null, 30)).toBe(12);
  });

  it('todos os modificadores acumulam (Alta: 12 * 0.7 * 0.8 * 0.9 = 6.05 → 6)', () => {
    expect(calcularSlaHoras('Alta', 'Muito Alto', '5', 35)).toBe(6);
  });

  it('garante mínimo de 2h mesmo com muitas reduções (Crítica com todos)', () => {
    // 4 * 0.7 * 0.8 * 0.9 = 2.016 → 2
    expect(calcularSlaHoras('Crítica', 'Muito Alto', '7', 40)).toBe(2);
  });

  it('resultado é sempre um número inteiro', () => {
    const result = calcularSlaHoras('Moderada', 'Muito Alto', '5', 35);
    expect(Number.isInteger(result)).toBe(true);
  });
});

// ── getSlaVisualStatus ────────────────────────────────────────────────────────

describe('getSlaVisualStatus', () => {
  it('status vencido → expired', () => {
    expect(getSlaVisualStatus(makeSla({ status: 'vencido' }))).toBe('expired');
  });

  it('violado=true → expired independente do status', () => {
    expect(getSlaVisualStatus(makeSla({ violado: true, status: 'pendente' }))).toBe('expired');
  });

  it('status concluido → ok', () => {
    expect(getSlaVisualStatus(makeSla({ status: 'concluido' }))).toBe('ok');
  });

  it('prazo vencido (prazo_final no passado) → expired', () => {
    const past = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(getSlaVisualStatus(makeSla({ prazo_final: past }))).toBe('expired');
  });

  it('mais de 80% do tempo restante → ok', () => {
    const now = Date.now();
    const inicio = new Date(now - 1 * 60 * 60 * 1000).toISOString();  // 1h atrás
    const prazo  = new Date(now + 9 * 60 * 60 * 1000).toISOString();  // 9h à frente (90% restante)
    expect(getSlaVisualStatus(makeSla({ inicio, prazo_final: prazo }))).toBe('ok');
  });

  it('menos de 20% do tempo restante → warning', () => {
    const now = Date.now();
    const inicio = new Date(now - 9 * 60 * 60 * 1000).toISOString();  // 9h atrás
    const prazo  = new Date(now + 1 * 60 * 60 * 1000).toISOString();  // 1h à frente (10% restante)
    expect(getSlaVisualStatus(makeSla({ inicio, prazo_final: prazo }))).toBe('warning');
  });
});

// ── getSlaLocalLabel ──────────────────────────────────────────────────────────

describe('getSlaLocalLabel', () => {
  it('retorna bairro_nome do item quando disponível', () => {
    const sla = makeSla({ item: { id: 'i1', bairro_nome: 'Centro', classificacao_risco: 'Alto', situacao_ambiental: null, chuva_24h_mm: null, tendencia: null, prioridade_operacional: 'P1', run_id: 'r1' } });
    expect(getSlaLocalLabel(sla)).toBe('Centro');
  });

  it('retorna endereco_curto do levantamento_item quando item ausente', () => {
    const sla = makeSla({ levantamento_item: { id: 'l1', item: 'Caixa d\'água', risco: 'Alto', prioridade: 'P2', endereco_curto: 'Rua das Flores, 42' } });
    expect(getSlaLocalLabel(sla)).toBe('Rua das Flores, 42');
  });

  it('retorna item quando endereco_curto ausente', () => {
    const sla = makeSla({ levantamento_item: { id: 'l1', item: 'Pneu', risco: 'Médio', prioridade: 'P3', endereco_curto: null } });
    expect(getSlaLocalLabel(sla)).toBe('Pneu');
  });

  it('retorna "—" quando nenhuma referência disponível', () => {
    expect(getSlaLocalLabel(makeSla())).toBe('—');
  });
});

// ── getSlaOrigem ──────────────────────────────────────────────────────────────

describe('getSlaOrigem', () => {
  it('com levantamento_item_id → "levantamento"', () => {
    expect(getSlaOrigem(makeSla({ levantamento_item_id: 'li-1' }))).toBe('levantamento');
  });

  it('sem levantamento_item_id → "pluvio"', () => {
    expect(getSlaOrigem(makeSla({ levantamento_item_id: null }))).toBe('pluvio');
  });
});

// ── getSlaReductionReason ─────────────────────────────────────────────────────

describe('getSlaReductionReason', () => {
  it('retorna null quando prioridade ausente', () => {
    expect(getSlaReductionReason(null, '2026-04-02T12:00:00Z', '2026-04-02T08:00:00Z')).toBeNull();
  });

  it('retorna null quando prazo ausente', () => {
    expect(getSlaReductionReason('Alta', null, '2026-04-02T08:00:00Z')).toBeNull();
  });

  it('retorna null quando confirmado_em ausente', () => {
    expect(getSlaReductionReason('Alta', '2026-04-02T12:00:00Z', null)).toBeNull();
  });

  it('retorna null para prioridade desconhecida', () => {
    expect(getSlaReductionReason('XYZ', '2026-04-02T12:00:00Z', '2026-04-02T08:00:00Z')).toBeNull();
  });

  it('retorna null quando prazo aplicado está dentro de 5% do base', () => {
    // Alta = 12h. 12h exatas → sem redução
    const confirmado = '2026-04-02T08:00:00Z';
    const prazo = '2026-04-02T20:00:00Z'; // 12h depois
    expect(getSlaReductionReason('Alta', prazo, confirmado)).toBeNull();
  });

  it('retorna descrição quando prazo aplicado é > 5% menor que o base', () => {
    // Alta = 12h. Aplicar apenas 8h → redução de 33%
    const confirmado = '2026-04-02T08:00:00Z';
    const prazo = '2026-04-02T16:00:00Z'; // 8h depois
    const reason = getSlaReductionReason('Alta', prazo, confirmado);
    expect(reason).not.toBeNull();
    expect(reason).toContain('12h');
    expect(reason).toContain('8h');
  });
});

// ── getTempoRestante ──────────────────────────────────────────────────────────

describe('getTempoRestante', () => {
  it('prazo vencido retorna "Vencido"', () => {
    const passado = new Date(Date.now() - 60 * 1000).toISOString();
    expect(getTempoRestante(passado)).toBe('Vencido');
  });

  it('menos de 24h retorna formato "Xh Ymin"', () => {
    const prazo = new Date(Date.now() + 2 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString();
    const result = getTempoRestante(prazo);
    expect(result).toMatch(/^\d+h \d+min$/);
  });

  it('mais de 24h retorna formato "Xd Yh"', () => {
    const prazo = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const result = getTempoRestante(prazo);
    expect(result).toMatch(/^\d+d \d+h$/);
  });
});
