import { Injectable } from '@nestjs/common';

import { PluvioReadRepository } from '../../pluvio/repositories/pluvio-read.repository';

const LIMITE_CHUVA_MM = 5;
const LIMITE_VENTO_KMH = 25;
const RISCO_IMPEDITIVO = ['alto', 'critico'];

@Injectable()
export class AvaliarCondicoesVoo {
  constructor(private pluvioReadRepository: PluvioReadRepository) {}

  async execute(clienteId: string, data: Date) {
    const dados = await this.pluvioReadRepository.findRiscoByClienteEData(clienteId, data);

    const motivos: string[] = [];

    const maxChuva = dados.reduce((m, d) => Math.max(m, d.chuva24h), 0);
    const maxVento = dados.reduce((m, d) => Math.max(m, d.ventoKmh), 0);
    const maxChuvaD1 = dados.reduce((m, d) => Math.max(m, d.prevD1Mm ?? 0), 0);
    const piorRisco = dados.find((d) => d.classificacaoFinal && RISCO_IMPEDITIVO.includes(d.classificacaoFinal));

    if (maxChuva > LIMITE_CHUVA_MM)
      motivos.push(`Precipitação nas últimas 24h: ${maxChuva.toFixed(1)}mm (limite: ${LIMITE_CHUVA_MM}mm)`);

    if (maxVento > LIMITE_VENTO_KMH)
      motivos.push(`Vento acima do permitido: ${maxVento.toFixed(1)} km/h (limite: ${LIMITE_VENTO_KMH} km/h)`);

    if (piorRisco)
      motivos.push(`Risco pluviométrico ${piorRisco.classificacaoFinal} na área de operação`);

    if (maxChuvaD1 > 10)
      motivos.push(`Previsão de chuva para amanhã: ${maxChuvaD1.toFixed(1)}mm`);

    return {
      apto: motivos.length === 0,
      motivos,
      dados: {
        chuva24hMax: maxChuva,
        ventoKmhMax: maxVento,
        prevD1MmMax: maxChuvaD1,
        regioes: dados.length,
      },
    };
  }
}
