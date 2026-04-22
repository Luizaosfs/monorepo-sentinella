import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

const RAIO_METROS = 300;

/**
 * Fase C.4 — Porte do trigger legado `fn_cruzar_foco_novo_com_casos`.
 *
 * Após a criação de um foco de risco com `origem_levantamento_item_id` e
 * lat/lng definidos, busca os casos notificados ativos num raio de 300m e:
 *   1. Insere uma linha em `caso_foco_cruzamento` por caso encontrado.
 *   2. Eleva o foco para `prioridade = 'P1'` e registra a prioridade anterior
 *      em `prioridade_original_antes_caso`, acrescentando os `caso_id`s ao
 *      array `casos_ids` — apenas se o foco ainda não estava em P1
 *      (**guarda do legado preservada**).
 *
 * Se o foco não possui `origem_levantamento_item_id`, nada é feito — essa
 * coluna é parte da chave única de `caso_foco_cruzamento` e a ausência dela
 * tornaria o insert impossível.
 */
export interface CruzarFocoNovoComCasosInput {
  focoId: string | undefined;
  clienteId: string;
  origemLevantamentoItemId: string | null | undefined;
  latitude: number | null | undefined;
  longitude: number | null | undefined;
}

@Injectable()
export class CruzarFocoNovoComCasos {
  private readonly logger = new Logger(CruzarFocoNovoComCasos.name);

  constructor(private prisma: PrismaService) {}

  async execute(
    input: CruzarFocoNovoComCasosInput,
  ): Promise<{ cruzamentos: number }> {
    const { focoId, clienteId, origemLevantamentoItemId, latitude, longitude } = input;

    if (!focoId || !origemLevantamentoItemId || latitude == null || longitude == null) {
      return { cruzamentos: 0 };
    }

    const casos = await this.prisma.client.$queryRaw<
      Array<{ id: string; distancia_metros: number }>
    >(Prisma.sql`
      SELECT
        cn.id,
        ST_Distance(
          ST_SetSRID(ST_MakePoint(cn.longitude, cn.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
        ) AS distancia_metros
      FROM casos_notificados cn
      WHERE cn.cliente_id = ${clienteId}::uuid
        AND cn.deleted_at IS NULL
        AND cn.latitude IS NOT NULL
        AND cn.longitude IS NOT NULL
        AND cn.status <> 'descartado'
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(cn.longitude, cn.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
          ${RAIO_METROS}
        )
    `);

    if (casos.length === 0) {
      return { cruzamentos: 0 };
    }

    let inseridos = 0;
    for (const caso of casos) {
      const r = await this.prisma.client.$executeRaw(Prisma.sql`
        INSERT INTO caso_foco_cruzamento (caso_id, levantamento_item_id, distancia_metros)
        VALUES (${caso.id}::uuid, ${origemLevantamentoItemId}::uuid, ${caso.distancia_metros})
        ON CONFLICT (caso_id, levantamento_item_id) DO NOTHING
      `);
      inseridos += Number(r) || 0;
    }

    const casosIds = casos.map((c) => c.id);

    // Guarda legada preservada: só altera foco que não está em P1.
    await this.prisma.client.$executeRaw(Prisma.sql`
      UPDATE focos_risco
      SET
        casos_ids = (
          SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::uuid[])
          FROM unnest(casos_ids || ${casosIds}::uuid[]) AS x
        ),
        prioridade_original_antes_caso = COALESCE(prioridade_original_antes_caso, prioridade),
        prioridade = 'P1'
      WHERE id = ${focoId}::uuid
        AND prioridade IS DISTINCT FROM 'P1'
    `);

    this.logger.debug(
      `Foco ${focoId} cruzado com ${casos.length} caso(s); ${inseridos} novo(s) cruzamento(s).`,
    );

    return { cruzamentos: inseridos };
  }
}
