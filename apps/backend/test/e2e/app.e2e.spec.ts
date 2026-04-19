import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

const skipE2e = process.env.SKIP_E2E === '1';

(skipE2e ? describe.skip : describe)('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const { AppModule } = await import('@/app.module');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  }, 120_000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /api-docs expõe documentação Swagger', async () => {
    const res = await request(app.getHttpServer()).get('/api-docs').expect(200);
    expect(res.text.toLowerCase()).toMatch(/swagger/);
  });

  it('POST /auth/login rejeita payload inválido (Zod)', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nao-e-email', password: '123456' })
      .expect(400);
  });

  it('POST /auth/login rejeita senha curta', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user@test.com', password: '12345' })
      .expect(400);
  });

  describe('Operações — rotas protegidas (sem token → 401)', () => {
    it('GET /operacoes', async () => {
      await request(app.getHttpServer()).get('/operacoes').expect(401);
    });

    it('GET /operacoes/pagination', async () => {
      await request(app.getHttpServer())
        .get('/operacoes/pagination')
        .expect(401);
    });

    it('GET /operacoes/stats', async () => {
      await request(app.getHttpServer()).get('/operacoes/stats').expect(401);
    });

    it('GET /operacoes/com-vinculos', async () => {
      await request(app.getHttpServer())
        .get('/operacoes/com-vinculos')
        .expect(401);
    });

    it('POST /operacoes', async () => {
      await request(app.getHttpServer())
        .post('/operacoes')
        .send({})
        .expect(401);
    });

    it('POST /operacoes/bulk-insert', async () => {
      await request(app.getHttpServer())
        .post('/operacoes/bulk-insert')
        .send({ operacoes: [] })
        .expect(401);
    });
  });
});
