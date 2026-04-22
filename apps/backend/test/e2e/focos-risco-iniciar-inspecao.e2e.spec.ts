import { randomUUID } from 'node:crypto';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
// `esModuleInterop` desligado no tsconfig — supertest é CJS puro (idem app.e2e.spec.ts).
import request = require('supertest');

import {
  ADMIN_AUTH_ID,
  AGENTE_AUTH_ID,
  AGENTE_USUARIO_ID,
  E2E_CLIENTE_ID,
  INATIVO_AUTH_ID,
  signTokenFor,
  SUPERVISOR_AUTH_ID,
  SUPERVISOR_USUARIO_ID,
} from './auth-helpers';

const skipE2e = process.env.SKIP_E2E === '1';

// Cliente "outro" criado neste spec para teste de cross-tenant.
// Fora do seed canônico — local a este arquivo.
const OUTRO_CLIENTE_ID = '00000000-e2e0-4000-8000-0000000000ee';

(skipE2e ? describe.skip : describe)(
  'PATCH /focos-risco/:id/iniciar-inspecao (e2e)',
  () => {
    let app: INestApplication;
    let prisma: PrismaClient;
    let pool: Pool;

    beforeAll(async () => {
      const { AppModule } = await import('@/app.module');
      const { MyZodValidationPipe } = await import(
        '@/pipes/zod-validations.pipe'
      );
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

      // Cliente isolado para teste cross-tenant. Idempotente.
      await prisma.clientes.upsert({
        where: { id: OUTRO_CLIENTE_ID },
        create: {
          id: OUTRO_CLIENTE_ID,
          slug: 'e2e-outro',
          nome: 'E2E Outro Município',
          ativo: true,
        },
        update: { ativo: true, slug: 'e2e-outro', nome: 'E2E Outro Município' },
      });
    }, 120_000);

    afterAll(async () => {
      if (app) await app.close();
      if (prisma) await prisma.$disconnect();
    });

    afterEach(async () => {
      // Limpeza por tenant — não toca dados de outros clientes do banco.
      await prisma.foco_risco_historico.deleteMany({
        where: { cliente_id: { in: [E2E_CLIENTE_ID, OUTRO_CLIENTE_ID] } },
      });
      await prisma.focos_risco.deleteMany({
        where: { cliente_id: { in: [E2E_CLIENTE_ID, OUTRO_CLIENTE_ID] } },
      });
    });

    async function createFoco(
      overrides: {
        status?: string;
        clienteId?: string;
        responsavelId?: string | null;
        inspecaoEm?: Date | null;
      } = {},
    ) {
      const id = randomUUID();
      return prisma.focos_risco.create({
        data: {
          id,
          cliente_id: overrides.clienteId ?? E2E_CLIENTE_ID,
          origem_tipo: 'agente',
          status: overrides.status ?? 'aguarda_inspecao',
          classificacao_inicial: 'suspeito',
          responsavel_id: overrides.responsavelId ?? null,
          inspecao_em: overrides.inspecaoEm ?? null,
        },
      });
    }

    // ─── 401 / 403 / 400 / 404 ───────────────────────────────────────────

    it('401 sem token (AuthGuard)', async () => {
      const foco = await createFoco();
      await request(app.getHttpServer())
        .patch(`/focos-risco/${foco.id}/iniciar-inspecao`)
        .send({})
        .expect(401);
    });

    it('401 token inválido (AuthGuard.verifyAsync falha)', async () => {
      const foco = await createFoco();
      await request(app.getHttpServer())
        .patch(`/focos-risco/${foco.id}/iniciar-inspecao`)
        .set('Authorization', 'Bearer not-a-valid-jwt')
        .send({})
        .expect(401);
    });

    it('401 usuário inativo (AuthGuard rejeita antes do use-case)', async () => {
      const foco = await createFoco();
      await request(app.getHttpServer())
        .patch(`/focos-risco/${foco.id}/iniciar-inspecao`)
        .set('Authorization', `Bearer ${signTokenFor(INATIVO_AUTH_ID)}`)
        .send({})
        .expect(401);
    });

    it('401 supervisor (RolesGuard — endpoint só @Roles(admin, agente))', async () => {
      const foco = await createFoco();
      await request(app.getHttpServer())
        .patch(`/focos-risco/${foco.id}/iniciar-inspecao`)
        .set('Authorization', `Bearer ${signTokenFor(SUPERVISOR_AUTH_ID)}`)
        .send({})
        .expect(401);
    });

    it('403 admin — passa RolesGuard mas use-case G3 (apenasAgenteInicia) bloqueia', async () => {
      const foco = await createFoco();
      await request(app.getHttpServer())
        .patch(`/focos-risco/${foco.id}/iniciar-inspecao`)
        .set('Authorization', `Bearer ${signTokenFor(ADMIN_AUTH_ID)}`)
        .send({})
        .expect(403);
    });

    it('404 foco inexistente', async () => {
      await request(app.getHttpServer())
        .patch(`/focos-risco/${randomUUID()}/iniciar-inspecao`)
        .set('Authorization', `Bearer ${signTokenFor(AGENTE_AUTH_ID)}`)
        .send({})
        .expect(404);
    });

    it('404 cross-tenant (foco de outro cliente — assertFocoDoTenant)', async () => {
      const foco = await createFoco({ clienteId: OUTRO_CLIENTE_ID });
      await request(app.getHttpServer())
        .patch(`/focos-risco/${foco.id}/iniciar-inspecao`)
        .set('Authorization', `Bearer ${signTokenFor(AGENTE_AUTH_ID)}`)
        .send({})
        .expect(404);
    });

    it('400 status inválido (foco em "confirmado")', async () => {
      const foco = await createFoco({ status: 'confirmado' });
      await request(app.getHttpServer())
        .patch(`/focos-risco/${foco.id}/iniciar-inspecao`)
        .set('Authorization', `Bearer ${signTokenFor(AGENTE_AUTH_ID)}`)
        .send({})
        .expect(400);
    });

    // ─── happy path ──────────────────────────────────────────────────────

    it('200 happy path — agente inicia: status=em_inspecao, responsavel=caller, historico append', async () => {
      const foco = await createFoco({ status: 'aguarda_inspecao' });

      const res = await request(app.getHttpServer())
        .patch(`/focos-risco/${foco.id}/iniciar-inspecao`)
        .set('Authorization', `Bearer ${signTokenFor(AGENTE_AUTH_ID)}`)
        .send({})
        .expect(200);

      expect(res.body.id).toBe(foco.id);
      expect(res.body.status).toBe('em_inspecao');

      const persisted = await prisma.focos_risco.findUnique({
        where: { id: foco.id },
      });
      expect(persisted?.status).toBe('em_inspecao');
      // G6: responsavel era NULL → preenchido com user.id (= AGENTE_USUARIO_ID).
      expect(persisted?.responsavel_id).toBe(AGENTE_USUARIO_ID);
      expect(persisted?.inspecao_em).not.toBeNull();

      const historico = await prisma.foco_risco_historico.findMany({
        where: { foco_risco_id: foco.id },
      });
      expect(historico).toHaveLength(1);
      expect(historico[0]).toMatchObject({
        status_anterior: 'aguarda_inspecao',
        status_novo: 'em_inspecao',
        tipo_evento: 'inspecao_iniciada',
        alterado_por: AGENTE_USUARIO_ID,
      });
    });

    // ─── G4 idempotência ─────────────────────────────────────────────────

    it('200 G4 idempotência — segunda chamada não duplica historico', async () => {
      const foco = await createFoco({ status: 'aguarda_inspecao' });

      await request(app.getHttpServer())
        .patch(`/focos-risco/${foco.id}/iniciar-inspecao`)
        .set('Authorization', `Bearer ${signTokenFor(AGENTE_AUTH_ID)}`)
        .send({})
        .expect(200);

      // Foco agora está em em_inspecao. Segunda chamada cai em G4.
      const res = await request(app.getHttpServer())
        .patch(`/focos-risco/${foco.id}/iniciar-inspecao`)
        .set('Authorization', `Bearer ${signTokenFor(AGENTE_AUTH_ID)}`)
        .send({})
        .expect(200);

      expect(res.body.status).toBe('em_inspecao');

      const historico = await prisma.foco_risco_historico.findMany({
        where: { foco_risco_id: foco.id },
      });
      // Apenas 1 registro — G4 retorna sem criar novo histórico.
      expect(historico).toHaveLength(1);
    });

    // ─── G6 COALESCE ─────────────────────────────────────────────────────

    it('200 G6 COALESCE responsavel — preserva responsavel_id já preenchido', async () => {
      const foco = await createFoco({ responsavelId: SUPERVISOR_USUARIO_ID });

      await request(app.getHttpServer())
        .patch(`/focos-risco/${foco.id}/iniciar-inspecao`)
        .set('Authorization', `Bearer ${signTokenFor(AGENTE_AUTH_ID)}`)
        .send({})
        .expect(200);

      const persisted = await prisma.focos_risco.findUnique({
        where: { id: foco.id },
      });
      // Não foi sobrescrito pelo caller (AGENTE_USUARIO_ID).
      expect(persisted?.responsavel_id).toBe(SUPERVISOR_USUARIO_ID);
    });

    it('200 G6 COALESCE inspecao_em — preserva timestamp já preenchido', async () => {
      const ts = new Date('2025-01-15T10:00:00.000Z');
      const foco = await createFoco({ inspecaoEm: ts });

      await request(app.getHttpServer())
        .patch(`/focos-risco/${foco.id}/iniciar-inspecao`)
        .set('Authorization', `Bearer ${signTokenFor(AGENTE_AUTH_ID)}`)
        .send({})
        .expect(200);

      const persisted = await prisma.focos_risco.findUnique({
        where: { id: foco.id },
      });
      expect(persisted?.inspecao_em?.toISOString()).toBe(ts.toISOString());
    });

    // ─── observacao ──────────────────────────────────────────────────────

    it('200 observacao — gravada em foco.observacao e historico.motivo', async () => {
      const foco = await createFoco();
      const obs = 'Vizinho relatou caixa d agua aberta';

      await request(app.getHttpServer())
        .patch(`/focos-risco/${foco.id}/iniciar-inspecao`)
        .set('Authorization', `Bearer ${signTokenFor(AGENTE_AUTH_ID)}`)
        .send({ observacao: obs })
        .expect(200);

      const persisted = await prisma.focos_risco.findUnique({
        where: { id: foco.id },
      });
      expect(persisted?.observacao).toBe(obs);

      const historico = await prisma.foco_risco_historico.findFirst({
        where: { foco_risco_id: foco.id },
      });
      expect(historico?.motivo).toBe(obs);
    });
  },
);
