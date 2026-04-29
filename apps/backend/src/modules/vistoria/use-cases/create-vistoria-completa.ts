import { Inject, Injectable, Logger } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { CriarFocoDeVistoriaDeposito } from '@/modules/foco-risco/use-cases/auto-criacao/criar-foco-de-vistoria-deposito';
import { QuotaException } from '../../billing/errors/quota.exception';
import { VerificarQuota } from '../../billing/use-cases/verificar-quota';
import { EnfileirarScoreImovel } from '../../job/enfileirar-score-imovel';

import { CreateVistoriaCompletaBody } from '../dtos/create-vistoria-completa.body';
import { ValidarCicloVistoria } from './validar-ciclo-vistoria';
import { Vistoria } from '../entities/vistoria';
import { VistoriaWriteRepository } from '../repositories/vistoria-write.repository';
import { AtualizarPerfilImovel } from './atualizar-perfil-imovel';
import { ConsolidarVistoria } from './consolidar-vistoria';

@Injectable()
export class CreateVistoriaCompleta {
  private readonly logger = new Logger(CreateVistoriaCompleta.name);

  constructor(
    private writeRepository: VistoriaWriteRepository,
    private criarFocoDeVistoriaDeposito: CriarFocoDeVistoriaDeposito,
    @Inject(REQUEST) private req: Request,
    private consolidarVistoria: ConsolidarVistoria,
    private enfileirarScore: EnfileirarScoreImovel,
    private verificarQuota: VerificarQuota,
    private validarCicloVistoria: ValidarCicloVistoria,
    private atualizarPerfilImovel: AtualizarPerfilImovel,
  ) {}

  async execute(data: CreateVistoriaCompletaBody): Promise<{ id: string }> {
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

    const id = await this.writeRepository.createCompleta(
      vistoria,
      {
        depositos: data.depositos,
        sintomas: data.sintomas,
        riscos: data.riscos,
        calhas: data.calhas,
      },
      data.idempotencyKey,
    );

    // Hook C.3: após commit da tx, criar foco a partir do primeiro depósito
    // com foco. O break garante dedup em 1 foco por vistoria mesmo sem trigger
    // auto-atualizando vistorias.foco_risco_id.
    const depositos = data.depositos ?? [];
    for (const dep of depositos) {
      // depositoToPrisma mapeia `comLarva ? 1 : 0` para qtd_com_focos
      if (dep.comLarva) {
        try {
          await this.criarFocoDeVistoriaDeposito.execute({
            vistoriaId: id,
            qtdComFocos: 1,
          });
        } catch (err) {
          this.logger.error(
            `Hook CriarFocoDeVistoriaDeposito falhou: vistoria=${id} erro=${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
        break;
      }
    }

    // Hook C.8.A: consolidar vistoria após commit de vistoria + todas sub-tabelas.
    // Dispara EXATAMENTE 1 vez (anti-recursão — paridade com pg_trigger_depth() > 1 do SQL legado).
    try {
      await this.consolidarVistoria.execute({
        vistoriaId: id,
        motivo: 'automático — INSERT em vistorias',
      });
    } catch (err) {
      this.logger.error(
        `Hook ConsolidarVistoria falhou: vistoriaId=${id} erro=${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    // K.4 — fn_atualizar_perfil_imovel: dispara em TODO INSERT
    if (data.imovelId) {
      try {
        await this.atualizarPerfilImovel.execute({
          imovelId: data.imovelId,
          vistoriaId: id,
          agenteId: data.agenteId ?? null,
          clienteId,
        });
      } catch (err) {
        this.logger.error(
          `[CreateVistoriaCompleta] Hook AtualizarPerfilImovel falhou para imovel ${data.imovelId}: ${(err as Error).message}`,
        );
      }
    }

    // Fase F.1.B — enfileira recálculo do score territorial do imóvel (best-effort)
    if (data.imovelId && (data.acessoRealizado ?? true) === true) {
      try {
        await this.enfileirarScore.enfileirarPorImovel(data.imovelId, clienteId);
      } catch (err) {
        this.logger.error(
          `[CreateVistoriaCompleta] Falha ao enfileirar score do imóvel ${data.imovelId}: ${(err as Error).message}`,
          (err as Error).stack,
        );
      }
    }

    return { id };
  }
}
