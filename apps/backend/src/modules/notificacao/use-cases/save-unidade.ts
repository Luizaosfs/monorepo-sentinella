import { Injectable } from '@nestjs/common';

import { SaveUnidadeBody } from '../dtos/create-notificacao.body';
import { UnidadeSaude } from '../entities/notificacao';
import { NotificacaoException } from '../errors/notificacao.exception';
import { NotificacaoReadRepository } from '../repositories/notificacao-read.repository';
import { NotificacaoWriteRepository } from '../repositories/notificacao-write.repository';

@Injectable()
export class SaveUnidade {
  constructor(
    private readRepository: NotificacaoReadRepository,
    private writeRepository: NotificacaoWriteRepository,
  ) {}

  async execute(id: string, input: SaveUnidadeBody, clienteId: string | null): Promise<{ unidade: UnidadeSaude }> {
    const unidade = await this.readRepository.findUnidadeById(id, clienteId);
    if (!unidade) throw NotificacaoException.unidadeNotFound();

    if (input.nome !== undefined) unidade.nome = input.nome;
    if (input.tipo !== undefined) unidade.tipo = input.tipo;
    if (input.endereco !== undefined) unidade.endereco = input.endereco;
    if (input.latitude !== undefined) unidade.latitude = input.latitude;
    if (input.longitude !== undefined) unidade.longitude = input.longitude;
    if (input.cnes !== undefined) unidade.cnes = input.cnes;
    if (input.tipoSentinela !== undefined) unidade.tipoSentinela = input.tipoSentinela;
    if (input.telefone !== undefined) unidade.telefone = input.telefone;
    if (input.bairro !== undefined) unidade.bairro = input.bairro;
    if (input.municipio !== undefined) unidade.municipio = input.municipio;
    if (input.uf !== undefined) unidade.uf = input.uf;
    if (input.ativo !== undefined) unidade.ativo = input.ativo;

    await this.writeRepository.saveUnidade(unidade);
    return { unidade };
  }
}
