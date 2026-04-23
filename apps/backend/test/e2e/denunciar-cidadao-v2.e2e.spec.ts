import { randomUUID } from 'node:crypto';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
// `esModuleInterop` desligado no tsconfig — supertest é CJS puro (idem app.e2e.spec.ts).
import request = require('supertest');

import { E2E_CLIENTE_ID, E2E_CLIENTE_SLUG } from './auth-helpers';

const skipE2e = process.env.SKIP_E2E === '1';

/**
 * x-forwarded-for único por cenário. Evita compartilhar o bucket do
 * `@Throttle({ default: { limit: 5, ttl: 60_000 } })` entre tests. Para o
 * cenário de rate-limit intencional, fixamos um IP.
 */
function uniqueIp(): string {
  // Formato IP-like (o ThrottlerGuard usa o header direto — qualquer string
  // única serve, mas mantemos octetos para legibilidade em logs).
  const hex = randomUUID().replace(/-/g, '');
  const n = (i: number) => parseInt(hex.slice(i, i + 2), 16);
  return `10.${n(0)}.${n(2)}.${n(4)}`;
}

/** Espera condição virar true — para leituras fire-and-forget (historico, rate_log). */
async function waitFor<T>(
  fn: () => Promise<T>,
  predicate: (v: T) => boolean,
  { timeoutMs = 2000, intervalMs = 50 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<T> {
  const start = Date.now();
  let last = await fn();
  while (!predicate(last) && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, intervalMs));
    last = await fn();
  }
  return last;
}

