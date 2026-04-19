import { describe, it, expect } from 'vitest';
import type { SlaOperacional } from './sla';
import {
  getSlaVisualStatus,
  getTempoRestante,
  getSlaLocalLabel,
  getSlaOrigem,
  getSlaReductionReason,
  SLA_RULES,
} from './sla';

function makeSla(overrides: Partial<SlaOperacional> = {}): SlaOperacional {
  const now = new Date();
  const inicio = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(); // 2h ago
  const prazo = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();  // 2h from now
  return {
    id: 'test-id',
    item_id: null,
    levantamento_item_id: null,
    cliente_id: null,
    agente_id: null,
    prioridade: 'Alta',
    sla_horas: 4,
    inicio,
    prazo_final: prazo,
    concluido_em: null,
    status: 'pendente',
    violado: false,
    escalonado: false,
    escalonado_em: null,
    prioridade_original: null,
    created_at: inicio,
    item: null,
    levantamento_item: null,
    ...overrides,
  };
}

describe('getSlaVisualStatus', () => {
  it('retorna expired quando status === vencido', () => {
    const sla = makeSla({ status: 'vencido' });
    expect(getSlaVisualStatus(sla)).toBe('expired');
  });

  it('retorna expired quando violado === true independente do status', () => {
    const sla = makeSla({ violado: true, status: 'pendente' });
    expect(getSlaVisualStatus(sla)).toBe('expired');
  });

  it('retorna ok quando status === concluido', () => {
    const sla = makeSla({ status: 'concluido' });
    expect(getSlaVisualStatus(sla)).toBe('ok');
  });

  it('retorna expired quando prazo_final está no passado e status é pendente', () => {
    const now = new Date();
    const inicio = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(); // 3h ago
    const prazo = new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString();  // 1h ago
    const sla = makeSla({ inicio, prazo_final: prazo, status: 'pendente' });
    expect(getSlaVisualStatus(sla)).toBe('expired');
  });

  it('retorna warning quando menos de 20% do tempo restante', () => {
    // total = 3.5h, remaining = 30min = ~14% → warning
    const now = new Date();
    const inicio = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();       // 3h ago
    const prazo = new Date(now.getTime() + 30 * 60 * 1000).toISOString();            // 30min from now
    const sla = makeSla({ inicio, prazo_final: prazo, status: 'pendente' });
    expect(getSlaVisualStatus(sla)).toBe('warning');
  });

  it('retorna ok quando há mais de 20% restante', () => {
    // default makeSla: inicio 2h ago, prazo 2h from now → 50% remaining
    const sla = makeSla();
    expect(getSlaVisualStatus(sla)).toBe('ok');
  });

  it('retorna ok quando status === em_atendimento e prazo não vencido', () => {
    const sla = makeSla({ status: 'em_atendimento' });
    expect(getSlaVisualStatus(sla)).toBe('ok');
  });
});

describe('getTempoRestante', () => {
  it('retorna Vencido quando prazo_final é no passado', () => {
    const prazo = new Date(Date.now() - 60000).toISOString();
    expect(getTempoRestante(prazo)).toBe('Vencido');
  });

  it('retorna formato Xh Ymin para prazos dentro de 24h', () => {
    const prazo = new Date(Date.now() + 3 * 60 * 60 * 1000 + 45 * 60 * 1000).toISOString();
    const result = getTempoRestante(prazo);
    // Accept small time drift of 1 minute
    expect(result).toMatch(/^3h 4[45]min$/);
  });

  it('retorna formato Xd Yh para prazos acima de 24h', () => {
    const prazo = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString();
    const result = getTempoRestante(prazo);
    expect(result).toMatch(/^2d [23]h$/);
  });

  it('retorna 0h 0min quando diff é quase zero', () => {
    const prazo = new Date(Date.now() + 30000).toISOString();
    const result = getTempoRestante(prazo);
    expect(result).toBe('0h 0min');
  });
});

describe('getSlaLocalLabel', () => {
  it('retorna bairro_nome do item pluvio quando disponível', () => {
    const sla = makeSla({
      item: {
        id: 'item-1',
        bairro_nome: 'Centro',
        classificacao_risco: 'Alto',
        situacao_ambiental: null,
        chuva_24h_mm: null,
        tendencia: null,
        prioridade_operacional: 'Alta',
        run_id: 'run-1',
      },
    });
    expect(getSlaLocalLabel(sla)).toBe('Centro');
  });

  it('retorna endereco_curto quando bairro_nome ausente', () => {
    const sla = makeSla({
      levantamento_item: {
        id: 'li-1',
        item: 'pneu',
        risco: 'Alto',
        prioridade: 'Alta',
        endereco_curto: 'Rua A, 123',
      },
    });
    expect(getSlaLocalLabel(sla)).toBe('Rua A, 123');
  });

  it('retorna item como fallback quando endereco_curto ausente', () => {
    const sla = makeSla({
      levantamento_item: {
        id: 'li-2',
        item: 'calha',
        risco: 'Médio',
        prioridade: 'Média',
        endereco_curto: null,
      },
    });
    expect(getSlaLocalLabel(sla)).toBe('calha');
  });

  it('retorna — quando nenhuma propriedade disponível', () => {
    const sla = makeSla({ item: null, levantamento_item: null });
    expect(getSlaLocalLabel(sla)).toBe('—');
  });
});

