import {
  DistribuicaoQuarteirao,
  Quarteirao,
} from 'src/modules/quarteirao/entities/quarteirao';

type RawQuarteirao = {
  id: string;
  cliente_id: string;
  regiao_id: string | null;
  codigo: string;
  bairro: string | null;
  ativo: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  deleted_by: string | null;
};

type RawDistribuicao = {
  id: string;
  cliente_id: string;
  ciclo: number;
  quarteirao: string;
  agente_id: string;
  regiao_id: string | null;
  created_at: Date;
  updated_at: Date;
};

export class PrismaQuarteiraoMapper {
  static quarteiraoToDomain(raw: RawQuarteirao): Quarteirao {
    return new Quarteirao(
      {
        clienteId: raw.cliente_id,
        regiaoId: raw.regiao_id || undefined,
        codigo: raw.codigo,
        bairro: raw.bairro || undefined,
        ativo: raw.ativo,
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
        ciclo: raw.ciclo,
        quarteirao: raw.quarteirao,
        agenteId: raw.agente_id,
        regiaoId: raw.regiao_id || undefined,
      },
      {
        id: raw.id,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
      },
    );
  }
}
