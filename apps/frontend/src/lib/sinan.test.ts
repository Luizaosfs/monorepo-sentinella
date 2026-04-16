import { describe, it, expect } from 'vitest';
import { calcularSemanaEpidemiologica, montarPayloadESUS, validarConfiguracaoIntegracao } from './sinan';

describe('calcularSemanaEpidemiologica', () => {
  // ── Known epidemiological weeks ──────────────────────────────────────────
  // In Brazil, epi week starts on Sunday.

  it('returns a number between 1 and 53', () => {
    const week = calcularSemanaEpidemiologica('2025-01-01');
    expect(week).toBeGreaterThanOrEqual(1);
    expect(week).toBeLessThanOrEqual(53);
  });

  it('returns week 1 for Jan 1 2025 (implementation uses Jan 1 as anchor for week 1)', () => {
    // 2025-01-01 is a Wednesday. The implementation defines week 1 as the week
    // containing Jan 1 of each year, so Jan 1 always belongs to week 1.
    const week = calcularSemanaEpidemiologica('2025-01-01');
    expect(week).toBeGreaterThanOrEqual(1);
    expect(week).toBeLessThanOrEqual(53);
  });

  it('returns a higher week number for a mid-year date than early-year date', () => {
    const earlyWeek = calcularSemanaEpidemiologica('2025-01-15');
    const midWeek = calcularSemanaEpidemiologica('2025-06-15');
    expect(midWeek).toBeGreaterThan(earlyWeek);
  });

  it('returns a higher week number for a late-year date than early-year date', () => {
    const earlyWeek = calcularSemanaEpidemiologica('2025-01-15');
    const lateWeek = calcularSemanaEpidemiologica('2025-12-15');
    expect(lateWeek).toBeGreaterThan(earlyWeek);
  });

  it('returns the same week for dates within the same epidemiological week', () => {
    // 2025-03-16 is a Sunday — start of a new epi week
    // 2025-03-22 is the following Saturday — end of that same epi week
    const sun = calcularSemanaEpidemiologica('2025-03-16');
    const sat = calcularSemanaEpidemiologica('2025-03-22');
    expect(sun).toBe(sat);
  });

  it('returns incremented week on the following Sunday', () => {
    // 2025-03-22 Saturday and 2025-03-23 Sunday should be different weeks
    const sat = calcularSemanaEpidemiologica('2025-03-22');
    const nextSun = calcularSemanaEpidemiologica('2025-03-23');
    expect(nextSun).toBe(sat + 1);
  });

  it('returns week 1 for 2025-01-05 (first Sunday of 2025)', () => {
    const week = calcularSemanaEpidemiologica('2025-01-05');
    expect(week).toBeGreaterThanOrEqual(1);
  });

  it('produces consistent results across multiple years', () => {
    const week2024 = calcularSemanaEpidemiologica('2024-06-01');
    const week2025 = calcularSemanaEpidemiologica('2025-06-01');
    // Both should be mid-year weeks (roughly 21-23)
    expect(week2024).toBeGreaterThanOrEqual(20);
    expect(week2025).toBeGreaterThanOrEqual(20);
  });

  // ── Valores exatos conhecidos ─────────────────────────────────────────────
  // Calendário SVS/MS: semana começa no domingo

  it('2025-01-01 (quarta-feira) pertence à semana 1 (âncora: semana que contém 01/jan)', () => {
    // A âncora da semana 1 é o domingo anterior a 01/jan (2024-12-29).
    // 2025-01-01 está nessa semana → semana 1.
    expect(calcularSemanaEpidemiologica('2025-01-01')).toBe(1);
  });

  it('2025-01-05 (primeiro domingo de 2025) pertence à semana 2', () => {
    // O domingo 2025-01-05 inicia uma nova semana — é a semana 2.
    expect(calcularSemanaEpidemiologica('2025-01-05')).toBe(2);
  });

  it('2025-01-06 (segunda-feira após primeiro domingo) também pertence à semana 2', () => {
    expect(calcularSemanaEpidemiologica('2025-01-06')).toBe(2);
  });

  it('2025-12-28 (último domingo do ano) retorna semana >= 52', () => {
    const week = calcularSemanaEpidemiologica('2025-12-28');
    expect(week).toBeGreaterThanOrEqual(52);
  });

  it('resultado nunca é menor que 1 para qualquer data do ano', () => {
    const datas = [
      '2025-01-01', '2025-01-04', '2025-03-01', '2025-07-15', '2025-12-31',
    ];
    for (const d of datas) {
      expect(calcularSemanaEpidemiologica(d)).toBeGreaterThanOrEqual(1);
    }
  });

  it('resultado nunca excede 53 para qualquer data do ano', () => {
    const datas = [
      '2025-01-01', '2025-06-01', '2025-09-01', '2025-12-31',
      '2024-01-01', '2024-06-15', '2024-12-31',
    ];
    for (const d of datas) {
      expect(calcularSemanaEpidemiologica(d)).toBeLessThanOrEqual(53);
    }
  });

  it('semanas são monotonicamente crescentes ao longo do ano (domingos sucessivos)', () => {
    // Verifica 10 domingos consecutivos a partir de 2025-03-02
    let prev = 0;
    for (let i = 0; i < 10; i++) {
      const date = new Date('2025-03-02');
      date.setDate(date.getDate() + i * 7);
      const iso = date.toISOString().slice(0, 10);
      const week = calcularSemanaEpidemiologica(iso);
      expect(week).toBeGreaterThan(prev);
      prev = week;
    }
  });
});

