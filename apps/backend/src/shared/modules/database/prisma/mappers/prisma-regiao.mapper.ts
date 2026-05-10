import type { JsonObject } from '@shared/types/json';
import { Prisma } from '@prisma/client';
import { Regiao } from 'src/modules/regiao/entities/regiao';

type RawRegiao = {
  id: string;
  cliente_id: string;
  nome: string;
  cor: string | null;
  geojson: Prisma.JsonValue | null;
  ativo: boolean;
  created_at: Date;
  updated_at: Date;
  latitude?: number | null;
  longitude?: number | null;
};

export class PrismaRegiaoMapper {
  static toDomain(raw: RawRegiao): Regiao {
    return new Regiao(
      {
        clienteId: raw.cliente_id,
        nome: raw.nome,
        cor: raw.cor || undefined,
        geojson: raw.geojson
          ? (typeof raw.geojson === 'string'
              ? JSON.parse(raw.geojson) as JsonObject
              : raw.geojson as JsonObject)
          : undefined,
        ativo: raw.ativo,
        latitude: raw.latitude ?? null,
        longitude: raw.longitude ?? null,
      },
      {
        id: raw.id,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
      },
    );
  }

  static toPrisma(entity: Regiao) {
    return {
      cliente_id: entity.clienteId,
      nome: entity.nome,
      cor: entity.cor || null,
      geojson:
        entity.geojson == null
          ? Prisma.JsonNull
          : (entity.geojson as Prisma.InputJsonValue),
      ativo: entity.ativo,
      latitude: entity.latitude ?? null,
      longitude: entity.longitude ?? null,
      updated_at: new Date(),
    };
  }
}
