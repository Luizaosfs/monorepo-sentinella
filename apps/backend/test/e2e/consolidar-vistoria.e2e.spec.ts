import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import request = require('supertest');

import {
  AGENTE_AUTH_ID,
  E2E_CLIENTE_ID,
  signTokenFor,
} from './auth-helpers';

const skipE2e = process.env.SKIP_E2E === '1';

(skipE2e ? describe.skip : describe)(
  'ConsolidarVistoria hook (e2e)',
  () => {
    let app: INestApplication;
    let prisma: PrismaClient;
    let pool: Pool;
    let agenteToken: string;

    beforeAll(async () => {
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

      agenteToken = signTokenFor(AGENTE_AUTH_ID);
    }, 120_000);

    afterAll(async () => {
      if (app) await app.close();
      if (prisma) await prisma.$disconnect();
    });

    afterEach(async () => {
      await prisma.vistoria_consolidacao_historico.deleteMany({
        where: { vistoria_id: { in: await prisma.vistorias.findMany({ where: { cliente_id: E2E_CLIENTE_ID }, select: { id: true } }).then(vs => vs.map(v => v.id)) } },
      });
      await prisma.vistoria_depositos.deleteMany({ where: { cliente_id: E2E_CLIENTE_ID } });
      await prisma.vistoria_sintomas.deleteMany({ where: { cliente_id: E2E_CLIENTE_ID } });
      await prisma.vistoria_riscos.deleteMany({ where: { cliente_id: E2E_CLIENTE_ID } });
      await prisma.vistoria_calhas.deleteMany({ where: { cliente_id: E2E_CLIENTE_ID } });
      await prisma.vistorias.deleteMany({ where: { cliente_id: E2E_CLIENTE_ID } });
    });

    it('POST /vistorias — consolidação automática grava prioridade_final na resposta', async () => {
      const res = await request(app.getHttpServer())
        .post('/vistorias')
        .set('Authorization', `Bearer ${agenteToken}`)
        .send({
          ciclo: 1,
          tipoAtividade: 'LI',
          dataVisita: new Date().toISOString(),
          acessoRealizado: false,
        });

      expect(res.status).toBe(201);
      const body = res.body;
      expect(body.prioridadeFinal).toMatch(/^P[1-5]$/);
      expect(body.resultadoOperacional).toBe('sem_acesso');
      expect(body.consolidadoEm).toBeTruthy();
    });

    it('POST /vistorias com acesso → prioridade_final P3 (sem fichas = incompleto)', async () => {
      const res = await request(app.getHttpServer())
        .post('/vistorias')
        .set('Authorization', `Bearer ${agenteToken}`)
        .send({
          ciclo: 1,
          tipoAtividade: 'LI',
          dataVisita: new Date().toISOString(),
          acessoRealizado: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.resultadoOperacional).toBe('visitado');
      expect(res.body.consolidacaoIncompleta).toBe(true);
      expect(res.body.prioridadeFinal).toBe('P3');
    });

    it('POST /vistorias/completa com depósito com larva → risco_vetorial critico', async () => {
      const res = await request(app.getHttpServer())
        .post('/vistorias/completa')
        .set('Authorization', `Bearer ${agenteToken}`)
        .send({
          ciclo: 1,
          tipoAtividade: 'LI',
          dataVisita: new Date().toISOString(),
          acessoRealizado: true,
          depositos: [{ tipoDeposito: 'B', comLarva: true, qtdComFocos: 1, qtdInspecionados: 1 }],
        });

      expect(res.status).toBe(201);
      const vistoriaId = res.body.id;
      expect(vistoriaId).toBeTruthy();

      const vistoria = await prisma.vistorias.findUnique({ where: { id: vistoriaId } });
      expect(vistoria?.risco_vetorial).toBe('critico');
      expect(vistoria?.prioridade_final).toMatch(/^P[1-3]$/);
      expect(vistoria?.consolidado_em).toBeTruthy();
    });

    it('PUT /vistorias/:id dispara reconsolidação e cria historico', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/vistorias')
        .set('Authorization', `Bearer ${agenteToken}`)
        .send({
          ciclo: 1,
          tipoAtividade: 'LI',
          dataVisita: new Date().toISOString(),
          acessoRealizado: false,
        });
      expect(createRes.status).toBe(201);
      const vistoriaId = createRes.body.id;

      const updateRes = await request(app.getHttpServer())
        .put(`/vistorias/${vistoriaId}`)
        .set('Authorization', `Bearer ${agenteToken}`)
        .send({ status: 'concluida', acessoRealizado: true });
      expect(updateRes.status).toBe(200);

      const historico = await prisma.vistoria_consolidacao_historico.findMany({
        where: { vistoria_id: vistoriaId },
      });
      expect(historico.length).toBeGreaterThanOrEqual(1);
      expect(historico[0].motivo_reprocessamento).toMatch(/UPDATE em vistorias/);
    });
  },
);