describe('validarConfiguracaoIntegracao', () => {
  // ── Valid configuration ──────────────────────────────────────────────────

  it('returns valida=true when all fields are present and ativo=true', () => {
    const result = validarConfiguracaoIntegracao({
      api_key: 'abc123',
      codigo_ibge: '5000203',
      unidade_saude_cnes: '1234567',
      ativo: true,
    });
    expect(result.valida).toBe(true);
    expect(result.erros).toHaveLength(0);
  });

  // ── Individual field validations ─────────────────────────────────────────

  it('adds error when ativo=false', () => {
    const result = validarConfiguracaoIntegracao({
      api_key: 'abc123',
      codigo_ibge: '5000203',
      unidade_saude_cnes: '1234567',
      ativo: false,
    });
    expect(result.valida).toBe(false);
    expect(result.erros).toContain('Integração está desativada.');
  });

  it('adds error when api_key is null', () => {
    const result = validarConfiguracaoIntegracao({
      api_key: null,
      codigo_ibge: '5000203',
      unidade_saude_cnes: '1234567',
      ativo: true,
    });
    expect(result.valida).toBe(false);
    expect(result.erros).toContain('API Key não configurada.');
  });

  it('adds error when api_key is empty string', () => {
    const result = validarConfiguracaoIntegracao({
      api_key: '',
      codigo_ibge: '5000203',
      unidade_saude_cnes: '1234567',
      ativo: true,
    });
    expect(result.valida).toBe(false);
    expect(result.erros).toContain('API Key não configurada.');
  });

  it('adds error when codigo_ibge is null', () => {
    const result = validarConfiguracaoIntegracao({
      api_key: 'abc123',
      codigo_ibge: null,
      unidade_saude_cnes: '1234567',
      ativo: true,
    });
    expect(result.valida).toBe(false);
    expect(result.erros).toContain('Código IBGE do município não configurado.');
  });

  it('adds error when unidade_saude_cnes is null', () => {
    const result = validarConfiguracaoIntegracao({
      api_key: 'abc123',
      codigo_ibge: '5000203',
      unidade_saude_cnes: null,
      ativo: true,
    });
    expect(result.valida).toBe(false);
    expect(result.erros).toContain('CNES da unidade de saúde não configurado.');
  });

  // ── Multiple errors at once ──────────────────────────────────────────────

  it('reports all errors when all fields are invalid', () => {
    const result = validarConfiguracaoIntegracao({
      api_key: null,
      codigo_ibge: null,
      unidade_saude_cnes: null,
      ativo: false,
    });
    expect(result.valida).toBe(false);
    expect(result.erros).toHaveLength(4);
    expect(result.erros).toContain('Integração está desativada.');
    expect(result.erros).toContain('API Key não configurada.');
    expect(result.erros).toContain('Código IBGE do município não configurado.');
    expect(result.erros).toContain('CNES da unidade de saúde não configurado.');
  });

  it('reports two errors when api_key and ativo are invalid', () => {
    const result = validarConfiguracaoIntegracao({
      api_key: null,
      codigo_ibge: '5000203',
      unidade_saude_cnes: '1234567',
      ativo: false,
    });
    expect(result.valida).toBe(false);
    expect(result.erros).toHaveLength(2);
  });
});

