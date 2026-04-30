import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { QuarteiraoWriteRepository } from '../../quarteirao/repositories/quarteirao-write.repository';
import { CreateImovelBody } from '../dtos/create-imovel.body';
import { Imovel } from '../entities/imovel';
import { ImovelWriteRepository } from '../repositories/imovel-write.repository';
import { normalizarQuarteirao } from './normalizar-quarteirao';
import { PrismaService } from 'src/shared/modules/database/prisma/prisma.service';

@Injectable()
export class CreateImovel {
  private readonly logger = new Logger(CreateImovel.name);

  constructor(
    private writeRepository: ImovelWriteRepository,
    private quarteiraoWriteRepository: QuarteiraoWriteRepository,
    private prisma: PrismaService,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(input: CreateImovelBody) {
    const clienteId = requireTenantId(getAccessScope(this.req));

    if (input.regiaoId) {
      const count = await this.prisma.client.regioes.count({
        where: { id: input.regiaoId, cliente_id: clienteId },
      });
      if (count === 0) throw new ForbiddenException('regiaoId inválido para este cliente');
    }

    const imovel = new Imovel(
      {
        clienteId,
        regiaoId: input.regiaoId,
        tipoImovel: input.tipoImovel ?? 'residencial',
        logradouro: input.logradouro,
        numero: input.numero,
        complemento: input.complemento,
        bairro: input.bairro,
        quarteirao: normalizarQuarteirao(input.quarteirao) ?? undefined,
        latitude: input.latitude,
        longitude: input.longitude,
        ativo: true,
        proprietarioAusente: input.proprietarioAusente ?? false,
        tipoAusencia: input.tipoAusencia,
        contatoProprietario: input.contatoProprietario,
        temAnimalAgressivo: input.temAnimalAgressivo ?? false,
        historicoRecusa: input.historicoRecusa ?? false,
        temCalha: input.temCalha ?? false,
        calhaAcessivel: input.calhaAcessivel ?? true,
        prioridadeDrone: input.prioridadeDrone ?? false,
        notificacaoFormalEm: input.notificacaoFormalEm as Date | undefined,
      },
      { createdBy: this.req['user']?.id },
    );

    const created = await this.writeRepository.create(imovel);

    // K.5 — fn_sync_quarteirao_mestre: garante entrada na tabela mestre (best-effort)
    const quarteirao = normalizarQuarteirao(input.quarteirao);
    if (quarteirao) {
      try {
        await this.quarteiraoWriteRepository.upsertMestreIfMissing(
          clienteId,
          input.bairro,
          quarteirao,
        );
      } catch (err) {
        this.logger.error(
          `[CreateImovel] Falha ao sincronizar quarteirao mestre "${quarteirao}": ${(err as Error).message}`,
        );
      }
    }

    return { imovel: created };
  }
}
