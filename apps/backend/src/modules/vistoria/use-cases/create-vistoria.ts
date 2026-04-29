import { Inject, Injectable, Logger } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { QuotaException } from '../../billing/errors/quota.exception';
import { VerificarQuota } from '../../billing/use-cases/verificar-quota';
import { IniciarInspecao } from '../../foco-risco/use-cases/iniciar-inspecao';
import { EnfileirarScoreImovel } from '../../job/enfileirar-score-imovel';
import { CreateVistoriaBody } from '../dtos/create-vistoria.body';
import { ValidarCicloVistoria } from './validar-ciclo-vistoria';
import { Vistoria } from '../entities/vistoria';
import { VistoriaReadRepository } from '../repositories/vistoria-read.repository';
import { VistoriaWriteRepository } from '../repositories/vistoria-write.repository';
import { AtualizarPerfilImovel } from './atualizar-perfil-imovel';
import { ConsolidarVistoria } from './consolidar-vistoria';

@Injectable()
export class CreateVistoria {
  private readonly logger = new Logger(CreateVistoria.name);

  constructor(
    private readRepository: VistoriaReadRepository,
    private writeRepository: VistoriaWriteRepository,
    @Inject(REQUEST) private req: Request,
    private consolidarVistoria: ConsolidarVistoria,
    private enfileirarScore: EnfileirarScoreImovel,
    private verificarQuota: VerificarQuota,
    private validarCicloVistoria: ValidarCicloVistoria,
    private iniciarInspecao: IniciarInspecao,
    private atualizarPerfilImovel: AtualizarPerfilImovel,
  ) {}

  async execute(data: CreateVistoriaBody) {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = requireTenantId(getAccessScope(this.req));

    // G.6 — rejeita ciclo diferente do ativo
    await this.validarCicloVistoria.execute(clienteId, data.ciclo);

    // Fase I — enforcement de quota
    const { ok, usado, limite, motivo } = await this.verificarQuota.execute(clienteId, { metrica: 'vistorias_mes' });
    if (!ok) throw QuotaException.excedida({ metrica: 'vistorias_mes', usado, limite, motivo });

    const vistoria = new Vistoria(
      {
        clienteId,
        imovelId: data.imovelId,
        agenteId: (data.agenteId ?? (this.req['user'] as any)?.id) as string,
        planejamentoId: data.planejamentoId,
        ciclo: data.ciclo,
        tipoAtividade: data.tipoAtividade,
        dataVisita: data.dataVisita,
        status: data.status ?? 'pendente',
        moradoresQtd: data.moradoresQtd,
        gravidas: data.gravidas ?? false,
        idosos: data.idosos ?? false,
        criancas7anos: data.criancas7anos ?? false,
        latChegada: data.latChegada,
        lngChegada: data.lngChegada,
        checkinEm: data.checkinEm,
        observacao: data.observacao,
        payload: data.payload,
        acessoRealizado: data.acessoRealizado ?? true,
        motivoSemAcesso: data.motivoSemAcesso,
        proximoHorarioSugerido: data.proximoHorarioSugerido,
        observacaoAcesso: data.observacaoAcesso,
        fotoExternaUrl: data.fotoExternaUrl,
        origemVisita: data.origemVisita,
        habitatSelecionado: data.habitatSelecionado,
        condicaoHabitat: data.condicaoHabitat,
        assinaturaResponsavelUrl: data.assinaturaResponsavelUrl,
        assinaturaPublicId: data.assinaturaPublicId,
        fotoExternaPublicId: data.fotoExternaPublicId,
        focoRiscoId: data.focoRiscoId,
        pendenteAssinatura: data.pendenteAssinatura ?? false,
        pendenteFoto: data.pendenteFoto ?? false,
        origemOffline: data.origemOffline ?? false,
        idempotencyKey: data.idempotencyKey,
        consolidacaoIncompleta: false,
      },
      {},
    );

    const created = await this.writeRepository.create(vistoria);

    if (data.depositos?.length) {
      for (const dep of data.depositos) {
        await this.writeRepository.createDeposito({ ...dep, vistoriaId: created.id!, clienteId });
      }
    }
    if (data.sintomas?.length) {
      for (const sint of data.sintomas) {
        await this.writeRepository.createSintoma({ ...sint, vistoriaId: created.id!, clienteId });
      }
    }
    if (data.riscos?.length) {
      for (const risco of data.riscos) {
        await this.writeRepository.createRisco({ ...risco, vistoriaId: created.id!, clienteId });
      }
    }
    if (data.calhas?.length) {
      for (const calha of data.calhas) {
        await this.writeRepository.createCalha({ ...calha, vistoriaId: created.id!, clienteId });
      }
    }

    // K.3 — fn_auto_em_inspecao_por_vistoria: vincula inspeção ao foco (best-effort)
    if (created.focoRiscoId) {
      try {
        await this.iniciarInspecao.execute(created.focoRiscoId, {});
      } catch (err) {
        this.logger.error(
          `[CreateVistoria] Hook IniciarInspecao falhou para foco ${created.focoRiscoId}: ${(err as Error).message}`,
        );
      }
    }

    // K.4 — fn_atualizar_perfil_imovel: dispara em TODO INSERT (trigger SQL não filtra por acessoRealizado)
    if (created.imovelId) {
      try {
        await this.atualizarPerfilImovel.execute({
          imovelId: created.imovelId,
          vistoriaId: created.id!,
          agenteId: created.agenteId ?? null,
          clienteId,
        });
      } catch (err) {
        this.logger.error(
          `[CreateVistoria] Hook AtualizarPerfilImovel falhou para imovel ${created.imovelId}: ${(err as Error).message}`,
        );
      }
    }

    try {
      await this.consolidarVistoria.execute({
        vistoriaId: created.id!,
        motivo: 'automático — INSERT em vistorias',
      });
    } catch (err) {
      this.logger.error(
        `Hook ConsolidarVistoria falhou: vistoriaId=${created.id!} erro=${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    // Fase F.1.B — enfileira recálculo do score territorial do imóvel (best-effort)
    if (created.imovelId && (data.acessoRealizado ?? true) === true) {
      try {
        await this.enfileirarScore.enfileirarPorImovel(created.imovelId, clienteId);
      } catch (err) {
        this.logger.error(
          `[CreateVistoria] Falha ao enfileirar score do imóvel ${created.imovelId}: ${(err as Error).message}`,
          (err as Error).stack,
        );
      }
    }

    const full = await this.readRepository.findByIdComDetalhes(created.id!, clienteId);
    return { vistoria: full! };
  }
}
