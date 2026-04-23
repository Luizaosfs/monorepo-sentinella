import { ScoreInputs, calcularScorePrioridadeFoco } from './calcular-score-prioridade-foco';

function base(): ScoreInputs {
  return {
    status: 'suspeita',
    focoAnteriorId: null,
    latitude: null,
    longitude: null,
    prazoMinutos: 60,
    tempoNoEstadoMinutos: 10, // ~17% do prazo → ok
    casosProximosCount: 0,
  };
}

describe('calcularScorePrioridadeFoco', () => {
  it('status resolvido → 0 (terminal)', () => {
    expect(calcularScorePrioridadeFoco({ ...base(), status: 'resolvido' })).toBe(0);
  });

  it('status descartado → 0 (terminal)', () => {
    expect(calcularScorePrioridadeFoco({ ...base(), status: 'descartado' })).toBe(0);
  });

  it('SLA ok (tempo < 70% do prazo) → score=10', () => {
    expect(calcularScorePrioridadeFoco({ ...base(), tempoNoEstadoMinutos: 10 })).toBe(10);
  });

  it('SLA atencao (70% ≤ tempo < 90%) → score=20', () => {
    expect(calcularScorePrioridadeFoco({ ...base(), tempoNoEstadoMinutos: 42 })).toBe(20);
  });

  it('SLA critico (90% ≤ tempo ≤ 100%) → score=40', () => {
    expect(calcularScorePrioridadeFoco({ ...base(), tempoNoEstadoMinutos: 55 })).toBe(40);
  });

  it('SLA vencido (tempo > prazo) → score=50', () => {
    expect(calcularScorePrioridadeFoco({ ...base(), tempoNoEstadoMinutos: 61 })).toBe(50);
  });

  it('prazoMinutos=null → sla sem_prazo → 10', () => {
    expect(calcularScorePrioridadeFoco({ ...base(), prazoMinutos: null })).toBe(10);
  });

  it('tempoNoEstadoMinutos=null → sla sem_prazo → 10', () => {
    expect(calcularScorePrioridadeFoco({ ...base(), tempoNoEstadoMinutos: null })).toBe(10);
  });

  it('reincidência: focoAnteriorId != null → +20', () => {
    const result = calcularScorePrioridadeFoco({
      ...base(),
      tempoNoEstadoMinutos: 61, // vencido → 50
      focoAnteriorId: 'foco-anterior-id',
    });
    expect(result).toBe(70); // 50 + 20
  });

  it('casos próximos: 6 × 5 = 30 (cap máximo)', () => {
    const result = calcularScorePrioridadeFoco({
      ...base(),
      tempoNoEstadoMinutos: 61, // vencido → 50
      latitude: -15.0,
      longitude: -47.0,
      casosProximosCount: 6,
    });
    expect(result).toBe(80); // 50 + 30 (cap)
  });

  it('casos próximos: 4 × 5 = 20 (abaixo do cap)', () => {
    const result = calcularScorePrioridadeFoco({
      ...base(),
      tempoNoEstadoMinutos: 10, // ok → 10
      latitude: -15.0,
      longitude: -47.0,
      casosProximosCount: 4,
    });
    expect(result).toBe(30); // 10 + 20
  });

  it('latitude=null → casos ignorados mesmo com casosProximosCount > 0', () => {
    const result = calcularScorePrioridadeFoco({
      ...base(),
      tempoNoEstadoMinutos: 10,
      latitude: null,
      longitude: -47.0,
      casosProximosCount: 10,
    });
    expect(result).toBe(10); // casos não somam (null lat)
  });

  it('combinação máxima: vencido + reincidência + casos cap = 50+20+30 = 100', () => {
    const result = calcularScorePrioridadeFoco({
      status: 'em_tratamento',
      focoAnteriorId: 'anterior',
      latitude: -15.0,
      longitude: -47.0,
      prazoMinutos: 60,
      tempoNoEstadoMinutos: 70,
      casosProximosCount: 10,
    });
    expect(result).toBe(100);
  });
});
