import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { CruzarFocoNovoComCasos } from '../cruzar-foco-novo-com-casos';
import { gerarCodigoFoco } from '../helpers/gerar-codigo-foco';
import { autoClassificarFoco } from './auto-classificar-foco';
import { prioridadeParaP } from './prioridade-para-p';

export interface CriarFocoDeLevantamentoItemInput {
  itemId: string;
  levantamentoId: string;
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  prioridade: string | null | undefined;
  risco: string | null | undefined;
  enderecoCurto: string | null | undefined;
  payload: Record<string, unknown> | null | undefined;
  createdAt: Date;
}

export interface CriarFocoDeLevantamentoItemResult {
  criado: boolean;
  focoId?: string;
  motivo?: 'levantamento_nao_encontrado' | 'filtro_nao_atendido';
}

@Injectable()
export class CriarFocoDeLevantamentoItem {
  private readonly logger = new Logger(CriarFocoDeLevantamentoItem.name);

  constructor(
    private prisma: PrismaService,
    private cruzarFocoNovoComCasos: CruzarFocoNovoComCasos,
  ) {}

  async execute(
    input: CriarFocoDeLevantamentoItemInput,
  ): Promise<CriarFocoDeLevantamentoItemResult> {
    const levantamento = await this.prisma.client.levantamentos.findUnique({
      where: { id: input.levantamentoId },
      select: { cliente_id: true, tipo_entrada: true },
    });

    if (!levantamento?.cliente_id) {
      return { criado: false, motivo: 'levantamento_nao_encontrado' };
    }

    const clienteId = levantamento.cliente_id;

    const isCidadao =
      typeof input.payload === 'object' &&
      input.payload !== null &&
      (input.payload as Record<string, unknown>)['fonte'] === 'cidadao';

    if (!isCidadao) {
      const prioridadeOk = ['P1', 'P2', 'P3'].includes(
        (input.prioridade ?? '').trim(),
      );
      const riscoLower = (input.risco ?? '').toLowerCase().trim();
      const riscoOk = ['alto', 'crítico', 'critico'].includes(riscoLower);

      if (!prioridadeOk && !riscoOk) {
        return { criado: false, motivo: 'filtro_nao_atendido' };
      }
    }

    let imovelId: string | null = null;
    if (input.latitude != null && input.longitude != null) {
      type ImovelProximoRow = { id: string };
      const rows = await this.prisma.client.$queryRaw<ImovelProximoRow[]>(Prisma.sql`
        SELECT i.id
          FROM imoveis i
         WHERE i.cliente_id = ${clienteId}::uuid
           AND i.deleted_at IS NULL
           AND i.latitude IS NOT NULL
           AND i.longitude IS NOT NULL
           AND ST_DWithin(
                 ST_MakePoint(${input.longitude}::float8, ${input.latitude}::float8)::geography,
                 ST_MakePoint(i.longitude, i.latitude)::geography,
                 30
               )
         ORDER BY ST_Distance(
                   ST_MakePoint(${input.longitude}::float8, ${input.latitude}::float8)::geography,
                   ST_MakePoint(i.longitude, i.latitude)::geography
                  )
         LIMIT 1
      `);
      imovelId = rows[0]?.id ?? null;
    }

    let origemTipo: 'cidadao' | 'drone' | 'agente';
    if (isCidadao) {
      origemTipo = 'cidadao';
    } else if ((levantamento.tipo_entrada ?? '').toUpperCase() === 'DRONE') {
      origemTipo = 'drone';
    } else {
      origemTipo = 'agente';
    }

    const prioridadeP = prioridadeParaP(input.prioridade);
    const classificacaoInicial = autoClassificarFoco({ origemTipo });
    const codigoFoco = await gerarCodigoFoco(this.prisma, clienteId, input.createdAt);

    const foco = await this.prisma.client.focos_risco.create({
      data: {
        cliente_id: clienteId,
        imovel_id: imovelId,
        origem_tipo: origemTipo,
        origem_levantamento_item_id: input.itemId,
        status: 'em_triagem',
        prioridade: prioridadeP,
        classificacao_inicial: classificacaoInicial,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        endereco_normalizado: input.enderecoCurto ?? null,
        suspeita_em: input.createdAt,
        codigo_foco: codigoFoco,
      },
    });

    this.logger.log(
      `Foco auto-criado de levantamento_item: item=${input.itemId} foco=${foco.id} origem=${origemTipo} prioridade=${prioridadeP} imovel=${imovelId ?? 'null'}`,
    );

    try {
      await this.cruzarFocoNovoComCasos.execute({
        focoId: foco.id,
        clienteId: foco.cliente_id,
        origemLevantamentoItemId: foco.origem_levantamento_item_id ?? null,
        latitude: foco.latitude,
        longitude: foco.longitude,
      });
    } catch (err) {
      this.logger.error(
        `Hook CruzarFocoNovoComCasos falhou: foco=${foco.id} erro=${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    return { criado: true, focoId: foco.id };
  }
}
