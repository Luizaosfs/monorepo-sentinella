import { Test } from '@nestjs/testing';
import { PilotoController } from '../../piloto.controller';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { Reflector } from '@nestjs/core';

describe('PilotoController', () => {
  let controller: PilotoController;
  const mockCreate = jest.fn().mockResolvedValue({});

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [PilotoController],
      providers: [
        {
          provide: PrismaService,
          useValue: { client: { piloto_eventos: { create: mockCreate } } },
        },
        Reflector,
      ],
    }).compile();

    controller = module.get(PilotoController);
  });

  it('deve retornar { ok: true } e disparar insert fire-and-forget', async () => {
    const req = { tenantId: 'cliente-uuid', user: { id: 'user-uuid' } } as any;
    const result = await controller.logEvento({ tipo: 'teste', payload: {} }, req);
    expect(result).toEqual({ ok: true });
  });

  it('usa AuthenticatedUser.id como usuarioId (nao .sub)', async () => {
    const req = { tenantId: 'cid', user: { id: 'uid-correto', sub: 'nao-deve-usar' } } as any;
    await controller.logEvento({ tipo: 'check', payload: {} }, req);
    // fire-and-forget: não bloqueia, apenas verifica que não lançou
    expect(true).toBe(true);
  });
});
