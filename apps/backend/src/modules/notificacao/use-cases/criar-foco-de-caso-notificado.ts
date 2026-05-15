import { Injectable, Logger } from '@nestjs/common';

import {
  FocoRisco,
  FocoRiscoHistorico,
} from '../../foco-risco/entities/foco-risco';
import { FocoRiscoWriteRepository } from '../../foco-risco/repositories/foco-risco-write.repository';
import { NotificacaoWriteRepository } from '../repositories/notificacao-write.repository';

function calcCiclo(): number {
  return Math.ceil((new Date().getMonth() + 1) / 2);
}

/**
 * Mapeia o status clínico do caso para a prioridade operacional do foco.
 * 'confirmado' → P1 (4h): caso lab-confirmado é sinal de surto ativo.
 * demais       → P2 (12h): profissional de saúde avaliou; mais urgente que denúncia de cidadão (P3).
 */
function calcPrioridade(statusCaso?: string): 'P1' | 'P2' {
  return statusCaso === 'confirmado' ? 'P1' : 'P2';
}

export interface CriarFocoDeCasoNotificadoInput {
  casoId: string;
  clienteId: string;
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  regiaoId?: string | null;
  /** Status clínico do caso ('suspeito' | 'confirmado'). Determina prioridade inicial do foco. */
  statusCaso?: string;
  /** Bairro resolvido geoespacialmente — precede regiaoId (seleção manual). */
  bairroId?: string | null;
  /** Quadra resolvida geoespacialmente pelo lat/long. */
  quadraId?: string | null;
  /** Agente territorial responsável pré-atribuído ao foco. */
  responsavelId?: string | null;
}

export interface CriarFocoDeCasoNotificadoResult {
  focoId: string | null;
}

/**
 * E.1.1 — Cria foco epidemiológico quando nenhum foco ativo existe no raio de busca.
 *
 * Se o caso tem coordenadas: cria foco com origem_tipo='caso_notificado', status='em_triagem'
 * e vincula via NotificacaoWriteRepository.vincularFoco (campo permanente — não apagado ao
 * descartar o caso, preservando rastreabilidade epidemiológica e de auditoria).
 *
 * Se o caso não tem coordenadas: registra foco_vinculo_tipo='pendente_geocodificacao'.
 * O caso permanece rastreável e auditável na fila do supervisor sem criar foco órfão.
 *
 * Compatibilidade futura (fusão epidemiológica ↔ operacional): o foco nasce no FSM normal
 * (em_triagem → confirmado → em_tratamento…). Quando um agente encontrar depósito real,
 * o supervisor vincula a vistoria a este foco existente — sem criar duplicata.
 */
@Injectable()
export class CriarFocoDeCasoNotificado {
  private readonly logger = new Logger(CriarFocoDeCasoNotificado.name);

  constructor(
    private focoRiscoWriteRepository: FocoRiscoWriteRepository,
    private notificacaoWriteRepository: NotificacaoWriteRepository,
  ) {}

  async execute(
    input: CriarFocoDeCasoNotificadoInput,
  ): Promise<CriarFocoDeCasoNotificadoResult> {
    const { casoId, clienteId, latitude, longitude, regiaoId, statusCaso } =
      input;
    const { bairroId, quadraId, responsavelId } = input;

    if (latitude == null || longitude == null) {
      await this.notificacaoWriteRepository.vincularFoco(casoId, {
        focoRiscoId: null,
        vinculadoEm: null,
        vinculoTipo: 'pendente_geocodificacao',
        distanciaMetros: null,
      });
      this.logger.debug(
        `Caso ${casoId} sem coordenadas — marcado como pendente_geocodificacao`,
      );
      return { focoId: null };
    }

    const suspeitaEm = new Date();

    // FocoRiscoWriteRepository.create() chama gerarCodigoFoco internamente
    // quando codigoFoco não está preenchido — sem acoplamento a PrismaService aqui.
    const foco = new FocoRisco(
      {
        clienteId,
        origemTipo: 'caso_notificado',
        classificacaoInicial: 'caso_notificado',
        status: 'em_triagem',
        prioridade: calcPrioridade(statusCaso),
        ciclo: calcCiclo(),
        latitude,
        longitude,
        suspeitaEm,
        casosIds: [casoId],
        regiaoId: bairroId ?? regiaoId ?? undefined,
        quadraId: quadraId ?? undefined,
        responsavelId: responsavelId ?? undefined,
        scorePrioridade: 0,
        payload: { confirmacoes: 1 },
      },
      {},
    );

    const created = await this.focoRiscoWriteRepository.create(foco);

    // Histórico inicial (fire-and-forget — falha não bloqueia o fluxo)
    const historico: FocoRiscoHistorico = {
      focoRiscoId: created.id,
      clienteId,
      statusAnterior: undefined,
      statusNovo: 'em_triagem',
      tipoEvento: 'criacao',
      motivo:
        'Foco epidemiológico criado automaticamente a partir de caso notificado',
    };
    this.focoRiscoWriteRepository.createHistorico(historico).catch(() => null);

    // Vínculo operacional principal — via repositório do domínio notificacao
    await this.notificacaoWriteRepository.vincularFoco(casoId, {
      focoRiscoId: created.id!,
      vinculadoEm: new Date(),
      vinculoTipo: 'criado_por_caso',
      distanciaMetros: 0,
    });

    this.logger.log(
      `Foco epidemiológico ${created.id} criado a partir do caso ${casoId}`,
    );

    return { focoId: created.id! };
  }
}
