import { Injectable, Logger } from '@nestjs/common';

import { QuarteiraoWriteRepository } from '../../quarteirao/repositories/quarteirao-write.repository';
import { SaveImovelBody } from '../dtos/save-imovel.body';
import { ImovelException } from '../errors/imovel.exception';
import { ImovelReadRepository } from '../repositories/imovel-read.repository';
import { ImovelWriteRepository } from '../repositories/imovel-write.repository';
import { normalizarQuarteirao } from './normalizar-quarteirao';

@Injectable()
export class SaveImovel {
  private readonly logger = new Logger(SaveImovel.name);

  constructor(
    private readRepository: ImovelReadRepository,
    private writeRepository: ImovelWriteRepository,
    private quarteiraoWriteRepository: QuarteiraoWriteRepository,
  ) {}

  async execute(id: string, input: SaveImovelBody, clienteId: string | null) {
    const imovel = await this.readRepository.findById(id, clienteId);
    if (!imovel) throw ImovelException.notFound();

    if (input.regiaoId !== undefined) imovel.regiaoId = input.regiaoId;
    if (input.tipoImovel !== undefined) imovel.tipoImovel = input.tipoImovel;
    if (input.logradouro !== undefined) imovel.logradouro = input.logradouro;
    if (input.numero !== undefined) imovel.numero = input.numero;
    if (input.complemento !== undefined) imovel.complemento = input.complemento;
    if (input.bairro !== undefined) imovel.bairro = input.bairro;
    if (input.quarteirao !== undefined) imovel.quarteirao = normalizarQuarteirao(input.quarteirao) ?? undefined;
    if (input.latitude !== undefined) imovel.latitude = input.latitude;
    if (input.longitude !== undefined) imovel.longitude = input.longitude;
    if (input.ativo !== undefined) imovel.ativo = input.ativo;
    if (input.proprietarioAusente !== undefined)
      imovel.proprietarioAusente = input.proprietarioAusente;
    if (input.tipoAusencia !== undefined)
      imovel.tipoAusencia = input.tipoAusencia;
    if (input.contatoProprietario !== undefined)
      imovel.contatoProprietario = input.contatoProprietario;
    if (input.temAnimalAgressivo !== undefined)
      imovel.temAnimalAgressivo = input.temAnimalAgressivo;
    if (input.historicoRecusa !== undefined)
      imovel.historicoRecusa = input.historicoRecusa;
    if (input.temCalha !== undefined) imovel.temCalha = input.temCalha;
    if (input.calhaAcessivel !== undefined)
      imovel.calhaAcessivel = input.calhaAcessivel;
    if (input.prioridadeDrone !== undefined)
      imovel.prioridadeDrone = input.prioridadeDrone;
    if (input.notificacaoFormalEm !== undefined)
      imovel.notificacaoFormalEm = input.notificacaoFormalEm as
        | Date
        | undefined;

    await this.writeRepository.save(imovel);

    // K.5 — fn_sync_quarteirao_mestre: garante entrada na tabela mestre (best-effort)
    if (input.quarteirao !== undefined) {
      const quarteirao = normalizarQuarteirao(input.quarteirao);
      if (quarteirao) {
        try {
          await this.quarteiraoWriteRepository.upsertMestreIfMissing(
            imovel.clienteId,
            input.bairro,
            quarteirao,
          );
        } catch (err) {
          this.logger.error(
            `[SaveImovel] Falha ao sincronizar quarteirao mestre "${quarteirao}": ${(err as Error).message}`,
          );
        }
      }
    }

    return { imovel };
  }
}
