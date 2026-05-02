import { randomBytes } from 'node:crypto';

import { HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { Prisma } from '@prisma/client';

import { autoClassificarFoco } from '../../foco-risco/use-cases/auto-criacao/auto-classificar-foco';
import { gerarCodigoFoco } from '../../foco-risco/use-cases/helpers/gerar-codigo-foco';
import { DenunciaCidadaoBody } from '../dtos/denuncia-cidadao.body';
import { EnfileirarNotifCanalCidadao } from './enfileirar-notif-canal-cidadao';

const RATE_LIMIT_MAX = 5;     // por IP por janela de 30 min (igual à função SQL)
const RATE_LIMIT_WINDOW = 30; // minutos

function getJanela30min(): Date {
  const now = new Date();
  const base = new Date(now);
  base.setMinutes(now.getMinutes() < 30 ? 0 : 30, 0, 0);
  return base;
}

function calcCiclo(): number {
  return Math.ceil((new Date().getMonth() + 1) / 2);
}

function gerarProtocoloPublico(): string {
  const ano = new Date().getFullYear();
  const suffix = randomBytes(3).toString('hex').toUpperCase();
  return `SENT-${ano}-${suffix}`;
}

@Injectable()
export class DenunciarCidadaoV2 {
  private readonly logger = new Logger(DenunciarCidadaoV2.name);

  constructor(
    private prisma: PrismaService,
    private enfileirarNotifCanalCidadao: EnfileirarNotifCanalCidadao,
  ) {}

  async execute(
    input: DenunciaCidadaoBody,
    ipHash: string,
  ): Promise<{ protocolo: string; id: string }> {
    // 1. Resolver cliente pelo slug
    const cliente = await this.prisma.client.clientes.findFirst({
      where: { slug: input.slug, ativo: true },
      select: { id: true },
    });
    if (!cliente) {
      throw new NotFoundException('Canal não encontrado.');
    }
    const clienteId = cliente.id;

    // 2. Rate limit por IP — janela de 30 min (atomic upsert via $queryRaw)
    if (ipHash) {
      const janela = getJanela30min();

      const [rl] = await this.prisma.client.$queryRaw<[{ contagem: number }]>(
        Prisma.sql`
          INSERT INTO canal_cidadao_rate_limit (ip_hash, cliente_id, janela_hora, contagem)
          VALUES (${ipHash}, ${clienteId}::uuid, ${janela}::timestamptz, 1)
          ON CONFLICT (ip_hash, cliente_id, janela_hora)
          DO UPDATE SET contagem = canal_cidadao_rate_limit.contagem + 1
          RETURNING contagem
        `,
      );

      if (rl.contagem > RATE_LIMIT_MAX) {
        // Clampa o contador e loga (fire-and-forget)
        this.prisma.client.$executeRaw`
          UPDATE canal_cidadao_rate_limit
          SET contagem = ${RATE_LIMIT_MAX}
          WHERE ip_hash = ${ipHash} AND cliente_id = ${clienteId}::uuid AND janela_hora = ${janela}::timestamptz
        `.catch(() => null);

        this.prisma.client.canal_cidadao_rate_log
          .create({
            data: {
              cliente_id: clienteId,
              ip_hash: ipHash,
              motivo: 'RATE_LIMIT',
              detalhes: {
                janela_min: RATE_LIMIT_WINDOW,
                limite: RATE_LIMIT_MAX,
                contagem: rl.contagem,
              },
            },
          })
          .catch(() => null);

        throw new HttpException(
          `Muitas denúncias registradas neste local. Aguarde ${RATE_LIMIT_WINDOW} minutos.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // 3. Deduplicação geoespacial — raio 30m, janela 24h
    if (input.latitude != null && input.longitude != null) {
      const dedup = await this.prisma.client.$queryRaw<Array<{ id: string; protocolo_publico: string | null }>>(
        Prisma.sql`
          SELECT id, protocolo_publico FROM focos_risco
          WHERE cliente_id  = ${clienteId}::uuid
            AND origem_tipo = 'cidadao'
            AND status      NOT IN ('descartado')
            AND deleted_at  IS NULL
            AND created_at  > now() - INTERVAL '24 hours'
            AND ST_DWithin(
                  ST_MakePoint(longitude, latitude)::geography,
                  ST_MakePoint(${input.longitude}::float8, ${input.latitude}::float8)::geography,
                  30
                )
          ORDER BY created_at DESC
          LIMIT 1
        `,
      );

      const focoExistente = dedup[0];
      if (focoExistente) {
        // Incrementa confirmações e loga (fire-and-forget)
        this.prisma.client.$executeRaw`
          UPDATE focos_risco
          SET payload = jsonb_set(
            COALESCE(payload, '{}'::jsonb),
            '{confirmacoes}',
            to_jsonb(COALESCE((payload->>'confirmacoes')::int, 1) + 1)
          )
          WHERE id = ${focoExistente.id}::uuid
        `.catch(() => null);

        this.prisma.client.canal_cidadao_rate_log
          .create({
            data: {
              cliente_id: clienteId,
              ip_hash: ipHash,
              motivo: 'DEDUPLICADO',
              foco_id: focoExistente.id,
              detalhes: { raio_m: 30 },
            },
          })
          .catch(() => null);

        return {
          protocolo: focoExistente.protocolo_publico ?? gerarProtocoloPublico(),
          id: focoExistente.id,
        };
      }
    }

    // 4. Resolver região pelo bairroId (opcional)
    let regiaoId: string | null = null;
    if (input.bairroId) {
      const regiao = await this.prisma.client.regioes.findFirst({
        where: { id: input.bairroId, cliente_id: clienteId },
        select: { id: true },
      });
      regiaoId = regiao?.id ?? null;
    }

    // 5. Criar foco_risco
    const classificacaoInicial = autoClassificarFoco({
      origemTipo: 'cidadao',
      classificacaoInicial: 'suspeito',
    });
    const suspeitaEm = new Date();
    const codigoFoco = await gerarCodigoFoco(this.prisma, clienteId, suspeitaEm);
    const protocoloPublico = gerarProtocoloPublico();
    const foco = await this.prisma.client.focos_risco.create({
      data: {
        cliente_id: clienteId,
        regiao_id: regiaoId,
        origem_tipo: 'cidadao',
        status: 'suspeita',
        classificacao_inicial: classificacaoInicial,
        prioridade: 'P3',
        ciclo: calcCiclo(),
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        suspeita_em: suspeitaEm,
        observacao: input.descricao,
        codigo_foco: codigoFoco,
        protocolo_publico: protocoloPublico,
        payload: {
          bairro_id: input.bairroId ?? null,
          confirmacoes: 1,
          foto_url: input.fotoUrl ?? null,
          foto_public_id: input.fotoPublicId ?? null,
        },
      },
      select: { id: true },
    });

    // Hook best-effort — port de fn_notificar_foco_cidadao (AFTER INSERT trigger).
    try {
      await this.enfileirarNotifCanalCidadao.execute({
        focoId: foco.id,
        clienteId,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        endereco: null,
        suspeitaEm,
        origemLevantamentoItemId: null,
      });
    } catch (err) {
      this.logger.error(
        `Hook EnfileirarNotifCanalCidadao falhou: foco=${foco.id} erro=${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    // 6. Registrar evento inicial no histórico
    this.prisma.client.foco_risco_historico
      .create({
        data: {
          foco_risco_id: foco.id,
          cliente_id: clienteId,
          status_anterior: null,
          status_novo: 'suspeita',
          tipo_evento: 'criacao',
          motivo: 'Denúncia via canal cidadão',
        },
      })
      .catch(() => null);

    // 7. Log de aceitação (fire-and-forget)
    this.prisma.client.canal_cidadao_rate_log
      .create({
        data: {
          cliente_id: clienteId,
          ip_hash: ipHash,
          motivo: 'ACEITO',
          foco_id: foco.id,
        },
      })
      .catch(() => null);

    return { protocolo: protocoloPublico, id: foco.id };
  }
}
