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
  pesoSlaVencido: 12,
  pesoVistoriaNegativa: -8,
  pesoImovelRecusa: 8,
  pesoFocoResolvido: -15,
  janelaDias: 30,
};

const SUSPEITA_STATUSES = ['suspeita', 'em_triagem', 'aguarda_inspecao', 'em_inspecao'];

function classificar(score: number): string {
  if (score <= 25) return 'baixo';
  if (score <= 50) return 'medio';
  if (score <= 75) return 'alto';
  return 'critico';
}

@Injectable()
export class CalcularScore {
  constructor(
    private readRepository: ImovelReadRepository,
    private writeRepository: ImovelWriteRepository,
  ) {}

  async execute(imovelId: string, clienteId: string) {
    const inputs = await this.readRepository.findScoreInputs(imovelId, clienteId);
    if (!inputs.imovel) throw ImovelException.notFound();

    const cfg = inputs.config ?? DEFAULTS;

    const focosSuspeita = inputs.focosAtivos.filter((f) => SUSPEITA_STATUSES.includes(f.status));
    const focosConfirmado = inputs.focosAtivos.filter((f) => f.status === 'confirmado');
    const focosEmTratamento = inputs.focosAtivos.filter((f) => f.status === 'em_tratamento');
    const focosRecorrentes = inputs.focosAtivos.filter((f) => f.focoAnteriorId != null);

    let score = 0;
    score += focosSuspeita.length * cfg.pesoFocoSuspeito;
    score += focosConfirmado.length * cfg.pesoFocoConfirmado;
    score += focosEmTratamento.length * cfg.pesoFocoEmTratamento;
    score += focosRecorrentes.length * cfg.pesoFocoRecorrente;
    if (inputs.historicoFocosCount >= 3) score += cfg.pesoHistorico3focos;
    score += inputs.focosResolvidosCount * cfg.pesoFocoResolvido;
    score += inputs.casosProximosCount * cfg.pesoCaso300m;
    score += inputs.slaVencidosCount * cfg.pesoSlaVencido;
    score += inputs.vistoriasNegativasCount * cfg.pesoVistoriaNegativa;
    if (inputs.imovel.historicoRecusa) score += cfg.pesoImovelRecusa;

    score = Math.max(0, Math.min(100, Math.round(score)));
    const classificacao = classificar(score);

    const fatores = {
      focosSuspeita: focosSuspeita.length,
      focosConfirmado: focosConfirmado.length,
      focosEmTratamento: focosEmTratamento.length,
      focosRecorrentes: focosRecorrentes.length,
      historicoFocos: inputs.historicoFocosCount,
      focosResolvidos: inputs.focosResolvidosCount,
      casosProximos: inputs.casosProximosCount,
      slaVencidos: inputs.slaVencidosCount,
      vistoriasNegativas: inputs.vistoriasNegativasCount,
      historicoRecusa: inputs.imovel.historicoRecusa,
    };

    await this.writeRepository.upsertScore({ clienteId, imovelId, score, classificacao, fatores });

    return { score, classificacao, fatores };
  }
}
