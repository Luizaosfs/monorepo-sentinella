import type { JsonObject } from '@shared/types/json';
import { Prisma } from '@prisma/client';
import {
  DistribuicaoQuarteirao,
  Quarteirao,
} from 'src/modules/quarteirao/entities/quarteirao';

type RawQuarteirao = {
  id: string;
  cliente_id: string;
  bairro_id: string | null;
  codigo: string;
  bairro: string | null;
  ativo: boolean;
  geojson: Prisma.JsonValue | null;
  latitude: number | null;
  longitude: number | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  deleted_by: string | null;
};

type RawDistribuicao = {
  id: string;
  cliente_id: string;
  ciclo_id: string | null;
  quadra_id: string;
  agente_id: string;
  bairro_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export class PrismaQuarteiraoMapper {
  static quarteiraoToDomain(raw: RawQuarteirao): Quarteirao {
    return new Quarteirao(
      {
        clienteId: raw.cliente_id,
        bairroId: raw.bairro_id || undefined,
        codigo: raw.codigo,
        bairro: raw.bairro || undefined,
        ativo: raw.ativo,
        geojson: raw.geojson ? (raw.geojson as JsonObject) : undefined,
        latitude: raw.latitude ?? null,
        longitude: raw.longitude ?? null,
      },
      {
        id: raw.id,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
        deletedAt: raw.deleted_at || undefined,
        deletedBy: raw.deleted_by || undefined,
      },
    );
  }

  static distribuicaoToDomain(raw: RawDistribuicao): DistribuicaoQuarteirao {
    return new DistribuicaoQuarteirao(
      {
        clienteId: raw.cliente_id,
        cicloId: raw.ciclo_id,
        quadraId: raw.quadra_id,
        agenteId: raw.agente_id,
        bairroId: raw.bairro_id || undefined,
      },
      {
        id: raw.id,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
      },
    );
  }
}
