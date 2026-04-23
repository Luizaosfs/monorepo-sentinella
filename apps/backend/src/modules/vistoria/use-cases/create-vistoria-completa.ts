import { Inject, Injectable, Logger } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { CriarFocoDeVistoriaDeposito } from '@/modules/foco-risco/use-cases/auto-criacao/criar-foco-de-vistoria-deposito';

import { CreateVistoriaCompletaBody } from '../dtos/create-vistoria-completa.body';
import { Vistoria } from '../entities/vistoria';
import { VistoriaWriteRepository } from '../repositories/vistoria-write.repository';
import { ConsolidarVistoria } from './consolidar-vistoria';

@Injectable()
export class CreateVistoriaCompleta {
  private readonly logger = new Logger(CreateVistoriaCompleta.name);

  constructor(
    private writeRepository: VistoriaWriteRepository,
    private criarFocoDeVistoriaDeposito: CriarFocoDeVistoriaDeposito,
    @Inject(REQUEST) private req: Request,
    private consolidarVistoria: ConsolidarVistoria,
  ) {}

  async execute(data: CreateVistoriaCompletaBody): Promise<{ id: string }> {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = this.req['tenantId'] as string;

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

    return { id };
  }
}
