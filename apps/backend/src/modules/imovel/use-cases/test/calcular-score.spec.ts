import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { Imovel } from '../../entities/imovel';
import { ImovelException } from '../../errors/imovel.exception';
import { ScoreInputs } from '../../repositories/imovel-read.repository';
import { ImovelReadRepository } from '../../repositories/imovel-read.repository';
import { ImovelWriteRepository } from '../../repositories/imovel-write.repository';
import { expectHttpException } from '@test/utils/expect-http-exception';
import { CalcularScore } from '../calcular-score';

const imovelBase = new Imovel(
  {
    clienteId: 'cliente-1',
    tipoImovel: 'residencial',
    ativo: true,
    proprietarioAusente: false,
    temAnimalAgressivo: false,
    historicoRecusa: false,
    temCalha: false,
    calhaAcessivel: true,
    prioridadeDrone: false,
    bairro: 'Centro',
  },
  { id: 'imovel-1' },
);

function inputsBase(overrides: Partial<ScoreInputs> = {}): ScoreInputs {
  return {
    imovel: imovelBase,
    config: null,
    focosAtivos: [],
    historicoFocosCount: 0,
    focosResolvidosCount: 0,
    slaVencidosCount: 0,
    vistoriasNegativasCount: 0,
    casosProximosCount: 0,
    denunciaCidadaoCount: 0,
    chuvaAlta: false,
    tempAlta: false,
    ...overrides,
  };
}

