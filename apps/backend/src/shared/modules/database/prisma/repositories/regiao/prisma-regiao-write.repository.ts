import { Regiao } from '@modules/regiao/entities/regiao';
import { RegiaoWriteRepository } from '@modules/regiao/repositories/regiao-write.repository';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

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
    await this.syncArea(created.id);
    return PrismaRegiaoMapper.toDomain(created as any);
  }

  async save(regiao: Regiao): Promise<void> {
    const data = PrismaRegiaoMapper.toPrisma(regiao);
    await this.prisma.client.regioes.updateMany({ where: { id: regiao.id, cliente_id: regiao.clienteId }, data });
    await this.syncArea(regiao.id!);
  }

  /** Popula area (geometry) a partir do geojson salvo — usado pelo ST_Contains no despacho. */
  private async syncArea(id: string): Promise<void> {
    await this.prisma.client.$executeRaw(Prisma.sql`
      UPDATE regioes
         SET area = ST_GeomFromGeoJSON(geojson::text)
       WHERE id = ${id}::uuid
         AND geojson IS NOT NULL
         AND jsonb_typeof(geojson) = 'object'
    `);
  }
}
