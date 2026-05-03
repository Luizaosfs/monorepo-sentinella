import { VistoriaReadRepository } from '@modules/vistoria/repositories/vistoria-read.repository';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { expectHttpException } from '@test/utils/expect-http-exception';
import { FocoRiscoException } from '../../errors/foco-risco.exception';
import { GetResumoVisualVistoriaPorFoco } from '../get-resumo-visual-vistoria-por-foco';

const focoBase = {
  id: 'foco-1',
  cliente_id: 'cliente-1',
  imovel_id: 'imovel-1',
  codigo_foco: 'F001',
  protocolo_publico: 'SENT-001',
  status: 'confirmado',
  prioridade: 'P2',
  score_prioridade: 85,
  origem_tipo: 'agente',
  endereco_normalizado: 'Rua Teste, 123',
  latitude: -23.5,
  longitude: -46.6,
  responsavel_id: null,
  observacao: null,
  origem_vistoria_id: null,
  deleted_at: null,
  historico: [],
};

const riscoBase = {
  menor_incapaz: false,
  idoso_incapaz: false,
  dep_quimico: false,
  risco_alimentar: false,
  risco_moradia: false,
  criadouro_animais: true,
  lixo: false,
  residuos_organicos: false,
  residuos_quimicos: false,
  residuos_medicos: false,
  acumulo_material_organico: false,
  animais_sinais_lv: false,
  caixa_destampada: false,
  mobilidade_reduzida: false,
  acamado: false,
  outro_risco_vetorial: null,
};

const vistoriaBase = {
  id: 'vistoria-1',
  data_visita: new Date('2026-04-01T08:00:00Z'),
  status: 'finalizada',
  acesso_realizado: true,
  motivo_sem_acesso: null,
  moradores_qtd: 4,
  gravidas: 1,
  idosos: 0,
  criancas_7anos: 2,
  origem_visita: 'planejamento',
  habitat_selecionado: 'residencial',
  condicao_habitat: 'adequada',
  observacao: 'Observação teste',
  foto_externa_url: 'https://cloudinary.com/foto.jpg',
  resultado_operacional: 'com_foco',
  vulnerabilidade_domiciliar: 'media',
  alerta_saude: 'sem_alerta',
  risco_socioambiental: 'baixo',
  risco_vetorial: 'medio',
  prioridade_final: 'P2',
  prioridade_motivo: 'Depósito com foco e vulnerabilidade moderada',
  dimensao_dominante: 'vetorial',
  consolidacao_resumo: 'Prioridade P2 por presença de foco vetorial',
  consolidacao_json: null,
  consolidacao_incompleta: false,
  versao_regra_consolidacao: 'v2',
  versao_pesos_consolidacao: 'v1',
  consolidado_em: new Date('2026-04-01T10:00:00Z'),
  created_at: new Date('2026-04-01T09:00:00Z'),
  depositos: [
    {
      tipo: 'A1',
      qtd_inspecionados: 3,
      qtd_com_focos: 1,
      qtd_eliminados: 1,
      qtd_com_agua: 2,
      usou_larvicida: true,
      qtd_larvicida_g: 5,
      eliminado: false,
      vedado: true,
    },
  ],
  sintomas: [
    {
      febre: true,
      manchas_vermelhas: false,
      dor_articulacoes: false,
      dor_cabeca: true,
      nausea: false,
      moradores_sintomas_qtd: 2,
      gerou_caso_notificado_id: null,
    },
  ],
  calhas: [
    {
      posicao: 'frente',
      condicao: 'com_agua_parada',
      com_foco: true,
      acessivel: true,
      tratamento_realizado: true,
      foto_url: 'https://cloudinary.com/calha.jpg',
      observacao: null,
    },
  ],
  riscos: [riscoBase],
};

