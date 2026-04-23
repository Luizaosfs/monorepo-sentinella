import { Injectable } from '@nestjs/common';

import { ImovelException } from '../errors/imovel.exception';
import { ImovelReadRepository, ScoreConfig } from '../repositories/imovel-read.repository';
import { ImovelWriteRepository } from '../repositories/imovel-write.repository';

const DEFAULTS: ScoreConfig = {
  pesoFocoSuspeito: 10,
  pesoFocoConfirmado: 25,
  pesoFocoEmTratamento: 20,
  pesoFocoRecorrente: 35,
  pesoHistorico3focos: 15,
  pesoCaso300m: 25,
  pesoChuvaAlta: 10,
  pesoTemperatura30: 8,
  pesoDenunciaCidadao: 10,
  pesoSlaVencido: 12,
  pesoVistoriaNegativa: -8,
  pesoImovelRecusa: 8,
  pesoFocoResolvido: -15,
  janelaResolucaoDias: 30,
  janelaVistoriaDias: 45,
  janelaCasoDias: 60,
  capFocos: 40,
  capEpidemio: 30,
  capHistorico: 20,
};

const SUSPEITA_STATUSES = ['suspeita', 'em_triagem', 'aguarda_inspecao', 'em_inspecao'];

function classificar(score: number): string {
  if (score >= 81) return 'critico';
  if (score >= 61) return 'muito_alto';
  if (score >= 41) return 'alto';
  if (score >= 21) return 'medio';
  return 'baixo';
}

@Injectable()
export class CalcularScore {
  constructor(
    private readRepository: ImovelReadRepository,
    private writeRepository: ImovelWriteRepository,
  ) {}

  async execute(imovelId: string, clienteId: string) {
    // SQL Bloco 1: lê primeiro, seed apenas se config ausente, depois re-lê
    const inputs = await this.readRepository.findScoreInputs(imovelId, clienteId);
    if (!inputs.imovel) throw ImovelException.notFound();

    let cfg = inputs.config;
    if (cfg === null) {
      await this.writeRepository.seedScoreConfigIfMissing(clienteId);
      cfg = await this.readRepository.findScoreConfig(clienteId);
    }
    cfg = cfg ?? DEFAULTS;

    // SQL 2.1: suspeita e variantes
    const focosSuspeita = inputs.focosAtivos.filter((f) => SUSPEITA_STATUSES.includes(f.status));
    // SQL 2.2: confirmado + em_tratamento contados juntos com pesoFocoConfirmado
    const focosConfirmado = inputs.focosAtivos.filter(
      (f) => f.status === 'confirmado' || f.status === 'em_tratamento',
    );
    // SQL 2.3: recorrentes (foco_anterior_id NOT NULL)
    const focosRecorrentes = inputs.focosAtivos.filter((f) => f.focoAnteriorId != null);

    // SQL 3.1: pontosFocos — pesoFocoEmTratamento é campo órfão, não usado no cálculo
    const pontosFocos = Math.min(
      focosSuspeita.length * cfg.pesoFocoSuspeito +
        focosConfirmado.length * cfg.pesoFocoConfirmado +
        focosRecorrentes.length * cfg.pesoFocoRecorrente,
      cfg.capFocos,
    );

    // SQL 3.2: pontosHist — apenas historicoFocosCount >= 3
    const pontosHist = Math.min(
      inputs.historicoFocosCount >= 3 ? cfg.pesoHistorico3focos : 0,
      cfg.capHistorico,
    );

    // SQL 3.3: pontosEpidem — inclui imovelRecusa e slaVencido (com LEAST individuais)
    const pontosEpidem = Math.min(
      Math.min(inputs.casosProximosCount, 2) * cfg.pesoCaso300m +
        (inputs.chuvaAlta ? cfg.pesoChuvaAlta : 0) +
        (inputs.tempAlta ? cfg.pesoTemperatura30 : 0) +
        Math.min(inputs.denunciaCidadaoCount, 2) * cfg.pesoDenunciaCidadao +
        (inputs.imovel.historicoRecusa ? cfg.pesoImovelRecusa : 0) +
        Math.min(inputs.slaVencidosCount, 2) * cfg.pesoSlaVencido,
      cfg.capEpidemio,
    );

    // SQL 3.4: score bruto dos 3 grupos
    let score = pontosFocos + pontosHist + pontosEpidem;

    // SQL 3.5: subtrações FORA dos caps (aplicadas após soma dos grupos)
    const vistoriaNegativa = inputs.vistoriasNegativasCount > 0;
    score +=
      Math.min(inputs.focosResolvidosCount, 3) * cfg.pesoFocoResolvido +
      (vistoriaNegativa ? cfg.pesoVistoriaNegativa : 0);

    // SQL 3.6: clamp [0, 100] + arredondamento
    score = Math.max(0, Math.min(100, Math.round(score)));

    const classificacao = classificar(score);

    const fatores: Record<string, unknown> = {
      focos_ativos: focosSuspeita.length,
      focos_confirmados: focosConfirmado.length,
      focos_recorrentes: focosRecorrentes.length,
      focos_historico: inputs.historicoFocosCount,
      focos_resolvidos_recentes: inputs.focosResolvidosCount,
      casos_proximos: inputs.casosProximosCount,
      chuva_alta: inputs.chuvaAlta,
      temp_alta: inputs.tempAlta,
      denuncia_cidadao: inputs.denunciaCidadaoCount,
      imovel_recusa: inputs.imovel.historicoRecusa,
      sla_vencido: inputs.slaVencidosCount,
      vistoria_negativa: vistoriaNegativa,
      pontos_focos: pontosFocos,
      pontos_epidem: pontosEpidem,
      pontos_hist: pontosHist,
    };

    await this.writeRepository.upsertScore({ clienteId, imovelId, score, classificacao, fatores });

    return { score, classificacao, fatores };
  }
}
