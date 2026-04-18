import { http } from '@sentinella/api-client';

const DEFAULT_POLICY_JSON = {
  defaults: {
    chuva_relevante_mm: 5.0,
    dias_lookup_max: 30,
    tendencia_dias: 7,
    janela_sem_chuva_bins: [[0, 3], [4, 6], [7, 10], [11, 15], [16, 999]],
    intensidade_chuva_bins: [[0, 5], [5, 10], [10, 20], [10, 30], [20, 999]],
    persistencia_7d_bins: [[0, 1], [2, 3], [4, 5], [6, 7]],
  },
  fallback_rule: {
    situacao_ambiental: 'Sem regra',
    probabilidade_label: 'Media',
    probabilidade_pct_min: 40,
    probabilidade_pct_max: 60,
    classificacao: 'Moderado',
    icone: '🟠',
    severity: 3,
  },
  rules: [
    { chuva_mm_min: 0, chuva_mm_max: 5, dias_min: 0, dias_max: 999, situacao_ambiental: 'Sem criadouro relevante', probabilidade_label: 'Muito baixa', probabilidade_pct_min: 0, probabilidade_pct_max: 10, classificacao: 'Baixo', icone: '🟢', severity: 1 },
    { chuva_mm_min: 5, chuva_mm_max: 10, dias_min: 0, dias_max: 3, situacao_ambiental: 'Agua insuficiente', probabilidade_label: 'Baixa', probabilidade_pct_min: 10, probabilidade_pct_max: 25, classificacao: 'Baixo', icone: '🟢', severity: 2 },
    { chuva_mm_min: 10, chuva_mm_max: 20, dias_min: 2, dias_max: 4, situacao_ambiental: 'Criadouros iniciando', probabilidade_label: 'Media', probabilidade_pct_min: 25, probabilidade_pct_max: 50, classificacao: 'Atencao', icone: '🟡', severity: 3 },
    { chuva_mm_min: 10, chuva_mm_max: 30, dias_min: 4, dias_max: 6, situacao_ambiental: 'Larvas ativas', probabilidade_label: 'Media/Alta', probabilidade_pct_min: 45, probabilidade_pct_max: 70, classificacao: 'Moderado', icone: '🟠', severity: 4 },
    { chuva_mm_min: 20, chuva_mm_max: 30, dias_min: 0, dias_max: 1, situacao_ambiental: 'Agua recente acumulada', probabilidade_label: 'Baixa/Media', probabilidade_pct_min: 20, probabilidade_pct_max: 35, classificacao: 'Atencao', icone: '🟡', severity: 2 },
    { chuva_mm_min: 30, chuva_mm_max: 999, dias_min: 0, dias_max: 1, situacao_ambiental: 'Agua acumulada recente', probabilidade_label: 'Baixa/Media', probabilidade_pct_min: 25, probabilidade_pct_max: 40, classificacao: 'Atencao', icone: '🟡', severity: 3 },
    { chuva_mm_min: 30, chuva_mm_max: 999, dias_min: 2, dias_max: 3, situacao_ambiental: 'Criadouros em formacao', probabilidade_label: 'Media', probabilidade_pct_min: 30, probabilidade_pct_max: 55, classificacao: 'Moderado', icone: '🟠', severity: 3 },
    { chuva_mm_min: 30, chuva_mm_max: 999, dias_min: 4, dias_max: 6, situacao_ambiental: 'Larvas em desenvolvimento', probabilidade_label: 'Media/Alta', probabilidade_pct_min: 55, probabilidade_pct_max: 75, classificacao: 'Moderado', icone: '🟠', severity: 4 },
    { chuva_mm_min: 20, chuva_mm_max: 999, dias_min: 7, dias_max: 10, situacao_ambiental: 'Adultos emergindo', probabilidade_label: 'Alta', probabilidade_pct_min: 70, probabilidade_pct_max: 85, classificacao: 'Alto', icone: '🔴', severity: 5 },
    { chuva_mm_min: 20, chuva_mm_max: 999, dias_min: 11, dias_max: 15, situacao_ambiental: 'Transmissao ativa', probabilidade_label: 'Muito alta', probabilidade_pct_min: 85, probabilidade_pct_max: 95, classificacao: 'Critico', icone: '🔴', severity: 6 },
    { chuva_mm_min: 20, chuva_mm_max: 999, dias_min: 16, dias_max: 999, situacao_ambiental: 'Ciclo continuo', probabilidade_label: 'Alta recorrente', probabilidade_pct_min: 75, probabilidade_pct_max: 90, classificacao: 'Alto', icone: '🔴', severity: 5 },
  ],
  temp_factors: [
    { temp_min: -50, temp_max: 19.9, factor: 0.85 },
    { temp_min: 20, temp_max: 24.9, factor: 0.95 },
    { temp_min: 25, temp_max: 30, factor: 1.1 },
    { temp_min: 30.1, temp_max: 34, factor: 1.05 },
    { temp_min: 34.1, temp_max: 60, factor: 0.85 },
  ],
  vento_factors: [
    { vento_min: 0, vento_max: 5, factor: 1.05 },
    { vento_min: 6, vento_max: 12, factor: 1.0 },
    { vento_min: 13, vento_max: 20, factor: 0.95 },
    { vento_min: 20.1, vento_max: 200, factor: 0.85 },
  ],
  temp_adjust_pp: [
    { temp_min: -50, temp_max: 17.9, delta_pp: -10 },
    { temp_min: 18, temp_max: 21.9, delta_pp: -5 },
    { temp_min: 22, temp_max: 27.9, delta_pp: 10 },
    { temp_min: 28, temp_max: 31.9, delta_pp: 5 },
    { temp_min: 32, temp_max: 60, delta_pp: 0 },
  ],
  vento_adjust_pp: [
    { vento_min: 0, vento_max: 7.9, delta_pp: 0 },
    { vento_min: 8, vento_max: 14.9, delta_pp: -3 },
    { vento_min: 15, vento_max: 24.9, delta_pp: -6 },
    { vento_min: 25, vento_max: 200, delta_pp: -10 },
  ],
  persistencia_adjust_pp: [
    { dias_min: 0, dias_max: 1, delta_pp: 0 },
    { dias_min: 2, dias_max: 3, delta_pp: 3 },
    { dias_min: 4, dias_max: 5, delta_pp: 6 },
    { dias_min: 6, dias_max: 7, delta_pp: 10 },
  ],
  tendencia_adjust_pp: [
    { tendencia: 'crescente', delta_pp: 5 },
    { tendencia: 'estavel', delta_pp: 0 },
    { tendencia: 'decrescente', delta_pp: -5 },
  ],
};

/**
 * Creates a default risk policy with all child data for a newly created client.
 * Silently fails (logs to console) so it doesn't block client creation.
 */
export async function seedDefaultRiskPolicy(clienteId: string): Promise<void> {
  try {
    await http.post('/seed/risk-policy', { clienteId, policy: DEFAULT_POLICY_JSON });
  } catch (err) {
    console.error('[seedDefaultRiskPolicy] Erro ao criar política padrão:', err);
  }
}
