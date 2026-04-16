import type { JsonObject } from '@shared/types/json';
import { Prisma } from '@prisma/client';
import { Regiao } from 'src/modules/regiao/entities/regiao';

type RawRegiao = {
  id: string;
  cliente_id: string;
  nome: string;
  tipo: string | null;
  cor: string | null;
  geojson: Prisma.JsonValue | null;
  ativo: boolean;
  created_at: Date;
  updated_at: Date;
};

export class PrismaRegiaoMapper {
  static toDomain(raw: RawRegiao): Regiao {
    return new Regiao(
      {
        clienteId: raw.cliente_id,
        nome: raw.nome,
        tipo: raw.tipo || undefined,
        cor: raw.cor || undefined,
        geojson: raw.geojson
          ? (raw.geojson as JsonObject)
          : undefined,
        ativo: raw.ativo,
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
      tipo: entity.tipo || null,
      cor: entity.cor || null,
      geojson:
        entity.geojson == null
          ? Prisma.JsonNull
          : (entity.geojson as Prisma.InputJsonValue),
      ativo: entity.ativo,
      updated_at: new Date(),
    };
  }
}
