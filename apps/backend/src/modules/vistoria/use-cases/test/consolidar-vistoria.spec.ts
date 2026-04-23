import { PesosConsolidacaoReadRepository } from '@modules/consolidacao-pesos-config/repositories/pesos-consolidacao-read.repository';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { ClsService } from 'nestjs-cls';

import {
  DadosConsolidacao,
  VistoriaReadRepository,
} from '../../repositories/vistoria-read.repository';
import { VistoriaWriteRepository } from '../../repositories/vistoria-write.repository';
import { ConsolidarVistoria } from '../consolidar-vistoria';

const D = (s: string) => new Prisma.Decimal(s);

const mockReadRepo = {
  findDadosParaConsolidacao: jest.fn(),
  countSemAcessoPorImovel: jest.fn(),
};
const mockWriteRepo = { salvarConsolidacao: jest.fn() };
const mockPesosRepo = {
  findLimiar: jest.fn(),
  findFlagsSemPeso: jest.fn(),
  calcularScoresEfetivos: jest.fn(),
};
const mockCls = { get: jest.fn() };

const BASE_DADOS = (): DadosConsolidacao => ({
  vistoria: {
    imovelId: 'imovel-1',
    acessoRealizado: true,
    moradoresQtd: 4,
    gravidas: false,
    idosos: false,
    criancas7anos: false,
    clienteId: 'cliente-1',
    consolidadoEm: null,
    prioridadeFinal: null,
    dimensaoDominante: null,
    consolidacaoJson: null,
    versaoRegraConsolidacao: null,
    versaoPesosConsolidacao: null,
  },
  sintomas: null,
  riscos: null,
  depositos: { qtdComFocosTotal: 0, qtdInspecionados: 0 },
  calhas: { comFoco: false, comAguaParada: false },
});

