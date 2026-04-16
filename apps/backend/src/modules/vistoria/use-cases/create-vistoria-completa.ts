import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { CreateVistoriaCompletaBody } from '../dtos/create-vistoria-completa.body';
import { Vistoria } from '../entities/vistoria';
import { VistoriaWriteRepository } from '../repositories/vistoria-write.repository';

@Injectable()
export class CreateVistoriaCompleta {
  constructor(
    private writeRepository: VistoriaWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(data: CreateVistoriaCompletaBody): Promise<{ id: string }> {
    const clienteId = (data.clienteId ?? this.req['tenantId']) as string;

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

    return { id };
  }
}
