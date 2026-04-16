import {
  Operacao,
  OperacaoEvidencia,
} from '@modules/operacao/entities/operacao';
import { OperacaoWriteRepository } from '@modules/operacao/repositories/operacao-write.repository';
import { Injectable } from '@nestjs/common';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaOperacaoMapper } from '../../mappers/prisma-operacao.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(OperacaoWriteRepository)
@Injectable()
export class PrismaOperacaoWriteRepository implements OperacaoWriteRepository {
  constructor(private prisma: PrismaService) {}

  async create(entity: Operacao): Promise<Operacao> {
    const raw = await this.prisma.client.operacoes.create({
      data: PrismaOperacaoMapper.toPrisma(entity),
    });
    return PrismaOperacaoMapper.toDomain(raw as any);
  }

  async save(entity: Operacao): Promise<void> {
    await this.prisma.client.operacoes.update({
      where: { id: entity.id },
      data: PrismaOperacaoMapper.toPrisma(entity),
    });
  }

  async softDelete(id: string, deletedBy: string): Promise<void> {
    await this.prisma.client.operacoes.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        deleted_by: deletedBy,
        updated_at: new Date(),
      },
    });
  }

  async addEvidencia(
    data: OperacaoEvidencia & { operacaoId: string },
  ): Promise<OperacaoEvidencia> {
    const raw = await this.prisma.client.operacao_evidencias.create({
      data: PrismaOperacaoMapper.evidenciaToPrisma(data),
    });
    return PrismaOperacaoMapper.evidenciaToDomain(raw as any);
  }
}