describe('GetResumoVisualVistoriaPorFoco', () => {
  let useCase: GetResumoVisualVistoriaPorFoco;

  const findFoco = jest.fn();
  const findOperacoes = jest.fn();
  const findResumoByFocoId = jest.fn();

  const prisma = {
    client: {
      focos_risco: { findFirst: findFoco },
      operacoes: { findMany: findOperacoes },
    },
  } as unknown as PrismaService;

  const vistoriaRepo = {
    findResumoByFocoId,
  } as unknown as VistoriaReadRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    findOperacoes.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetResumoVisualVistoriaPorFoco,
        { provide: PrismaService, useValue: prisma },
        { provide: VistoriaReadRepository, useValue: vistoriaRepo },
      ],
    }).compile();

    useCase = module.get(GetResumoVisualVistoriaPorFoco);
  });

  it('deve lançar notFound quando foco não existe', async () => {
    findFoco.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute('nao-existe', 'cliente-1'),
      FocoRiscoException.notFound(),
    );
  });

  it('deve lançar notFound para tentativa cross-tenant (findFirst retorna null com cliente errado)', async () => {
    findFoco.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute('foco-1', 'outro-cliente'),
      FocoRiscoException.notFound(),
    );

    expect(findFoco).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ cliente_id: 'outro-cliente' }) }),
    );
  });

  it('deve chamar findResumoByFocoId com focoId, origemVistoriaId e clienteId corretos', async () => {
    findFoco.mockResolvedValue({ ...focoBase, origem_vistoria_id: 'v-origem-123' });
    findResumoByFocoId.mockResolvedValue(null);

    await useCase.execute('foco-1', 'cliente-1');

    expect(findResumoByFocoId).toHaveBeenCalledWith('foco-1', 'v-origem-123', 'cliente-1');
  });

  it('não deve usar imovel_id como fallback quando vistoria não é encontrada', async () => {
    findFoco.mockResolvedValue(focoBase);
    findResumoByFocoId.mockResolvedValue(null);

    const result = await useCase.execute('foco-1', 'cliente-1');

    expect(findResumoByFocoId).toHaveBeenCalledTimes(1);
    expect(result.vistoria).toBeNull();
  });

  it('deve retornar resposta parcial quando foco não tem vistoria', async () => {
    findFoco.mockResolvedValue(focoBase);
    findResumoByFocoId.mockResolvedValue(null);

    const result = await useCase.execute('foco-1', 'cliente-1');

    expect(result.foco.id).toBe('foco-1');
    expect(result.vistoria).toBeNull();
    expect(result.consolidacao).toBeNull();
    expect(result.sintomas).toBeNull();
    expect(result.fatoresRisco).toBeNull();
    expect(result.depositosPncd.itens).toHaveLength(0);
    expect(result.depositosPncd.totais.inspecionados).toBe(0);
    expect(result.calhas.itens).toHaveLength(0);
    expect(result.explicabilidade.pendencias).toContain('Nenhuma vistoria vinculada ao foco');
  });

  it('deve retornar vistoria consolidada com todos os campos', async () => {
    findFoco.mockResolvedValue(focoBase);
    findResumoByFocoId.mockResolvedValue(vistoriaBase);

    const result = await useCase.execute('foco-1', 'cliente-1');

    expect(result.vistoria?.id).toBe('vistoria-1');
    expect(result.vistoria?.acessoRealizado).toBe(true);
    expect(result.consolidacao?.consolidadoEm).toBe('2026-04-01T10:00:00.000Z');
    expect(result.consolidacao?.prioridadeFinal).toBe('P2');
    expect(result.consolidacao?.consolidacaoIncompleta).toBe(false);
    expect(result.consolidacao?.dimensaoDominante).toBe('vetorial');
  });

  it('deve marcar pendência quando vistoria não foi consolidada', async () => {
    findFoco.mockResolvedValue(focoBase);
    findResumoByFocoId.mockResolvedValue({ ...vistoriaBase, consolidado_em: null });

    const result = await useCase.execute('foco-1', 'cliente-1');

    expect(result.explicabilidade.pendencias).toContain(
      'Vistoria ainda não consolidada — execute ConsolidarVistoria',
    );
  });

  it('deve marcar pendência quando consolidação está incompleta', async () => {
    findFoco.mockResolvedValue(focoBase);
    findResumoByFocoId.mockResolvedValue({
      ...vistoriaBase,
      consolidacao_incompleta: true,
      consolidado_em: new Date(),
    });

    const result = await useCase.execute('foco-1', 'cliente-1');

    expect(result.explicabilidade.pendencias).toContain(
      'Consolidação incompleta — dados insuficientes para classificação completa',
    );
  });

  it('deve retornar sintomas nulos quando vistoria não tem registro de sintomas', async () => {
    findFoco.mockResolvedValue(focoBase);
    findResumoByFocoId.mockResolvedValue({ ...vistoriaBase, sintomas: [] });

    const result = await useCase.execute('foco-1', 'cliente-1');

    expect(result.sintomas).toBeNull();
    expect(result.resumoEstrategico.sintomasInformadosQtd).toBe(0);
  });

  it('deve retornar fatoresRisco nulos quando vistoria não tem registro de riscos', async () => {
    findFoco.mockResolvedValue(focoBase);
    findResumoByFocoId.mockResolvedValue({ ...vistoriaBase, riscos: [] });

    const result = await useCase.execute('foco-1', 'cliente-1');

    expect(result.fatoresRisco).toBeNull();
    expect(result.resumoEstrategico.fatoresRiscoAtivosQtd).toBe(0);
    expect(result.gruposVulneraveis?.mobilidadeReduzida).toBe(false);
    expect(result.gruposVulneraveis?.acamado).toBe(false);
  });

  it('deve retornar depósitos e totais vazios sem erros', async () => {
    findFoco.mockResolvedValue(focoBase);
    findResumoByFocoId.mockResolvedValue({ ...vistoriaBase, depositos: [] });

    const result = await useCase.execute('foco-1', 'cliente-1');

    expect(result.depositosPncd.itens).toHaveLength(0);
    expect(result.depositosPncd.totais.inspecionados).toBe(0);
    expect(result.tratamento.larvicidaAplicado).toBe(false);
    expect(result.tratamento.totalLarvicidaG).toBe(0);
  });

  it('deve retornar calhas vazias sem erros', async () => {
    findFoco.mockResolvedValue(focoBase);
    findResumoByFocoId.mockResolvedValue({ ...vistoriaBase, calhas: [] });

    const result = await useCase.execute('foco-1', 'cliente-1');

    expect(result.calhas.itens).toHaveLength(0);
    expect(result.calhas.resumo.possuiCalhaComFoco).toBe(false);
    expect(result.calhas.resumo.possuiAguaParada).toBe(false);
    expect(result.calhas.resumo.condicoesCriticas).toHaveLength(0);
    expect(result.tratamento.calhasTratadas).toBe(0);
  });

  it('deve calcular totais de depósitos corretamente', async () => {
    findFoco.mockResolvedValue(focoBase);
    findResumoByFocoId.mockResolvedValue(vistoriaBase);

    const result = await useCase.execute('foco-1', 'cliente-1');

    expect(result.depositosPncd.totais.inspecionados).toBe(3);
    expect(result.depositosPncd.totais.comFocos).toBe(1);
    expect(result.depositosPncd.totais.eliminados).toBe(1);
    expect(result.depositosPncd.totais.comAgua).toBe(2);
    expect(result.depositosPncd.totais.comLarvicida).toBe(1);
  });

  it('deve calcular tratamento a partir dos depósitos e calhas', async () => {
    findFoco.mockResolvedValue(focoBase);
    findResumoByFocoId.mockResolvedValue(vistoriaBase);

    const result = await useCase.execute('foco-1', 'cliente-1');

    expect(result.tratamento.larvicidaAplicado).toBe(true);
    expect(result.tratamento.totalLarvicidaG).toBe(5);
    expect(result.tratamento.depositosEliminados).toBe(1);
    expect(result.tratamento.depositosVedados).toBe(1);
    expect(result.tratamento.calhasTratadas).toBe(1);
  });

  it('deve construir grupos vulneráveis a partir de moradores e vistoria_riscos', async () => {
    findFoco.mockResolvedValue(focoBase);
    findResumoByFocoId.mockResolvedValue({
      ...vistoriaBase,
      gravidas: 1,
      idosos: 1,
      criancas_7anos: 2,
      riscos: [{ ...riscoBase, mobilidade_reduzida: true, acamado: true }],
    });

    const result = await useCase.execute('foco-1', 'cliente-1');

    expect(result.gruposVulneraveis?.gestantes).toBe(true);
    expect(result.gruposVulneraveis?.idosos).toBe(true);
    expect(result.gruposVulneraveis?.criancas7Anos).toBe(true);
    expect(result.gruposVulneraveis?.mobilidadeReduzida).toBe(true);
    expect(result.gruposVulneraveis?.acamado).toBe(true);
    expect(result.resumoEstrategico.gruposVulneraveisQtd).toBeGreaterThanOrEqual(5);
  });

  it('deve contar sintomas ativos corretamente', async () => {
    findFoco.mockResolvedValue(focoBase);
    findResumoByFocoId.mockResolvedValue(vistoriaBase); // febre + dor_cabeca = 2

    const result = await useCase.execute('foco-1', 'cliente-1');

    expect(result.sintomas?.febre).toBe(true);
    expect(result.sintomas?.dorCabeca).toBe(true);
    expect(result.sintomas?.manchasVermelhas).toBe(false);
    expect(result.resumoEstrategico.sintomasInformadosQtd).toBe(2);
  });

  it('deve incluir evidências da foto externa e da calha', async () => {
    findFoco.mockResolvedValue(focoBase);
    findResumoByFocoId.mockResolvedValue(vistoriaBase);

    const result = await useCase.execute('foco-1', 'cliente-1');

    const origens = result.evidencias.map((e) => e.origem);
    expect(origens).toContain('vistoria');
    expect(origens).toContain('calha');
    const evVistoria = result.evidencias.find((e) => e.origem === 'vistoria');
    expect(evVistoria?.url).toBe('https://cloudinary.com/foto.jpg');
  });

  it('deve incluir evidências de operações vinculadas ao foco', async () => {
    findFoco.mockResolvedValue(focoBase);
    findResumoByFocoId.mockResolvedValue(vistoriaBase);
    findOperacoes.mockResolvedValue([
      {
        id: 'op-1',
        status: 'concluida',
        created_at: new Date('2026-04-02T08:00:00Z'),
        concluido_em: new Date('2026-04-02T15:00:00Z'),
        evidencias: [
          {
            image_url: 'https://cloudinary.com/operacao.jpg',
            legenda: 'Após tratamento',
            created_at: new Date('2026-04-02T15:00:00Z'),
          },
        ],
      },
    ]);

    const result = await useCase.execute('foco-1', 'cliente-1');

    const evOp = result.evidencias.find((e) => e.origem === 'operacao');
    expect(evOp?.url).toBe('https://cloudinary.com/operacao.jpg');
    expect(evOp?.legenda).toBe('Após tratamento');
  });

  it('deve incluir entradas de foco_risco_historico no histórico com origem "foco"', async () => {
    findFoco.mockResolvedValue({
      ...focoBase,
      historico: [
        {
          id: 'h-1',
          status_anterior: 'em_triagem',
          status_novo: 'aguarda_inspecao',
          tipo_evento: null,
          motivo: null,
          alterado_em: new Date('2026-03-30T10:00:00Z'),
        },
        {
          id: 'h-2',
          status_anterior: 'aguarda_inspecao',
          status_novo: 'em_inspecao',
          tipo_evento: 'inicio_inspecao',
          motivo: 'Inspeção iniciada pelo agente',
          alterado_em: new Date('2026-04-01T07:00:00Z'),
        },
      ],
    });
    findResumoByFocoId.mockResolvedValue(vistoriaBase);

    const result = await useCase.execute('foco-1', 'cliente-1');

    const focoEntries = result.historico.filter((h) => h.origem === 'foco');
    expect(focoEntries).toHaveLength(2);

    const h1 = focoEntries[0];
    expect(h1.tipo).toBe('transicao_status');
    expect(h1.descricao).toBe('em_triagem → aguarda_inspecao');
    expect(h1.createdAt).toBe('2026-03-30T10:00:00.000Z');

    const h2 = focoEntries[1];
    expect(h2.tipo).toBe('inicio_inspecao');
    expect(h2.descricao).toBe('Inspeção iniciada pelo agente');
  });

  it('deve construir histórico com eventos de foco, vistoria e operações em ordem cronológica', async () => {
    findFoco.mockResolvedValue({
      ...focoBase,
      historico: [
        {
          id: 'h-1',
          status_anterior: null,
          status_novo: 'em_triagem',
          tipo_evento: null,
          motivo: null,
          alterado_em: new Date('2026-03-29T10:00:00Z'),
        },
      ],
    });
    findResumoByFocoId.mockResolvedValue(vistoriaBase);
    findOperacoes.mockResolvedValue([
      {
        id: 'op-1',
        status: 'concluida',
        created_at: new Date('2026-04-02T08:00:00Z'),
        concluido_em: new Date('2026-04-02T15:00:00Z'),
        evidencias: [],
      },
    ]);

    const result = await useCase.execute('foco-1', 'cliente-1');

    const tipos = result.historico.map((h) => h.tipo);
    expect(tipos).toContain('transicao_status');
    expect(tipos).toContain('vistoria_criada');
    expect(tipos).toContain('vistoria_realizada');
    expect(tipos).toContain('vistoria_consolidada');
    expect(tipos).toContain('operacao_criada');
    expect(tipos).toContain('operacao_concluida');

    const datas = result.historico.map((h) => h.createdAt);
    const datasOrdenadas = [...datas].sort();
    expect(datas).toEqual(datasOrdenadas);
  });

  it('deve marcar pendência de acesso não realizado', async () => {
    findFoco.mockResolvedValue(focoBase);
    findResumoByFocoId.mockResolvedValue({
      ...vistoriaBase,
      acesso_realizado: false,
      motivo_sem_acesso: 'Imóvel fechado',
    });

    const result = await useCase.execute('foco-1', 'cliente-1');

    expect(result.explicabilidade.pendencias.some((p) => p.includes('Acesso não realizado'))).toBe(true);
    expect(result.explicabilidade.pendencias.some((p) => p.includes('Imóvel fechado'))).toBe(true);
  });

  it('deve gerar alerta para presença de depósito com foco', async () => {
    findFoco.mockResolvedValue(focoBase);
    findResumoByFocoId.mockResolvedValue(vistoriaBase); // qtd_com_focos: 1

    const result = await useCase.execute('foco-1', 'cliente-1');

    expect(result.explicabilidade.alertas.some((a) => a.includes('depósito(s) com foco'))).toBe(true);
  });

  it('deve calcular calhasCriticasQtd apenas para calhas com foco ou agua parada', async () => {
    findFoco.mockResolvedValue(focoBase);
    findResumoByFocoId.mockResolvedValue({
      ...vistoriaBase,
      calhas: [
        { posicao: 'frente', condicao: 'com_agua_parada', com_foco: false, acessivel: true, tratamento_realizado: false, foto_url: null, observacao: null },
        { posicao: 'fundo', condicao: 'limpa', com_foco: false, acessivel: true, tratamento_realizado: false, foto_url: null, observacao: null },
        { posicao: 'lateral', condicao: 'entupida', com_foco: true, acessivel: true, tratamento_realizado: true, foto_url: null, observacao: null },
      ],
    });

    const result = await useCase.execute('foco-1', 'cliente-1');

    expect(result.resumoEstrategico.calhasCriticasQtd).toBe(2); // frente (agua parada) + lateral (com foco)
    expect(result.calhas.resumo.possuiCalhaComFoco).toBe(true);
    expect(result.calhas.resumo.possuiAguaParada).toBe(true);
    expect(result.calhas.resumo.condicoesCriticas).toContain('com_agua_parada');
    expect(result.calhas.resumo.condicoesCriticas).toContain('entupida');
  });
});
