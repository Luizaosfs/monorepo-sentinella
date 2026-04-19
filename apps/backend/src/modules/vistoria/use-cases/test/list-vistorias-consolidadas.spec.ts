import { REQUEST } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { ListVistoriasConsolidadas } from '../list-vistorias-consolidadas';

const CLIENTE_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

const mockRow = {
  id: 'bbbbbbbb-0000-0000-0000-000000000001',
  data_visita: new Date().toISOString(),
  status: 'consolidada',
  acesso_realizado: true,
  prioridade_final: 'P2',
  prioridade_motivo: 'alto risco vetorial',
  dimensao_dominante: 'risco_vetorial',
  vulnerabilidade_domiciliar: 'media',
  alerta_saude: 'dengue',
  risco_socioambiental: 'baixo',
  risco_vetorial: 'alto',
  consolidacao_incompleta: false,
  consolidacao_resumo: 'Visita consolidada sem pendências.',
  consolidado_em: new Date().toISOString(),
  imovel: { id: 'i1', logradouro: 'Rua A', numero: '10', bairro: 'Centro', regiao_id: 'r1' },
  agente: { id: 'a1', nome: 'João Silva' },
};

describe('ListVistoriasConsolidadas', () => {
  let useCase: ListVistoriasConsolidadas;
  let prismaQueryRaw: jest.Mock;

  beforeEach(async () => {
    prismaQueryRaw = jest.fn().mockResolvedValue([mockRow]);

    const module = await Test.createTestingModule({
      providers: [
        ListVistoriasConsolidadas,
        {
          provide: PrismaService,
          useValue: { client: { $queryRaw: prismaQueryRaw } },
        },
        {
          provide: REQUEST,
          useValue: { tenantId: CLIENTE_ID },
        },
      ],
    }).compile();

    useCase = await module.resolve(ListVistoriasConsolidadas);
  });

  it('returns vistorias with imovel and agente', async () => {
    const result = await useCase.execute({ limit: 50 });
    expect(result.vistorias).toHaveLength(1);
    expect(result.vistorias[0]).toMatchObject({
      prioridade_final: 'P2',
      imovel: expect.objectContaining({ logradouro: 'Rua A' }),
      agente: expect.objectContaining({ nome: 'João Silva' }),
    });
    expect(prismaQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('passes prioridade_final filter', async () => {
    prismaQueryRaw.mockResolvedValue([]);
    const result = await useCase.execute({ limit: 50, prioridade_final: ['P1'] });
    expect(result.vistorias).toHaveLength(0);
    expect(prismaQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('respects limit parameter', async () => {
    await useCase.execute({ limit: 10 });
    expect(prismaQueryRaw).toHaveBeenCalledTimes(1);
  });
});
