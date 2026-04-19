import { Regiao } from '@modules/regiao/entities/regiao';
import { RegiaoWriteRepository } from '@modules/regiao/repositories/regiao-write.repository';
import { Injectable } from '@nestjs/common';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaRegiaoMapper } from '../../mappers/prisma-regiao.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(RegiaoWriteRepository)
@Injectable()
export class PrismaRegiaoWriteRepository implements RegiaoWriteRepository {
  constructor(private prisma: PrismaService) {}

  async create(regiao: Regiao): Promise<Regiao> {
    const data = PrismaRegiaoMapper.toPrisma(regiao);
    const created = await this.prisma.client.regioes.create({ data });
    return PrismaRegiaoMapper.toDomain(created as any);
  }

  async save(regiao: Regiao): Promise<void> {
    const data = PrismaRegiaoMapper.toPrisma(regiao);
    await this.prisma.client.regioes.updateMany({ where: { id: regiao.id, cliente_id: regiao.clienteId }, data });
  }
}