describe('ConsolidarVistoria', () => {
  let useCase: ConsolidarVistoria;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPesosRepo.findLimiar.mockResolvedValue(null);
    mockPesosRepo.findFlagsSemPeso.mockResolvedValue([]);
    mockPesosRepo.calcularScoresEfetivos.mockResolvedValue({
      scoreSocial: D('0'),
      scoreSanitario: D('0'),
    });
    mockCls.get.mockReturnValue(undefined);
    mockReadRepo.countSemAcessoPorImovel.mockResolvedValue(1);
    mockWriteRepo.salvarConsolidacao.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsolidarVistoria,
        { provide: VistoriaReadRepository, useValue: mockReadRepo },
        { provide: VistoriaWriteRepository, useValue: mockWriteRepo },
        { provide: PesosConsolidacaoReadRepository, useValue: mockPesosRepo },
        { provide: ClsService, useValue: mockCls },
      ],
    }).compile();

    useCase = module.get<ConsolidarVistoria>(ConsolidarVistoria);
  });

  it('lança erro quando vistoria não encontrada', async () => {
    mockReadRepo.findDadosParaConsolidacao.mockResolvedValue(null);

    await expect(
      useCase.execute({ vistoriaId: 'nao-existe', motivo: 'teste' }),
    ).rejects.toThrow('nao-existe');

    expect(mockWriteRepo.salvarConsolidacao).not.toHaveBeenCalled();
  });

  it('primeira consolidação NÃO arquiva historico', async () => {
    mockReadRepo.findDadosParaConsolidacao.mockResolvedValue(BASE_DADOS());

    await useCase.execute({ vistoriaId: 'v-1', motivo: 'INSERT' });

    const [, , arquivar] = mockWriteRepo.salvarConsolidacao.mock.calls[0];
    expect(arquivar).toBeUndefined();
  });

  it('reconsolidação arquiva histórico com dados anteriores', async () => {
    const dados = BASE_DADOS();
    dados.vistoria.consolidadoEm = new Date('2024-01-01T00:00:00Z');
    dados.vistoria.prioridadeFinal = 'P3';
    dados.vistoria.versaoRegraConsolidacao = '1.0.0';
    mockReadRepo.findDadosParaConsolidacao.mockResolvedValue(dados);
    mockCls.get.mockReturnValue('user-uuid-1');

    await useCase.execute({ vistoriaId: 'v-2', motivo: 'UPDATE' });

    const [, , arquivar] = mockWriteRepo.salvarConsolidacao.mock.calls[0];
    expect(arquivar).toBeDefined();
    expect(arquivar.prioridadeFinal).toBe('P3');
    expect(arquivar.versaoRegra).toBe('1.0.0');
    expect(arquivar.motivo).toBe('UPDATE');
    expect(arquivar.reprocessadoPor).toBe('user-uuid-1');
  });

  it('sem acesso 1 tentativa → P4, resultado_operacional=sem_acesso', async () => {
    const dados = BASE_DADOS();
    dados.vistoria.acessoRealizado = false;
    dados.vistoria.imovelId = 'imovel-sem-acesso';
    mockReadRepo.findDadosParaConsolidacao.mockResolvedValue(dados);
    mockReadRepo.countSemAcessoPorImovel.mockResolvedValue(1);

    await useCase.execute({ vistoriaId: 'v-3', motivo: 'INSERT' });

    const [, consolidacao] = mockWriteRepo.salvarConsolidacao.mock.calls[0];
    expect(consolidacao.resultadoOperacional).toBe('sem_acesso');
    expect(consolidacao.prioridadeFinal).toBe('P4');
  });

  it('sem acesso ≥3 tentativas → P3, dimensão=resultado_operacional', async () => {
    const dados = BASE_DADOS();
    dados.vistoria.acessoRealizado = false;
    mockReadRepo.findDadosParaConsolidacao.mockResolvedValue(dados);
    mockReadRepo.countSemAcessoPorImovel.mockResolvedValue(3);

    await useCase.execute({ vistoriaId: 'v-4', motivo: 'INSERT' });

    const [, consolidacao] = mockWriteRepo.salvarConsolidacao.mock.calls[0];
    expect(consolidacao.prioridadeFinal).toBe('P3');
    expect(consolidacao.dimensaoDominante).toBe('resultado_operacional');
  });

  it('sem acesso ≥5 tentativas → P2', async () => {
    const dados = BASE_DADOS();
    dados.vistoria.acessoRealizado = false;
    mockReadRepo.findDadosParaConsolidacao.mockResolvedValue(dados);
    mockReadRepo.countSemAcessoPorImovel.mockResolvedValue(5);

    await useCase.execute({ vistoriaId: 'v-5', motivo: 'INSERT' });

    const [, consolidacao] = mockWriteRepo.salvarConsolidacao.mock.calls[0];
    expect(consolidacao.prioridadeFinal).toBe('P2');
  });

  it('vuln critica P3: menor_incapaz=true', async () => {
    const dados = BASE_DADOS();
    dados.riscos = {
      menorIncapaz: true, idosoIncapaz: false, depQuimico: false, riscoAlimentar: false,
      riscoMoradia: false, criadouroAnimais: false, lixo: false, residuosOrganicos: false,
      residuosQuimicos: false, residuosMedicos: false, acumuloMaterialOrganico: false,
      animaisSinaisLv: false, caixaDestampada: false, outroRiscoVetorial: null,
    };
    dados.sintomas = { febre: false, manchasVermelhas: false, dorArticulacoes: false, dorCabeca: false, moradoresSintomasQtd: 0 };
    dados.depositos = { qtdComFocosTotal: 0, qtdInspecionados: 2 };
    mockReadRepo.findDadosParaConsolidacao.mockResolvedValue(dados);

    await useCase.execute({ vistoriaId: 'v-6', motivo: 'INSERT' });

    const [, consolidacao] = mockWriteRepo.salvarConsolidacao.mock.calls[0];
    expect(consolidacao.vulnerabilidadeDomiciliar).toBe('critica');
    expect(consolidacao.prioridadeFinal).toBe('P3');
    expect(consolidacao.dimensaoDominante).toBe('vulnerabilidade_domiciliar');
  });

  it('alerta urgente + vetorial critico → P1, overrideAtivado=true no JSON', async () => {
    const dados = BASE_DADOS();
    dados.sintomas = { febre: true, manchasVermelhas: false, dorArticulacoes: false, dorCabeca: false, moradoresSintomasQtd: 2 };
    dados.depositos = { qtdComFocosTotal: 3, qtdInspecionados: 5 };
    dados.riscos = {
      menorIncapaz: false, idosoIncapaz: false, depQuimico: false, riscoAlimentar: false,
      riscoMoradia: false, criadouroAnimais: false, lixo: false, residuosOrganicos: false,
      residuosQuimicos: false, residuosMedicos: false, acumuloMaterialOrganico: false,
      animaisSinaisLv: false, caixaDestampada: false, outroRiscoVetorial: null,
    };
    mockReadRepo.findDadosParaConsolidacao.mockResolvedValue(dados);

    await useCase.execute({ vistoriaId: 'v-7', motivo: 'INSERT' });

    const [, consolidacao] = mockWriteRepo.salvarConsolidacao.mock.calls[0];
    expect(consolidacao.prioridadeFinal).toBe('P1');
    expect(consolidacao.alertaSaude).toBe('urgente');
    expect(consolidacao.riscoVetorial).toBe('critico');
    expect((consolidacao.consolidacaoJson as any).override_ativado).toBe(true);
  });

  it('alerta urgente isolado → P2', async () => {
    const dados = BASE_DADOS();
    dados.sintomas = { febre: true, manchasVermelhas: false, dorArticulacoes: false, dorCabeca: false, moradoresSintomasQtd: 3 };
    dados.riscos = {
      menorIncapaz: false, idosoIncapaz: false, depQuimico: false, riscoAlimentar: false,
      riscoMoradia: false, criadouroAnimais: false, lixo: false, residuosOrganicos: false,
      residuosQuimicos: false, residuosMedicos: false, acumuloMaterialOrganico: false,
      animaisSinaisLv: false, caixaDestampada: false, outroRiscoVetorial: null,
    };
    dados.depositos = { qtdComFocosTotal: 0, qtdInspecionados: 2 };
    mockReadRepo.findDadosParaConsolidacao.mockResolvedValue(dados);

    await useCase.execute({ vistoriaId: 'v-8', motivo: 'INSERT' });

    const [, consolidacao] = mockWriteRepo.salvarConsolidacao.mock.calls[0];
    expect(consolidacao.prioridadeFinal).toBe('P2');
    expect(consolidacao.dimensaoDominante).toBe('alerta_saude');
  });

  it('depositos inspecionados negativos → P4 conservador (risco_vetorial=medio)', async () => {
    const dados = BASE_DADOS();
    dados.sintomas = { febre: false, manchasVermelhas: false, dorArticulacoes: false, dorCabeca: false, moradoresSintomasQtd: 0 };
    dados.riscos = {
      menorIncapaz: false, idosoIncapaz: false, depQuimico: false, riscoAlimentar: false,
      riscoMoradia: false, criadouroAnimais: false, lixo: false, residuosOrganicos: false,
      residuosQuimicos: false, residuosMedicos: false, acumuloMaterialOrganico: false,
      animaisSinaisLv: false, caixaDestampada: false, outroRiscoVetorial: null,
    };
    dados.depositos = { qtdComFocosTotal: 0, qtdInspecionados: 3 };
    mockReadRepo.findDadosParaConsolidacao.mockResolvedValue(dados);

    await useCase.execute({ vistoriaId: 'v-9', motivo: 'INSERT' });

    const [, consolidacao] = mockWriteRepo.salvarConsolidacao.mock.calls[0];
    expect(consolidacao.riscoVetorial).toBe('medio');
    expect(consolidacao.prioridadeFinal).toBe('P4');
    expect(consolidacao.dimensaoDominante).toBe('risco_vetorial');
  });

  it('fallback P3 quando consolidação incompleta (sem fichas)', async () => {
    const dados = BASE_DADOS();
    mockReadRepo.findDadosParaConsolidacao.mockResolvedValue(dados);

    await useCase.execute({ vistoriaId: 'v-10', motivo: 'INSERT' });

    const [, consolidacao] = mockWriteRepo.salvarConsolidacao.mock.calls[0];
    expect(consolidacao.prioridadeFinal).toBe('P3');
    expect(consolidacao.consolidacaoIncompleta).toBe(true);
    expect((consolidacao.consolidacaoJson as any).fallback_aplicado).toBe(true);
  });

  it('flag ativa sem peso → dado_inconsistente=true no JSON, incompleta=true', async () => {
    const dados = BASE_DADOS();
    dados.riscos = {
      menorIncapaz: false, idosoIncapaz: false, depQuimico: true, riscoAlimentar: false,
      riscoMoradia: false, criadouroAnimais: false, lixo: false, residuosOrganicos: false,
      residuosQuimicos: false, residuosMedicos: false, acumuloMaterialOrganico: false,
      animaisSinaisLv: false, caixaDestampada: false, outroRiscoVetorial: null,
    };
    dados.sintomas = { febre: false, manchasVermelhas: false, dorArticulacoes: false, dorCabeca: false, moradoresSintomasQtd: 0 };
    dados.depositos = { qtdComFocosTotal: 0, qtdInspecionados: 2 };
    mockReadRepo.findDadosParaConsolidacao.mockResolvedValue(dados);
    mockPesosRepo.findFlagsSemPeso.mockResolvedValue(['dep_quimico']);

    await useCase.execute({ vistoriaId: 'v-11', motivo: 'INSERT' });

    const [, consolidacao] = mockWriteRepo.salvarConsolidacao.mock.calls[0];
    expect((consolidacao.consolidacaoJson as any).dado_inconsistente).toBe(true);
    expect(consolidacao.consolidacaoIncompleta).toBe(true);
  });

  it('consolida corretamente campos do JSON (cobertura_dados)', async () => {
    const dados = BASE_DADOS();
    dados.sintomas = { febre: false, manchasVermelhas: false, dorArticulacoes: false, dorCabeca: false, moradoresSintomasQtd: 0 };
    dados.riscos = {
      menorIncapaz: false, idosoIncapaz: false, depQuimico: false, riscoAlimentar: false,
      riscoMoradia: false, criadouroAnimais: false, lixo: false, residuosOrganicos: false,
      residuosQuimicos: false, residuosMedicos: false, acumuloMaterialOrganico: false,
      animaisSinaisLv: false, caixaDestampada: false, outroRiscoVetorial: null,
    };
    dados.depositos = { qtdComFocosTotal: 0, qtdInspecionados: 4 };
    mockReadRepo.findDadosParaConsolidacao.mockResolvedValue(dados);

    await useCase.execute({ vistoriaId: 'v-12', motivo: 'INSERT' });

    const [, consolidacao] = mockWriteRepo.salvarConsolidacao.mock.calls[0];
    const json = consolidacao.consolidacaoJson as any;
    expect(json.versao_regra).toBe('2.0.0');
    expect(json.cobertura_dados.tem_sintomas).toBe(true);
    expect(json.cobertura_dados.tem_riscos).toBe(true);
    expect(json.cobertura_dados.tem_depositos).toBe(true);
  });

  it('consolidacao_resumo tem formato correto', async () => {
    const dados = BASE_DADOS();
    dados.sintomas = { febre: false, manchasVermelhas: false, dorArticulacoes: false, dorCabeca: false, moradoresSintomasQtd: 0 };
    dados.riscos = {
      menorIncapaz: false, idosoIncapaz: false, depQuimico: false, riscoAlimentar: false,
      riscoMoradia: false, criadouroAnimais: false, lixo: false, residuosOrganicos: false,
      residuosQuimicos: false, residuosMedicos: false, acumuloMaterialOrganico: false,
      animaisSinaisLv: false, caixaDestampada: false, outroRiscoVetorial: null,
    };
    dados.depositos = { qtdComFocosTotal: 0, qtdInspecionados: 3 };
    mockReadRepo.findDadosParaConsolidacao.mockResolvedValue(dados);

    await useCase.execute({ vistoriaId: 'v-13', motivo: 'INSERT' });

    const [, consolidacao] = mockWriteRepo.salvarConsolidacao.mock.calls[0];
    expect(consolidacao.consolidacaoResumo).toMatch(/^visitado \| VD:/);
    expect(consolidacao.consolidacaoResumo).toMatch(/→ P\d/);
    expect(consolidacao.consolidacaoResumo).not.toContain('[INCOMPLETO]');
  });

  it('risco_vetorial critico via depositos com foco', async () => {
    const dados = BASE_DADOS();
    dados.sintomas = { febre: false, manchasVermelhas: false, dorArticulacoes: false, dorCabeca: false, moradoresSintomasQtd: 0 };
    dados.riscos = {
      menorIncapaz: false, idosoIncapaz: false, depQuimico: false, riscoAlimentar: false,
      riscoMoradia: false, criadouroAnimais: false, lixo: false, residuosOrganicos: false,
      residuosQuimicos: false, residuosMedicos: false, acumuloMaterialOrganico: false,
      animaisSinaisLv: false, caixaDestampada: false, outroRiscoVetorial: null,
    };
    dados.depositos = { qtdComFocosTotal: 2, qtdInspecionados: 5 };
    mockReadRepo.findDadosParaConsolidacao.mockResolvedValue(dados);

    await useCase.execute({ vistoriaId: 'v-14', motivo: 'INSERT' });

    const [, consolidacao] = mockWriteRepo.salvarConsolidacao.mock.calls[0];
    expect(consolidacao.riscoVetorial).toBe('critico');
    expect(consolidacao.prioridadeFinal).toBe('P3');
  });

  it('usa pesos do banco quando disponíveis (score médio → P4)', async () => {
    const dados = BASE_DADOS();
    dados.riscos = {
      menorIncapaz: false, idosoIncapaz: false, depQuimico: true, riscoAlimentar: false,
      riscoMoradia: false, criadouroAnimais: false, lixo: false, residuosOrganicos: false,
      residuosQuimicos: false, residuosMedicos: false, acumuloMaterialOrganico: false,
      animaisSinaisLv: false, caixaDestampada: false, outroRiscoVetorial: null,
    };
    dados.sintomas = { febre: false, manchasVermelhas: false, dorArticulacoes: false, dorCabeca: false, moradoresSintomasQtd: 0 };
    dados.depositos = { qtdComFocosTotal: 0, qtdInspecionados: 2 };
    mockReadRepo.findDadosParaConsolidacao.mockResolvedValue(dados);
    mockPesosRepo.findLimiar.mockImplementation((flag: string) => {
      if (flag === 'limiar_baixo_medio') return Promise.resolve({ peso: D('2.0'), versao: 'v1' });
      return Promise.resolve({ peso: D('5.0'), versao: 'v1' });
    });
    mockPesosRepo.findFlagsSemPeso.mockResolvedValue([]);
    mockPesosRepo.calcularScoresEfetivos.mockResolvedValue({
      scoreSocial: D('3.0'),
      scoreSanitario: D('0'),
    });

    await useCase.execute({ vistoriaId: 'v-15', motivo: 'INSERT' });

    const [, consolidacao] = mockWriteRepo.salvarConsolidacao.mock.calls[0];
    expect(consolidacao.riscoSocioambiental).toBe('medio');
    expect(consolidacao.prioridadeFinal).toBe('P4');
    expect(consolidacao.versaoPesosConsolidacao).toBe('v1');
  });

  it('versao_regra sempre 2.0.0', async () => {
    mockReadRepo.findDadosParaConsolidacao.mockResolvedValue(BASE_DADOS());

    await useCase.execute({ vistoriaId: 'v-16', motivo: 'INSERT' });

    const [, consolidacao] = mockWriteRepo.salvarConsolidacao.mock.calls[0];
    expect(consolidacao.versaoRegraConsolidacao).toBe('2.0.0');
    expect((consolidacao.consolidacaoJson as any).versao_regra).toBe('2.0.0');
  });
});
