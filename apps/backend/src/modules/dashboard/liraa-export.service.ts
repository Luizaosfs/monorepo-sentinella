import { Injectable } from '@nestjs/common';

import { CalcularLiraa } from './use-cases/calcular-liraa';

@Injectable()
export class LiraaExportService {
  constructor(private calcularLiraa: CalcularLiraa) {}

  async exportCsv(clienteId: string, ciclo: number): Promise<string> {
    const { regioes } = await (this.calcularLiraa as any).execute(clienteId, ciclo);

    const header = [
      'Região',
      'Total Imóveis',
      'Imóveis Trabalhados',
      'Imóveis Positivos',
      'IIP (%)',
      'Classificação',
    ].join(';');

    const rows = regioes.map((r: any) =>
      [
        r.regiaoNome ?? r.regiao_id,
        r.totalImoveis,
        r.imoveisTrabalhados,
        r.imoveisPositivos,
        r.iip?.toFixed(2) ?? '0.00',
        r.classificacao ?? '',
      ].join(';'),
    );

    return [header, ...rows].join('\n');
  }
}
