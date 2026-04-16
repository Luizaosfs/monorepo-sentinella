import { PlanoAcao } from '@modules/plano-acao/entities/plano-acao';
import { PlanoAcaoWriteRepository } from '@modules/plano-acao/repositories/plano-acao-write.repository';
import { Injectable } from '@nestjs/common';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaPlanoAcaoMapper } from '../../mappers/prisma-plano-acao.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(PlanoAcaoWriteRepository)
@Injectable()
export class PrismaPlanoAcaoWriteRepository implements PlanoAcaoWriteRepository {
  constructor(private prisma: PrismaService) {}

  async create(entity: PlanoAcao): Promise<PlanoAcao> {
    const raw = await this.prisma.client.plano_acao_catalogo.create({
      data: PrismaPlanoAcaoMapper.toPrismaCreate(entity),
    });
    return PrismaPlanoAcaoMapper.toDomain(raw as any);
  }

  async save(entity: PlanoAcao): Promise<void> {
    await this.prisma.client.plano_acao_catalogo.update({
      where: { id: entity.id },
      data: PrismaPlanoAcaoMapper.toPrismaUpdate(entity),
    });
  }

  async delete(id: string, clienteId: string): Promise<void> {
    await this.prisma.client.plano_acao_catalogo.deleteMany({
      where: { id, cliente_id: clienteId },
    });
  }
}