describe('CalcularScore', () => {
  let useCase: CalcularScore;
  const readRepo = mock<ImovelReadRepository>();
  const writeRepo = mock<ImovelWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    writeRepo.seedScoreConfigIfMissing.mockResolvedValue();
    writeRepo.upsertScore.mockResolvedValue();
    readRepo.findScoreConfig.mockResolvedValue(null);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalcularScore,
        { provide: ImovelReadRepository, useValue: readRepo },
        { provide: ImovelWriteRepository, useValue: writeRepo },
      ],
    }).compile();
    useCase = module.get(CalcularScore);
  });

  it('lança notFound quando imóvel não existe', async () => {
    readRepo.findScoreInputs.mockResolvedValue(inputsBase({ imovel: null }));

    await expectHttpException(
      () => useCase.execute('imovel-x', 'cliente-1'),
      ImovelException.notFound(),
    );
  });

  it('chama seedScoreConfigIfMissing quando config é null', async () => {
    readRepo.findScoreInputs.mockResolvedValue(inputsBase());

    await useCase.execute('imovel-1', 'cliente-1');

    expect(writeRepo.seedScoreConfigIfMissing).toHaveBeenCalledWith('cliente-1');
  });

  it('NÃO chama seedScoreConfigIfMissing quando config já existe', async () => {
    readRepo.findScoreInputs.mockResolvedValue(
      inputsBase({ config: { pesoFocoSuspeito: 10, pesoFocoConfirmado: 25, pesoFocoEmTratamento: 20, pesoFocoRecorrente: 35, pesoHistorico3focos: 15, pesoCaso300m: 25, pesoChuvaAlta: 10, pesoTemperatura30: 8, pesoDenunciaCidadao: 10, pesoSlaVencido: 12, pesoVistoriaNegativa: -8, pesoImovelRecusa: 8, pesoFocoResolvido: -15, janelaResolucaoDias: 30, janelaVistoriaDias: 45, janelaCasoDias: 60, capFocos: 40, capEpidemio: 30, capHistorico: 20 } }),
    );

    await useCase.execute('imovel-1', 'cliente-1');

    expect(writeRepo.seedScoreConfigIfMissing).not.toHaveBeenCalled();
  });

  it('score=0 para imóvel sem nenhum fator (usa defaults)', async () => {
    readRepo.findScoreInputs.mockResolvedValue(inputsBase());

    const { score, classificacao } = await useCase.execute('imovel-1', 'cliente-1');

    expect(score).toBe(0);
    expect(classificacao).toBe('baixo');
  });

  it('1 foco suspeito → score=10 (pesoFocoSuspeito default)', async () => {
    readRepo.findScoreInputs.mockResolvedValue(
      inputsBase({ focosAtivos: [{ status: 'suspeita', focoAnteriorId: null }] }),
    );

    const { score } = await useCase.execute('imovel-1', 'cliente-1');

    expect(score).toBe(10);
  });

  it('1 foco confirmado → score=25', async () => {
    readRepo.findScoreInputs.mockResolvedValue(
      inputsBase({ focosAtivos: [{ status: 'confirmado', focoAnteriorId: null }] }),
    );

    const { score } = await useCase.execute('imovel-1', 'cliente-1');

    expect(score).toBe(25);
  });

  it('foco em_tratamento conta junto com confirmado (pesoFocoConfirmado)', async () => {
    readRepo.findScoreInputs.mockResolvedValue(
      inputsBase({ focosAtivos: [{ status: 'em_tratamento', focoAnteriorId: null }] }),
    );

    const { score } = await useCase.execute('imovel-1', 'cliente-1');

    // em_tratamento usa pesoFocoConfirmado=25
    expect(score).toBe(25);
  });

  it('grupo focos é capeado em capFocos=40 com muitos focos ativos', async () => {
    // 5 focos confirmados × 25 = 125 → capeado em 40
    const focos = Array(5).fill({ status: 'confirmado', focoAnteriorId: null });
    readRepo.findScoreInputs.mockResolvedValue(inputsBase({ focosAtivos: focos }));

    const { score } = await useCase.execute('imovel-1', 'cliente-1');

    expect(score).toBe(40);
  });

  it('chuvaAlta + tempAlta somam no grupo epidemio', async () => {
    // pesoChuvaAlta=10 + pesoTemperatura30=8 = 18
    readRepo.findScoreInputs.mockResolvedValue(
      inputsBase({ chuvaAlta: true, tempAlta: true }),
    );

    const { score } = await useCase.execute('imovel-1', 'cliente-1');

    expect(score).toBe(18);
  });

  it('grupo epidemio é capeado em capEpidemio=30', async () => {
    // 5 casos × LEAST(5,2)=2 × 25 = 50 → capeado em 30
    readRepo.findScoreInputs.mockResolvedValue(inputsBase({ casosProximosCount: 5 }));

    const { score } = await useCase.execute('imovel-1', 'cliente-1');

    expect(score).toBe(30);
  });

  it('denunciaCidadaoCount contribui para grupo epidemio', async () => {
    // 1 denuncia × 10 = 10
    readRepo.findScoreInputs.mockResolvedValue(inputsBase({ denunciaCidadaoCount: 1 }));

    const { score } = await useCase.execute('imovel-1', 'cliente-1');

    expect(score).toBe(10);
  });

  it('vistoriasNegativasCount>0 aplica pesoVistoriaNegativa uma vez (boolean)', async () => {
    // pesoVistoriaNegativa = -8 (aplicado 1x independente do count)
    readRepo.findScoreInputs.mockResolvedValue(
      inputsBase({ vistoriasNegativasCount: 10 }),
    );

    const { score } = await useCase.execute('imovel-1', 'cliente-1');

    expect(score).toBe(0); // max(0, -8) = 0
  });

  it('historicoFocosCount >= 3 adiciona pesoHistorico3focos', async () => {
    readRepo.findScoreInputs.mockResolvedValue(inputsBase({ historicoFocosCount: 3 }));

    const { score } = await useCase.execute('imovel-1', 'cliente-1');

    expect(score).toBe(15); // pesoHistorico3focos=15
  });

  it('classificação critico >= 81', async () => {
    readRepo.findScoreInputs.mockResolvedValue(
      inputsBase({
        focosAtivos: Array(3).fill({ status: 'confirmado', focoAnteriorId: null }),
        casosProximosCount: 2,
        historicoFocosCount: 3,
        slaVencidosCount: 1,
        imovel: new Imovel(
          { ...imovelBase['props'], historicoRecusa: true },
          { id: 'imovel-1' },
        ),
      }),
    );

    const { classificacao } = await useCase.execute('imovel-1', 'cliente-1');

    // pontosFocos: min(3×25=75, 40) = 40
    // pontosHist: min(15, 20) = 15
    // pontosEpidem: min(min(2,2)×25 + 8 + min(1,2)×12, 30) = min(50+8+12=70, 30) = 30
    // score = 40 + 15 + 30 = 85 → critico
    expect(classificacao).toBe('critico');
  });

  it('classificação muito_alto: 61-80', async () => {
    // pontosFocos: min(2×25=50, 40) = 40
    // pontosEpidem: min(min(1,2)×25=25, 30) = 25
    // pontosHist: 0
    // score = 40 + 25 + 0 = 65 → muito_alto
    readRepo.findScoreInputs.mockResolvedValue(
      inputsBase({
        focosAtivos: Array(2).fill({ status: 'confirmado', focoAnteriorId: null }),
        casosProximosCount: 1,
      }),
    );

    const { classificacao } = await useCase.execute('imovel-1', 'cliente-1');

    expect(classificacao).toBe('muito_alto');
  });

  it('fatores usam snake_case e incluem chuva_alta, temp_alta, denuncia_cidadao', async () => {
    readRepo.findScoreInputs.mockResolvedValue(
      inputsBase({ chuvaAlta: true, tempAlta: true, denunciaCidadaoCount: 2 }),
    );

    const { fatores } = await useCase.execute('imovel-1', 'cliente-1');

    expect(fatores).toMatchObject({
      chuva_alta: true,
      temp_alta: true,
      denuncia_cidadao: 2,
    });
  });

  it('grava score via upsertScore', async () => {
    readRepo.findScoreInputs.mockResolvedValue(inputsBase());

    await useCase.execute('imovel-1', 'cliente-1');

    expect(writeRepo.upsertScore).toHaveBeenCalledWith(
      expect.objectContaining({ imovelId: 'imovel-1', clienteId: 'cliente-1' }),
    );
  });

  it('subtrações ocorrem FORA dos caps: focosResolvidos reduz score bruto', async () => {
    // 1 foco confirmado = pontosFocos=25, pontosHist=0, pontosEpidem=0 → bruto=25
    // 3 focos resolvidos × (-15) = -45 → max(0, 25-45) = 0
    readRepo.findScoreInputs.mockResolvedValue(
      inputsBase({
        focosAtivos: [{ status: 'confirmado', focoAnteriorId: null }],
        focosResolvidosCount: 3,
      }),
    );

    const { score } = await useCase.execute('imovel-1', 'cliente-1');

    expect(score).toBe(0);
  });

  it('LEAST(focosResolvidos, 3): mais de 3 resolvidos usa apenas 3', async () => {
    // 5 focos confirmados → pontosFocos=40 (cap), pontosHist=0, pontosEpidem=0
    // 10 focos resolvidos → LEAST(10,3)×(-15) = 3×(-15) = -45 → max(0, 40-45) = 0
    readRepo.findScoreInputs.mockResolvedValue(
      inputsBase({
        focosAtivos: Array(5).fill({ status: 'confirmado', focoAnteriorId: null }),
        focosResolvidosCount: 10,
      }),
    );

    const { score } = await useCase.execute('imovel-1', 'cliente-1');

    expect(score).toBe(0);
  });

  it('LEAST(slaVencidos, 2): mais de 2 SLA vencidos usa apenas 2', async () => {
    // 10 SLAs vencidos → LEAST(10,2)=2 × 12 = 24
    readRepo.findScoreInputs.mockResolvedValue(inputsBase({ slaVencidosCount: 10 }));

    const { score } = await useCase.execute('imovel-1', 'cliente-1');

    expect(score).toBe(24);
  });

  it('LEAST(casosProximos, 2): mais de 2 casos próximos usa apenas 2', async () => {
    // 10 casos próximos → LEAST(10,2)=2 × 25 = 50 → capeado em 30 (capEpidemio)
    readRepo.findScoreInputs.mockResolvedValue(inputsBase({ casosProximosCount: 10 }));

    const { score } = await useCase.execute('imovel-1', 'cliente-1');

    expect(score).toBe(30);
  });

  it('LEAST(denunciaCidadao, 2): mais de 2 denúncias usa apenas 2', async () => {
    // 10 denúncias → LEAST(10,2)=2 × 10 = 20
    readRepo.findScoreInputs.mockResolvedValue(inputsBase({ denunciaCidadaoCount: 10 }));

    const { score } = await useCase.execute('imovel-1', 'cliente-1');

    expect(score).toBe(20);
  });

  it('imovelRecusa está no grupo epidemio, não historico', async () => {
    // imovelRecusa(8) no epidemio → soma com casosProximos para verificar que está no mesmo cap
    readRepo.findScoreInputs.mockResolvedValue(
      inputsBase({
        imovel: new Imovel(
          { ...imovelBase['props'], historicoRecusa: true },
          { id: 'imovel-1' },
        ),
        casosProximosCount: 1,
      }),
    );

    const { score, fatores } = await useCase.execute('imovel-1', 'cliente-1');

    // pontosEpidem: min(25 + 8, 30) = 30  pontosHist: 0  pontosFocos: 0
    expect(score).toBe(30);
    expect(fatores).toMatchObject({ imovel_recusa: true, pontos_epidem: 30, pontos_hist: 0 });
  });
});
