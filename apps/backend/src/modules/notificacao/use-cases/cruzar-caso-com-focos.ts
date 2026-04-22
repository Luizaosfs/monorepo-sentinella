import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

const RAIO_METROS = 300;

/**
 * Fase C.4 — Porte do trigger legado `fn_cruzar_caso_com_focos`.
 *
 * Após a criação de um caso notificado com lat/lng, busca os focos de risco
 * ativos num raio de 300m (só focos com `origem_levantamento_item_id`) e:
 *   1. Insere uma linha em `caso_foco_cruzamento` por foco encontrado.
 *   2. Atualiza o foco elevando `prioridade = 'P1'` e guardando a prioridade
 *      anterior em `prioridade_original_antes_caso` — apenas focos que ainda
 *      não estão em P1 (**guarda do legado preservada deliberadamente**).
 *   3. Acrescenta o `caso_id` ao array `focos_risco.casos_ids`.
 *
 * Idempotente via `ON CONFLICT DO NOTHING` na tabela de cruzamento e
 * `array_append` condicional.
 */
export interface CruzarCasoComFocosInput {
  casoId: string | undefined;
  clienteId: string;
  latitude: number | null | undefined;
  longitude: number | null | undefined;
}

@Injectable()
export class CruzarCasoComFocos {
  private readonly logger = new Logger(CruzarCasoComFocos.name);

  constructor(private prisma: PrismaService) {}

  async execute(input: CruzarCasoComFocosInput): Promise<{ cruzamentos: number }> {
    const { casoId, clienteId, latitude, longitude } = input;

    if (!casoId || latitude == null || longitude == null) {
      return { cruzamentos: 0 };
    }

    const focos = await this.prisma.client.$queryRaw<
      Array<{
        id: string;
        levantamento_item_id: string;
        distancia_metros: number;
        prioridade: string | null;
      }>
    >(Prisma.sql`
      SELECT
        f.id,
        f.origem_levantamento_item_id AS levantamento_item_id,
        ST_Distance(
          ST_SetSRID(ST_MakePoint(f.longitude, f.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
        ) AS distancia_metros,
        f.prioridade
      FROM focos_risco f
      WHERE f.cliente_id = ${clienteId}::uuid
        AND f.deleted_at IS NULL
        AND f.origem_levantamento_item_id IS NOT NULL
        AND f.latitude IS NOT NULL
        AND f.longitude IS NOT NULL
        AND f.status NOT IN ('resolvido', 'descartado')
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(f.longitude, f.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
          ${RAIO_METROS}
        )
    `);

    if (focos.length === 0) {
      return { cruzamentos: 0 };
    }

    let inseridos = 0;
    for (const foco of focos) {
      const result = await this.prisma.client.$executeRaw(Prisma.sql`
        INSERT INTO caso_foco_cruzamento (caso_id, levantamento_item_id, distancia_metros)
        VALUES (${casoId}::uuid, ${foco.levantamento_item_id}::uuid, ${foco.distancia_metros})
        ON CONFLICT (caso_id, levantamento_item_id) DO NOTHING
      `);
      inseridos += Number(result) || 0;

      // Guarda legada preservada: só atualiza focos que NÃO estão em P1.
      // Focos já em P1 não recebem o caso_id em casos_ids (comportamento original).
      await this.prisma.client.$executeRaw(Prisma.sql`
        UPDATE focos_risco
        SET
          casos_ids = (
            CASE
              WHEN ${casoId}::uuid = ANY(casos_ids) THEN casos_ids
              ELSE array_append(casos_ids, ${casoId}::uuid)
            END
          ),
          prioridade_original_antes_caso = COALESCE(prioridade_original_antes_caso, prioridade),
          prioridade = 'P1'
        WHERE id = ${foco.id}::uuid
          AND prioridade IS DISTINCT FROM 'P1'
      `);
    }

    this.logger.debug(
      `Caso ${casoId} cruzado com ${focos.length} foco(s); ${inseridos} novo(s) cruzamento(s).`,
    );

    return { cruzamentos: inseridos };
  }
}