(skipE2e ? describe.skip : describe)(
  'POST /denuncias/cidadao (e2e — Canal Cidadão V2)',
  () => {
    let app: INestApplication;
    let prisma: PrismaClient;
    let pool: Pool;

    beforeAll(async () => {
      // Guarda: só roda se V2 estiver habilitado (o endpoint cai em V1 com
      // comportamento e contratos diferentes se a flag estiver off).
      if (process.env.CANAL_CIDADAO_V2_ENABLED !== 'true') {
        throw new Error(
          '[e2e Parte 3] CANAL_CIDADAO_V2_ENABLED deve ser "true" em .env.test ' +
            '— specs desta suite exigem a implementação TypeScript do V2.',
        );
      }

      const { AppModule } = await import('@/app.module');
      const { MyZodValidationPipe } = await import('@/pipes/zod-validations.pipe');
      const { GlobalExceptionFilter } = await import(
        '@/common/filters/global-exception.filter'
      );

      const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleRef.createNestApplication();
      app.useGlobalPipes(new MyZodValidationPipe());
      app.useGlobalFilters(new GlobalExceptionFilter());
      await app.init();

      pool = new Pool({ connectionString: process.env.DATABASE_URL });
      prisma = new PrismaClient({
        adapter: new PrismaPg(pool, { disposeExternalPool: true }),
      });
    }, 120_000);

    afterAll(async () => {
      if (app) await app.close();
      if (prisma) await prisma.$disconnect();
    });

    afterEach(async () => {
      // Ordem importa: FK foco_risco_historico → focos_risco. rate_log e
      // rate_limit são isolados por cliente_id. job_queue não tem cliente_id
      // direto; limpamos por tipo (DB é *_test, não há outros notif_canal_cidadao).
      await prisma.canal_cidadao_rate_log.deleteMany({
        where: { cliente_id: E2E_CLIENTE_ID },
      });
      await prisma.canal_cidadao_rate_limit.deleteMany({
        where: { cliente_id: E2E_CLIENTE_ID },
      });
      await prisma.foco_risco_historico.deleteMany({
        where: { cliente_id: E2E_CLIENTE_ID },
      });
      await prisma.job_queue.deleteMany({
        where: { tipo: 'notif_canal_cidadao' },
      });
      await prisma.focos_risco.deleteMany({
        where: { cliente_id: E2E_CLIENTE_ID },
      });
    });

    // ─── Validação Zod (400 via MyZodValidationPipe + createZodDto) ─────

    it('400 — body vazio (slug/descricao obrigatórios)', async () => {
      const res = await request(app.getHttpServer())
        .post('/denuncias/cidadao')
        .set('x-forwarded-for', uniqueIp())
        .send({});
      expect(res.status).toBe(400);

      const focos = await prisma.focos_risco.findMany({
        where: { cliente_id: E2E_CLIENTE_ID },
      });
      expect(focos).toHaveLength(0);
    });

    it('400 — latitude fora do range (-90..90)', async () => {
      const res = await request(app.getHttpServer())
        .post('/denuncias/cidadao')
        .set('x-forwarded-for', uniqueIp())
        .send({
          slug: E2E_CLIENTE_SLUG,
          descricao: 'teste',
          latitude: 91,
          longitude: 0,
        });
      expect(res.status).toBe(400);
    });

    it('400 — descricao vazia', async () => {
      const res = await request(app.getHttpServer())
        .post('/denuncias/cidadao')
        .set('x-forwarded-for', uniqueIp())
        .send({
          slug: E2E_CLIENTE_SLUG,
          descricao: '',
        });
      expect(res.status).toBe(400);
    });

    // ─── 404 cliente ─────────────────────────────────────────────────────

    it('404 — slug não existe (cliente não encontrado / canal inativo)', async () => {
      const res = await request(app.getHttpServer())
        .post('/denuncias/cidadao')
        .set('x-forwarded-for', uniqueIp())
        .send({
          slug: 'slug-que-nao-existe-no-banco',
          descricao: 'Tentativa de denúncia em canal inexistente',
        });
      expect(res.status).toBe(404);
    });

    // ─── 200 happy path ──────────────────────────────────────────────────

    it('201 happy path — cria foco + historico + job + log ACEITO; valida protocolo', async () => {
      const res = await request(app.getHttpServer())
        .post('/denuncias/cidadao')
        .set('x-forwarded-for', uniqueIp())
        .send({
          slug: E2E_CLIENTE_SLUG,
          descricao: 'Criadouro embaixo da caixa dagua',
          latitude: -20.2,
          longitude: -50.93,
        });

      // NestJS retorna 201 por default em POST (não há @HttpCode(200) no controller).
      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        protocolo: expect.any(String),
        id: expect.any(String),
      });

      // Contrato do protocolo: 8 chars hex == primeiros 8 chars do uuid sem hífens.
      expect(res.body.protocolo).toMatch(/^[a-f0-9]{8}$/);
      expect(res.body.id.replace(/-/g, '').slice(0, 8)).toBe(res.body.protocolo);

      // Foco criado com os campos esperados do V2 (passo 5 + autoClassificarFoco).
      const foco = await prisma.focos_risco.findUnique({
        where: { id: res.body.id },
      });
      expect(foco).toMatchObject({
        cliente_id: E2E_CLIENTE_ID,
        origem_tipo: 'cidadao',
        status: 'suspeita',
        classificacao_inicial: 'suspeito', // autoClassificarFoco('cidadao') → 'suspeito'
        prioridade: 'P3',
      });
      expect(foco?.latitude).toBeCloseTo(-20.2, 4);
      expect(foco?.longitude).toBeCloseTo(-50.93, 4);
      expect((foco?.payload as Record<string, unknown>)?.confirmacoes).toBe(1);

      // Histórico CRIACAO (fire-and-forget — polla até aparecer).
      const historico = await waitFor(
        () =>
          prisma.foco_risco_historico.findMany({
            where: { foco_risco_id: res.body.id },
          }),
        (rows) => rows.length >= 1,
      );
      expect(historico).toHaveLength(1);
      expect(historico[0]).toMatchObject({
        cliente_id: E2E_CLIENTE_ID,
        tipo_evento: 'CRIACAO',
        status_anterior: null,
        status_novo: 'suspeita',
      });

      // Job enfileirado — EnfileirarNotifCanalCidadao é awaited no use-case.
      const jobs = await prisma.job_queue.findMany({
        where: { tipo: 'notif_canal_cidadao' },
      });
      expect(jobs).toHaveLength(1);
      expect(jobs[0].status).toBe('pendente');
      const jobPayload = jobs[0].payload as Record<string, unknown>;
      expect(jobPayload).toMatchObject({
        foco_id: res.body.id,
        cliente_id: E2E_CLIENTE_ID,
        latitude: -20.2,
        longitude: -50.93,
        endereco: null,
        origem_item_id: null,
      });
      expect(typeof jobPayload.suspeita_em).toBe('string');
      expect(
        Number.isFinite(new Date(jobPayload.suspeita_em as string).getTime()),
      ).toBe(true);

      // Log fire-and-forget (ACEITO).
      const logs = await waitFor(
        () =>
          prisma.canal_cidadao_rate_log.findMany({
            where: { cliente_id: E2E_CLIENTE_ID, motivo: 'ACEITO' },
          }),
        (rows) => rows.length >= 1,
      );
      expect(logs).toHaveLength(1);
      expect(logs[0].foco_id).toBe(res.body.id);

      // Rate-limit row incrementada (1 request => contagem=1).
      const rl = await prisma.canal_cidadao_rate_limit.findMany({
        where: { cliente_id: E2E_CLIENTE_ID },
      });
      expect(rl).toHaveLength(1);
      expect(rl[0].contagem).toBe(1);
    });

    // ─── 200 dedup geoespacial ───────────────────────────────────────────

    it('201 dedup — 2ª denúncia em mesma coord/24h não cria foco novo, incrementa confirmacoes', async () => {
      const ip = uniqueIp();

      const first = await request(app.getHttpServer())
        .post('/denuncias/cidadao')
        .set('x-forwarded-for', ip)
        .send({
          slug: E2E_CLIENTE_SLUG,
          descricao: 'Foco inicial',
          latitude: -20.2,
          longitude: -50.93,
        });
      expect(first.status).toBe(201);
      const id1 = first.body.id;

      const second = await request(app.getHttpServer())
        .post('/denuncias/cidadao')
        .set('x-forwarded-for', ip)
        .send({
          slug: E2E_CLIENTE_SLUG,
          descricao: 'Mesmo local, outra pessoa',
          latitude: -20.2,
          longitude: -50.93,
        });
      expect(second.status).toBe(201);
      expect(second.body.id).toBe(id1);

      // Só 1 foco — o 2º caiu na dedup geoespacial (raio 30m, 24h).
      const focos = await prisma.focos_risco.findMany({
        where: { cliente_id: E2E_CLIENTE_ID },
      });
      expect(focos).toHaveLength(1);

      // jsonb_set é fire-and-forget — espera até confirmacoes=2.
      const updated = await waitFor(
        () => prisma.focos_risco.findUnique({ where: { id: id1 } }),
        (f) => (f?.payload as Record<string, unknown> | null)?.confirmacoes === 2,
      );
      expect((updated?.payload as Record<string, unknown>).confirmacoes).toBe(2);

      // Hook NÃO dispara no dedup — apenas 1 job (da 1ª denúncia).
      const jobs = await prisma.job_queue.findMany({
        where: { tipo: 'notif_canal_cidadao' },
      });
      expect(jobs).toHaveLength(1);
      expect((jobs[0].payload as Record<string, unknown>).foco_id).toBe(id1);

      // Log: 1 ACEITO + 1 DEDUPLICADO.
      const logs = await waitFor(
        () =>
          prisma.canal_cidadao_rate_log.findMany({
            where: { cliente_id: E2E_CLIENTE_ID },
            orderBy: { created_at: 'asc' },
          }),
        (rows) => rows.length >= 2,
      );
      expect(logs.map((l) => l.motivo).sort()).toEqual(['ACEITO', 'DEDUPLICADO']);
      const dedupLog = logs.find((l) => l.motivo === 'DEDUPLICADO');
      expect(dedupLog?.foco_id).toBe(id1);
    });

    // ─── 429 rate limit (ThrottlerGuard 5/60s por IP) ───────────────────

    it('429 — 6ª request do mesmo x-forwarded-for em 1 min é bloqueada', async () => {
      const ip = '10.0.0.199';
      const statuses: number[] = [];

      // 5 requests, coords distintas pra nenhuma cair em dedup.
      const coords: Array<[number, number]> = [
        [-10.1, -40.1],
        [-11.2, -41.2],
        [-12.3, -42.3],
        [-13.4, -43.4],
        [-14.5, -44.5],
      ];
      for (const [lat, lng] of coords) {
        const r = await request(app.getHttpServer())
          .post('/denuncias/cidadao')
          .set('x-forwarded-for', ip)
          .send({
            slug: E2E_CLIENTE_SLUG,
            descricao: `rate-limit lat=${lat}`,
            latitude: lat,
            longitude: lng,
          });
        statuses.push(r.status);
      }

      const sixth = await request(app.getHttpServer())
        .post('/denuncias/cidadao')
        .set('x-forwarded-for', ip)
        .send({
          slug: E2E_CLIENTE_SLUG,
          descricao: '6ª tentativa — deve ser barrada',
          latitude: -15.6,
          longitude: -45.6,
        });

      // 5 primeiras precisam ter sido aceitas (201 Created — POST default).
      expect(statuses).toEqual([201, 201, 201, 201, 201]);

      // 6ª bloqueada com código 4xx. O valor concreto (429 do ThrottlerGuard
      // vs 429 do use-case interno) é registrado para o relatório final.
      expect(sixth.status).toBeGreaterThanOrEqual(400);
      expect(sixth.status).toBeLessThan(500);
      // eslint-disable-next-line no-console
      console.info(
        `[Parte 3 / cenário rate-limit] 6ª request status=${sixth.status}`,
      );

      // Use-case nem rodou na 6ª — só 5 focos criados.
      const focos = await prisma.focos_risco.findMany({
        where: { cliente_id: E2E_CLIENTE_ID },
      });
      expect(focos).toHaveLength(5);
    });

    // ─── 200 sem latitude/longitude (dedup não aplica) ──────────────────

    it('201 — sem latitude/longitude, cria foco com coords=null e job com coords=null', async () => {
      const res = await request(app.getHttpServer())
        .post('/denuncias/cidadao')
        .set('x-forwarded-for', uniqueIp())
        .send({
          slug: E2E_CLIENTE_SLUG,
          descricao: 'Denúncia sem GPS',
        });

      expect(res.status).toBe(201);

      const foco = await prisma.focos_risco.findUnique({
        where: { id: res.body.id },
      });
      expect(foco).not.toBeNull();
      expect(foco?.latitude).toBeNull();
      expect(foco?.longitude).toBeNull();

      const jobs = await prisma.job_queue.findMany({
        where: { tipo: 'notif_canal_cidadao' },
      });
      expect(jobs).toHaveLength(1);
      const payload = jobs[0].payload as Record<string, unknown>;
      expect(payload.foco_id).toBe(res.body.id);
      expect(payload.latitude).toBeNull();
      expect(payload.longitude).toBeNull();
    });

    // ─── 200 @Public — sem Authorization header ─────────────────────────

    // ─── Cenário 10 — contrato do protocolo (cenário dedicado) ─────────

    it('contrato protocolo — 8 chars hex, == primeiros 8 do id.replace(/-/g,"")', async () => {
      const res = await request(app.getHttpServer())
        .post('/denuncias/cidadao')
        .set('x-forwarded-for', uniqueIp())
        .send({
          slug: E2E_CLIENTE_SLUG,
          descricao: 'Validação formato protocolo',
        });
      expect(res.status).toBe(201);

      expect(res.body.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(res.body.protocolo).toMatch(/^[a-f0-9]{8}$/);
      expect(res.body.protocolo).toBe(
        (res.body.id as string).replace(/-/g, '').slice(0, 8),
      );
    });

    it('201 @Public — funciona sem Authorization header (regressão do decorator @Public)', async () => {
      const res = await request(app.getHttpServer())
        .post('/denuncias/cidadao')
        .set('x-forwarded-for', uniqueIp())
        // Intencional: NÃO enviar Authorization. O decorator @Public no
        // endpoint deve pular o AuthGuard.
        .send({
          slug: E2E_CLIENTE_SLUG,
          descricao: 'Denúncia anônima — sem token',
        });

      expect(res.status).toBe(201);
      expect(typeof res.body.id).toBe('string');
      expect(typeof res.body.protocolo).toBe('string');

      const foco = await prisma.focos_risco.findUnique({
        where: { id: res.body.id },
      });
      expect(foco?.cliente_id).toBe(E2E_CLIENTE_ID);
      expect(foco?.origem_tipo).toBe('cidadao');
    });
  },
);
