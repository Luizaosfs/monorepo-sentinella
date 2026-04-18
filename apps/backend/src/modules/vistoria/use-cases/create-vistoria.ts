import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { CreateVistoriaBody } from '../dtos/create-vistoria.body';
import { Vistoria } from '../entities/vistoria';
import { VistoriaReadRepository } from '../repositories/vistoria-read.repository';
import { VistoriaWriteRepository } from '../repositories/vistoria-write.repository';

@Injectable()
export class CreateVistoria {
  constructor(
    private readRepository: VistoriaReadRepository,
    private writeRepository: VistoriaWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(data: CreateVistoriaBody) {
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

    const full = await this.readRepository.findByIdComDetalhes(created.id!);
    return { vistoria: full! };
  }
}