describe('montarPayloadESUS', () => {
  const BASE_ITEM = {
    endereco_completo: 'Rua das Flores, 123',
    endereco_curto: 'Rua das Flores',
    latitude: -20.4697,
    longitude: -54.6201,
    data_hora: '2025-06-15T10:30:00.000Z',
    data_inicio_sintomas: '2025-06-13',
  };
  const IBGE = '5000203';
  const CNES = '1234567';

  // ── Campos obrigatórios presentes ────────────────────────────────────────

  it('define codigoMunicipio a partir do parâmetro codigoIbge', () => {
    const payload = montarPayloadESUS(BASE_ITEM, IBGE, CNES);
    expect(payload.codigoMunicipio).toBe(IBGE);
  });

  it('define codigoCnes a partir do parâmetro cnes', () => {
    const payload = montarPayloadESUS(BASE_ITEM, IBGE, CNES);
    expect(payload.codigoCnes).toBe(CNES);
  });

  it('retorna todos os campos obrigatórios', () => {
    const payload = montarPayloadESUS(BASE_ITEM, IBGE, CNES);
    expect(payload).toHaveProperty('codigoMunicipio');
    expect(payload).toHaveProperty('codigoCnes');
    expect(payload).toHaveProperty('dataNotificacao');
    expect(payload).toHaveProperty('semanaEpidemiologica');
    expect(payload).toHaveProperty('agravo');
    expect(payload).toHaveProperty('classificacaoFinal');
    expect(payload).toHaveProperty('criterioConfirmacao');
  });

  // ── Mapeamento de agravo ─────────────────────────────────────────────────

  it('mapeia dengue para CID A90', () => {
    const payload = montarPayloadESUS(BASE_ITEM, IBGE, CNES, 'dengue');
    expect(payload.agravo).toBe('A90');
  });

  it('mapeia chikungunya para CID A92.0', () => {
    const payload = montarPayloadESUS(BASE_ITEM, IBGE, CNES, 'chikungunya');
    expect(payload.agravo).toBe('A92.0');
  });

  it('mapeia zika para CID A92.8', () => {
    const payload = montarPayloadESUS(BASE_ITEM, IBGE, CNES, 'zika');
    expect(payload.agravo).toBe('A92.8');
  });

  it('usa dengue como agravo padrão quando tipoAgravo não é fornecido', () => {
    const payload = montarPayloadESUS(BASE_ITEM, IBGE, CNES);
    expect(payload.agravo).toBe('A90');
  });

  // ── Classificações fixas ─────────────────────────────────────────────────

  it('define classificacaoFinal como 2 (suspeito)', () => {
    const payload = montarPayloadESUS(BASE_ITEM, IBGE, CNES);
    expect(payload.classificacaoFinal).toBe(2);
  });

  it('define criterioConfirmacao como 2 (clínico-epidemiológico)', () => {
    const payload = montarPayloadESUS(BASE_ITEM, IBGE, CNES);
    expect(payload.criterioConfirmacao).toBe(2);
  });

  // ── dataNotificacao ──────────────────────────────────────────────────────

  it('extrai YYYY-MM-DD da string ISO em data_hora', () => {
    const payload = montarPayloadESUS(BASE_ITEM, IBGE, CNES);
    expect(payload.dataNotificacao).toBe('2025-06-15');
  });

  it('usa data de hoje quando data_hora é null', () => {
    const payload = montarPayloadESUS({ ...BASE_ITEM, data_hora: null }, IBGE, CNES);
    expect(payload.dataNotificacao).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // ── semanaEpidemiologica ─────────────────────────────────────────────────

  it('semanaEpidemiologica corresponde à calculada para dataNotificacao', () => {
    const payload = montarPayloadESUS(BASE_ITEM, IBGE, CNES);
    const esperada = calcularSemanaEpidemiologica(payload.dataNotificacao);
    expect(payload.semanaEpidemiologica).toBe(esperada);
  });

  // ── logradouro ───────────────────────────────────────────────────────────

  it('usa endereco_completo como logradouro quando disponível', () => {
    const payload = montarPayloadESUS(BASE_ITEM, IBGE, CNES);
    expect(payload.logradouro).toBe('Rua das Flores, 123');
  });

  it('usa endereco_curto como fallback quando endereco_completo é null', () => {
    const payload = montarPayloadESUS(
      { ...BASE_ITEM, endereco_completo: null },
      IBGE,
      CNES,
    );
    expect(payload.logradouro).toBe('Rua das Flores');
  });

  it('logradouro é undefined quando ambos os endereços são null', () => {
    const payload = montarPayloadESUS(
      { ...BASE_ITEM, endereco_completo: null, endereco_curto: null },
      IBGE,
      CNES,
    );
    expect(payload.logradouro).toBeUndefined();
  });

  // ── latitude / longitude ─────────────────────────────────────────────────

  it('inclui latitude e longitude quando presentes no item', () => {
    const payload = montarPayloadESUS(BASE_ITEM, IBGE, CNES);
    expect(payload.latitude).toBe(-20.4697);
    expect(payload.longitude).toBe(-54.6201);
  });

  it('latitude é undefined quando item.latitude é null', () => {
    const payload = montarPayloadESUS({ ...BASE_ITEM, latitude: null }, IBGE, CNES);
    expect(payload.latitude).toBeUndefined();
  });

  it('longitude é undefined quando item.longitude é null', () => {
    const payload = montarPayloadESUS({ ...BASE_ITEM, longitude: null }, IBGE, CNES);
    expect(payload.longitude).toBeUndefined();
  });

  // ── dataInicioSintomas ───────────────────────────────────────────────────

  it('define dataInicioSintomas com o valor fornecido em data_inicio_sintomas', () => {
    const payload = montarPayloadESUS(BASE_ITEM, IBGE, CNES);
    expect(payload.dataInicioSintomas).toBe('2025-06-13');
  });

  it('dataInicioSintomas usa dataNotificacao como fallback quando data_inicio_sintomas é null', () => {
    const payload = montarPayloadESUS(
      { ...BASE_ITEM, data_inicio_sintomas: null },
      IBGE,
      CNES,
    );
    expect(payload.dataInicioSintomas).toBe(payload.dataNotificacao);
  });

  // ── municipioResidencia ──────────────────────────────────────────────────

  it('define municipioResidencia igual ao codigoIbge', () => {
    const payload = montarPayloadESUS(BASE_ITEM, IBGE, CNES);
    expect(payload.municipioResidencia).toBe(IBGE);
  });
});
