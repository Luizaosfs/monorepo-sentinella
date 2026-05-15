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
    const created = await this.prisma.client.bairros.create({ data });
    await this.syncArea(created.id);
    return PrismaRegiaoMapper.toDomain(created as any);
  }

  async save(regiao: Regiao): Promise<void> {
    const data = PrismaRegiaoMapper.toPrisma(regiao);
    await this.prisma.client.bairros.updateMany({ where: { id: regiao.id, cliente_id: regiao.clienteId }, data });
    await this.syncArea(regiao.id!);
  }

  /**
   * Popula `area` (geometry) a partir do geojson salvo — usado pelo ST_Contains
   * no despacho — e sincroniza `latitude`/`longitude` com o centroide do
   * polígono. Política: havendo polígono, o centroide é a fonte da verdade da
   * coordenada (sobrescreve qualquer lat/long enviada pelo caller). Bairros
   * sem geojson não são tocados (preservam lat/long manual).
   */
  private async syncArea(id: string): Promise<void> {
    await this.prisma.client.$executeRaw(Prisma.sql`
      UPDATE bairros
         SET area      = ST_GeomFromGeoJSON(geojson::text),
             latitude  = ST_Y(ST_Centroid(ST_GeomFromGeoJSON(geojson::text))),
             longitude = ST_X(ST_Centroid(ST_GeomFromGeoJSON(geojson::text)))
       WHERE id = ${id}::uuid
         AND geojson IS NOT NULL
         AND jsonb_typeof(geojson) = 'object'
    `);
  }
}