describe('getSlaOrigem', () => {
  it('retorna levantamento quando levantamento_item_id preenchido', () => {
    const sla = makeSla({ levantamento_item_id: 'li-abc' });
    expect(getSlaOrigem(sla)).toBe('levantamento');
  });

  it('retorna pluvio quando levantamento_item_id é null', () => {
    const sla = makeSla({ levantamento_item_id: null });
    expect(getSlaOrigem(sla)).toBe('pluvio');
  });
});

// ── getSlaReductionReason ─────────────────────────────────────────────────────

describe('getSlaReductionReason', () => {
  it('retorna null quando prioridade é null', () => {
    const confirmado_em = new Date(Date.now() - 4 * 3600_000).toISOString();
    const sla_prazo_em  = new Date(Date.now() + 1 * 3600_000).toISOString();
    expect(getSlaReductionReason(null, sla_prazo_em, confirmado_em)).toBeNull();
  });

  it('retorna null quando sla_prazo_em é null', () => {
    const confirmado_em = new Date(Date.now() - 1 * 3600_000).toISOString();
    expect(getSlaReductionReason('Alta', null, confirmado_em)).toBeNull();
  });

  it('retorna null quando confirmado_em é null', () => {
    const sla_prazo_em = new Date(Date.now() + 6 * 3600_000).toISOString();
    expect(getSlaReductionReason('Alta', sla_prazo_em, null)).toBeNull();
  });

  it('retorna null quando prioridade não consta em SLA_RULES', () => {
    const confirmado_em = new Date(Date.now() - 1 * 3600_000).toISOString();
    const sla_prazo_em  = new Date(Date.now() + 2 * 3600_000).toISOString();
    expect(getSlaReductionReason('Inexistente', sla_prazo_em, confirmado_em)).toBeNull();
  });

  it('retorna null quando prazo aplicado é igual ao base (sem redução)', () => {
    // Alta = 12h base; prazo aplicado = 12h exatos → sem redução
    const confirmado_em = new Date(Date.now() - 2 * 3600_000).toISOString();
    const sla_prazo_em  = new Date(Date.now() + 10 * 3600_000).toISOString(); // 12h total
    expect(getSlaReductionReason('Alta', sla_prazo_em, confirmado_em)).toBeNull();
  });

  it('retorna null quando prazo aplicado está dentro da tolerância de 5% do base', () => {
    // Alta = 12h base; 5% de tolerância = 0.6h; prazo aplicado = 11.7h → dentro da tolerância
    const confirmado_em = new Date(Date.now() - 1 * 3600_000).toISOString();
    const sla_prazo_em  = new Date(Date.now() + 10.7 * 3600_000).toISOString(); // ~11.7h
    expect(getSlaReductionReason('Alta', sla_prazo_em, confirmado_em)).toBeNull();
  });

  it('retorna mensagem descritiva quando prazo aplicado é mais de 5% menor que o base', () => {
    // Alta = 12h base; prazo aplicado = 8h (33% redução)
    const confirmado_em = new Date(Date.now() - 2 * 3600_000).toISOString();
    const sla_prazo_em  = new Date(Date.now() + 6 * 3600_000).toISOString(); // 8h total
    const result = getSlaReductionReason('Alta', sla_prazo_em, confirmado_em);
    expect(result).not.toBeNull();
    expect(result).toContain('SLA reduzido');
    expect(result).toContain('12h'); // prazo base
  });

  it('mensagem inclui prazo base e prazo aplicado arredondado', () => {
    // Moderada = 24h base; prazo aplicado = 17h
    const confirmado_em = new Date(Date.now() - 3 * 3600_000).toISOString();
    const sla_prazo_em  = new Date(Date.now() + 14 * 3600_000).toISOString(); // 17h total
    const result = getSlaReductionReason('Moderada', sla_prazo_em, confirmado_em);
    expect(result).toContain('24h');
    expect(result).toContain('17h');
  });

  it('retorna null para todos os valores de prioridade quando prazo não foi reduzido', () => {
    for (const prioridade of Object.keys(SLA_RULES)) {
      const base = SLA_RULES[prioridade].horas;
      const confirmado_em = new Date(Date.now()).toISOString();
      const sla_prazo_em  = new Date(Date.now() + base * 3600_000).toISOString();
      expect(getSlaReductionReason(prioridade, sla_prazo_em, confirmado_em)).toBeNull();
    }
  });
});
