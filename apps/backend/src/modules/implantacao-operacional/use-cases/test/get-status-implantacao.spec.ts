import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { GetStatusImplantacao } from '../get-status-implantacao';

const CLIENT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

const CICLO_ATIVO = { id: 'cc000001', numero: 3, ano: 2026, status: 'ativo' };
const PLANEJAMENTO = { id: 'pp000001', descricao: 'Levantamento inicial - Ciclo 3', ativo: true };

describe('GetStatusImplantacao', () => {
  let useCase: GetStatusImplantacao;
  let prismaMock: MockProxy<PrismaService>;

  beforeEach(async () => {
    prismaMock = mock<PrismaService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetStatusImplantacao,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    useCase = module.get<GetStatusImplantacao>(GetStatusImplantacao);

    // defaults: tudo vazio
    (prismaMock.client as any) = {
      ciclos: { findFirst: jest.fn().mockResolvedValue(null) },
      bairros_quadras: { count: jest.fn().mockResolvedValue(0) },
      bairros_distribuicao: { findMany: jest.fn().mockResolvedValue([]) },
      planejamentos: { findFirst: jest.fn().mockResolvedValue(null) },
      imoveis: { count: jest.fn().mockResolvedValue(0) },
      $queryRaw: jest.fn().mockResolvedValue([{ total: 0 }]),
    };
  });

  it('deve retornar podeIniciar=false e bloqueio de ciclo quando não há ciclo ativo', async () => {
    const result = await useCase.execute(CLIENT_ID);

    expect(result.operacao.podeIniciar).toBe(false);
    expect(result.cicloAtivo.existe).toBe(false);
    expect(result.operacao.bloqueios).toContain('Nenhum ciclo ativo encontrado');
  });

  it('deve retornar podeIniciar=false quando não há agentes', async () => {
    (prismaMock.client as any).ciclos.findFirst.mockResolvedValue(CICLO_ATIVO);
    (prismaMock.client as any).bairros_quadras = { count: jest.fn().mockResolvedValue(5) };
    (prismaMock.client as any).$queryRaw
      .mockResolvedValueOnce([{ total: 0 }])  // agentes
      .mockResolvedValueOnce([{ total: 0 }]); // agentes com quarteirao

    const result = await useCase.execute(CLIENT_ID);

    expect(result.operacao.podeIniciar).toBe(false);
    expect(result.operacao.bloqueios).toContain('Nenhum agente ativo cadastrado');
  });

  it('deve retornar podeIniciar=false quando nenhum quarteirao foi distribuido', async () => {
    (prismaMock.client as any).ciclos.findFirst.mockResolvedValue(CICLO_ATIVO);
    (prismaMock.client as any).bairros_quadras = { count: jest.fn().mockResolvedValue(10) };
    (prismaMock.client as any).bairros_distribuicao.findMany.mockResolvedValue([]);
    (prismaMock.client as any).$queryRaw
      .mockResolvedValueOnce([{ total: 3 }])  // 3 agentes
      .mockResolvedValueOnce([{ total: 0 }]); // nenhum com quarteirao

    const result = await useCase.execute(CLIENT_ID);

    expect(result.operacao.podeIniciar).toBe(false);
    expect(result.operacao.bloqueios).toContain('Nenhum quarteirão distribuído para agentes');
  });

  it('deve retornar podeIniciar=true com ciclo, agentes e distribuição mínima', async () => {
    (prismaMock.client as any).ciclos.findFirst.mockResolvedValue(CICLO_ATIVO);
    (prismaMock.client as any).bairros_quadras = { count: jest.fn().mockResolvedValue(10) };
    (prismaMock.client as any).bairros_distribuicao.findMany.mockResolvedValue([
      { quadra_id: 'q1', agente_id: 'ag1' }, { quadra_id: 'q2', agente_id: 'ag2' },
    ]);
    (prismaMock.client as any).$queryRaw
      .mockResolvedValueOnce([{ total: 3 }])  // agentes ativos
      .mockResolvedValueOnce([{ total: 1 }]); // visitados no ciclo
    (prismaMock.client as any).planejamentos.findFirst.mockResolvedValue(PLANEJAMENTO);
    (prismaMock.client as any).imoveis.count.mockResolvedValue(15);

    const result = await useCase.execute(CLIENT_ID);

    expect(result.operacao.podeIniciar).toBe(true);
    expect(result.operacao.bloqueios).toHaveLength(0);
    expect(result.cicloAtivo.existe).toBe(true);
    expect(result.cicloAtivo.numero).toBe(3);
    expect(result.territorio.quarteiroesComAgente).toBe(2);
    expect(result.territorio.percentualDistribuido).toBe(20);
    expect(result.planejamentoInicial.existe).toBe(true);
    expect(result.operacaoInicial.totalImoveisElegiveis).toBe(15);
    expect(result.operacaoInicial.totalImoveisJaVisitadosNoCiclo).toBe(1);
    expect(result.operacaoInicial.totalImoveisPendentes).toBe(14);
    expect(result.operacaoInicial.podeGerar).toBe(true);
    expect(result.operacaoInicial.bloqueios).toHaveLength(0);
  });

  it('deve retornar operacaoInicial.podeGerar=false sem imóveis nos quarteirões', async () => {
    (prismaMock.client as any).ciclos.findFirst.mockResolvedValue(CICLO_ATIVO);
    (prismaMock.client as any).bairros_quadras = { count: jest.fn().mockResolvedValue(5) };
    (prismaMock.client as any).bairros_distribuicao.findMany.mockResolvedValue([
      { quadra_id: 'q1', agente_id: 'ag1' },
    ]);
    (prismaMock.client as any).$queryRaw
      .mockResolvedValueOnce([{ total: 2 }]); // agentes ativos
    (prismaMock.client as any).imoveis.count.mockResolvedValue(0);

    const result = await useCase.execute(CLIENT_ID);

    expect(result.operacao.podeIniciar).toBe(true);
    expect(result.operacaoInicial.podeGerar).toBe(false);
    expect(result.operacaoInicial.totalImoveisElegiveis).toBe(0);
    expect(result.operacaoInicial.bloqueios).toContain('Nenhum imóvel nos quarteirões distribuídos');
  });

  it('deve proteger tenantId — clienteId recebido como parâmetro é sempre o do guard', async () => {
    (prismaMock.client as any).ciclos.findFirst.mockResolvedValue(null);

    await useCase.execute(CLIENT_ID);

    expect((prismaMock.client as any).ciclos.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ cliente_id: CLIENT_ID }) }),
    );
    expect((prismaMock.client as any).bairros_quadras.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ cliente_id: CLIENT_ID }) }),
    );
  });
});
