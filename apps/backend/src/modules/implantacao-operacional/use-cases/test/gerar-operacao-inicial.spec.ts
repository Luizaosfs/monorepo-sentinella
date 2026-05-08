import { Test, TestingModule } from '@nestjs/testing';
import { mock, MockProxy } from 'jest-mock-extended';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { ImplantacaoException } from '../../errors/implantacao.exception';
import { GerarOperacaoInicial } from '../gerar-operacao-inicial';

const CLIENT_ID = 'aaaaaaaa-0000-0000-0000-000000000002';
const CICLO_ATIVO = { id: 'cc000002', numero: 3 };
const PLANEJAMENTO_ATIVO = { id: 'pp000002', ativo: true };

describe('GerarOperacaoInicial', () => {
  let useCase: GerarOperacaoInicial;
  let prismaMock: MockProxy<PrismaService>;

  beforeEach(async () => {
    prismaMock = mock<PrismaService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GerarOperacaoInicial,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    useCase = module.get<GerarOperacaoInicial>(GerarOperacaoInicial);

    // defaults: tudo ok (happy path)
    (prismaMock.client as any) = {
      ciclos: { findFirst: jest.fn().mockResolvedValue(CICLO_ATIVO) },
      usuarios: { count: jest.fn().mockResolvedValue(2) },
      distribuicao_quarteirao: {
        findMany: jest.fn().mockResolvedValue([
          { quarteirao: 'Q01', agente_id: 'ag-001' },
          { quarteirao: 'Q02', agente_id: 'ag-002' },
        ]),
      },
      imoveis: { count: jest.fn().mockResolvedValue(30) },
      planejamento: {
        findFirst: jest.fn().mockResolvedValue(PLANEJAMENTO_ATIVO),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
  });

  it('deve lançar semCicloAtivo quando não há ciclo ativo', async () => {
    (prismaMock.client as any).ciclos.findFirst.mockResolvedValue(null);
    await expect(useCase.execute(CLIENT_ID)).rejects.toMatchObject({ message: expect.stringContaining('ciclo') });
  });

  it('deve lançar semAgentes quando não há agentes ativos', async () => {
    (prismaMock.client as any).usuarios.count.mockResolvedValue(0);
    await expect(useCase.execute(CLIENT_ID)).rejects.toMatchObject({ message: expect.stringContaining('agente') });
  });

  it('deve lançar semDistribuicao quando nenhum quarteirão distribuído', async () => {
    (prismaMock.client as any).distribuicao_quarteirao.findMany.mockResolvedValue([]);
    await expect(useCase.execute(CLIENT_ID)).rejects.toMatchObject({ message: expect.stringContaining('quarteirão') });
  });

  it('deve lançar semImoveis quando não há imóveis nos quarteirões distribuídos', async () => {
    (prismaMock.client as any).imoveis.count.mockResolvedValue(0);
    await expect(useCase.execute(CLIENT_ID)).rejects.toMatchObject({ message: expect.stringContaining('imóvel') });
  });

  it('deve retornar resumo com planejamentoId e stats corretos', async () => {
    const result = await useCase.execute(CLIENT_ID);

    expect(result.planejamentoId).toBe(PLANEJAMENTO_ATIVO.id);
    expect(result.cicloId).toBe(CICLO_ATIVO.id);
    expect(result.totalImoveisElegiveis).toBe(30);
    expect(result.totalImoveisIncluidos).toBe(30);
    expect(result.totalAgentesComRota).toBe(2);
    expect(result.totalAgentesSemRota).toBe(0);
    expect(result.mensagem).toContain('30 imóvel(is)');
  });

  it('deve ser idempotente — não duplica planejamento se já existir', async () => {
    await useCase.execute(CLIENT_ID);
    await useCase.execute(CLIENT_ID);

    expect((prismaMock.client as any).planejamento.create).not.toHaveBeenCalled();
    expect((prismaMock.client as any).planejamento.update).not.toHaveBeenCalled();
  });

  it('deve ativar planejamento inativo ao invés de criar novo', async () => {
    (prismaMock.client as any).planejamento.findFirst.mockResolvedValue({ id: 'pp-inativo', ativo: false });
    (prismaMock.client as any).planejamento.update.mockResolvedValue({});

    await useCase.execute(CLIENT_ID);

    expect((prismaMock.client as any).planejamento.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'pp-inativo' }, data: { ativo: true } }),
    );
    expect((prismaMock.client as any).planejamento.create).not.toHaveBeenCalled();
  });

  it('deve criar planejamento quando não existe nenhum', async () => {
    (prismaMock.client as any).planejamento.findFirst.mockResolvedValue(null);
    (prismaMock.client as any).planejamento.create.mockResolvedValue({ id: 'pp-novo', ativo: true });

    const result = await useCase.execute(CLIENT_ID);

    expect((prismaMock.client as any).planejamento.create).toHaveBeenCalledTimes(1);
    expect(result.planejamentoId).toBe('pp-novo');
  });

  it('deve proteger tenantId — todas as queries filtram por CLIENT_ID', async () => {
    await useCase.execute(CLIENT_ID);

    expect((prismaMock.client as any).ciclos.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ cliente_id: CLIENT_ID }) }),
    );
    expect((prismaMock.client as any).imoveis.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ cliente_id: CLIENT_ID }) }),
    );
  });
});
