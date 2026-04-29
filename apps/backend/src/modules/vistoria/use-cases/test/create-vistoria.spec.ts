import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { ForbiddenException } from '@nestjs/common';

import { VerificarQuota } from '../../../billing/use-cases/verificar-quota';
import { IniciarInspecao } from '../../../foco-risco/use-cases/iniciar-inspecao';
import { EnfileirarScoreImovel } from '../../../job/enfileirar-score-imovel';
import { mockRequest } from '@test/utils/user-helpers';

import { CreateVistoriaBody } from '../../dtos/create-vistoria.body';
import { VistoriaReadRepository } from '../../repositories/vistoria-read.repository';
import { VistoriaWriteRepository } from '../../repositories/vistoria-write.repository';
import { AtualizarPerfilImovel } from '../atualizar-perfil-imovel';
import { ConsolidarVistoria } from '../consolidar-vistoria';
import { CreateVistoria } from '../create-vistoria';
import { ValidarCicloVistoria } from '../validar-ciclo-vistoria';
import { VistoriaBuilder } from './builders/vistoria.builder';

describe('CreateVistoria', () => {
  let useCase: CreateVistoria;
  const readRepo = mock<VistoriaReadRepository>();
  const writeRepo = mock<VistoriaWriteRepository>();
  const mockConsolidar = { execute: jest.fn().mockResolvedValue(undefined) };
  const mockEnfileirar = { enfileirarPorImovel: jest.fn().mockResolvedValue(undefined) };
  const mockVerificarQuota = { execute: jest.fn().mockResolvedValue({ ok: true, usado: 0, limite: null }) };
  const mockValidarCiclo = { execute: jest.fn().mockResolvedValue(undefined) };
  const mockIniciarInspecao = { execute: jest.fn().mockResolvedValue(undefined) };
  const mockAtualizarPerfil = { execute: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockVerificarQuota.execute.mockResolvedValue({ ok: true, usado: 0, limite: null });
    mockValidarCiclo.execute.mockResolvedValue(undefined);
    mockIniciarInspecao.execute.mockResolvedValue(undefined);
    mockAtualizarPerfil.execute.mockResolvedValue(undefined);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateVistoria,
        { provide: VistoriaReadRepository, useValue: readRepo },
        { provide: VistoriaWriteRepository, useValue: writeRepo },
        { provide: ConsolidarVistoria, useValue: mockConsolidar },
        { provide: EnfileirarScoreImovel, useValue: mockEnfileirar },
        { provide: VerificarQuota, useValue: mockVerificarQuota },
        { provide: ValidarCicloVistoria, useValue: mockValidarCiclo },
        { provide: IniciarInspecao, useValue: mockIniciarInspecao },
        { provide: AtualizarPerfilImovel, useValue: mockAtualizarPerfil },
        {
          provide: REQUEST,
          useValue: mockRequest({
            tenantId: '00000000-0000-4000-8000-000000000001',
            user: {
              id: '00000000-0000-4000-8000-000000000003',
              email: 'a@b.com',
              nome: 'Agente',
              clienteId: '00000000-0000-4000-8000-000000000001',
              papeis: ['agente'],
            },
          }),
        },
      ],
    }).compile();

    useCase = module.get<CreateVistoria>(CreateVistoria);
  });

  const baseInput = (): CreateVistoriaBody =>
    ({
      ciclo: 1,
      tipoAtividade: 'LI',
      dataVisita: new Date('2024-06-01T10:00:00Z'),
    }) as CreateVistoriaBody;

  it('deve criar vistoria e retornar detalhes completos', async () => {
    const created = new VistoriaBuilder()
      .withId('00000000-0000-4000-8000-0000000000a1')
      .build();
    writeRepo.create.mockResolvedValue(created);
    const full = new VistoriaBuilder().build();
    readRepo.findByIdComDetalhes.mockResolvedValue(full);

    const result = await useCase.execute(baseInput());

    expect(result.vistoria).toBe(full);
    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clienteId: '00000000-0000-4000-8000-000000000001',
        agenteId: '00000000-0000-4000-8000-000000000003',
        status: 'pendente',
      }),
    );
    expect(readRepo.findByIdComDetalhes).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-0000000000a1',
      '00000000-0000-4000-8000-000000000001',
    );
  });

  it('deve persistir depósitos quando informados', async () => {
    const created = new VistoriaBuilder()
      .withId('00000000-0000-4000-8000-0000000000a1')
      .build();
    writeRepo.create.mockResolvedValue(created);
    readRepo.findByIdComDetalhes.mockResolvedValue(created);

    await useCase.execute({
      ...baseInput(),
      depositos: [{ tipoDeposito: 'A1', quantidade: 2 }],
    } as CreateVistoriaBody);

    expect(writeRepo.createDeposito).toHaveBeenCalledWith(
      expect.objectContaining({
        vistoriaId: '00000000-0000-4000-8000-0000000000a1',
        tipoDeposito: 'A1',
      }),
    );
  });

  it('deve usar clienteId do tenant (MT-02) mesmo quando clienteId é enviado no body', async () => {
    const created = new VistoriaBuilder()
      .withId('00000000-0000-4000-8000-0000000000a2')
      .withClienteId('00000000-0000-4000-8000-000000000001')
      .build();
    writeRepo.create.mockResolvedValue(created);
    readRepo.findByIdComDetalhes.mockResolvedValue(created);

    await useCase.execute({
      ...baseInput(),
      clienteId: '00000000-0000-4000-8000-000000009999',
    } as CreateVistoriaBody);

    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clienteId: '00000000-0000-4000-8000-000000000001',
      }),
    );
  });

  it('invoca hook ConsolidarVistoria após criar vistoria', async () => {
    const id = '00000000-0000-4000-8000-0000000000a3';
    const created = new VistoriaBuilder().withId(id).build();
    writeRepo.create.mockResolvedValue(created);
    readRepo.findByIdComDetalhes.mockResolvedValue(created);

    await useCase.execute(baseInput());

    expect(mockConsolidar.execute).toHaveBeenCalledWith({
      vistoriaId: id,
      motivo: 'automático — INSERT em vistorias',
    });
  });

  it('falha no hook ConsolidarVistoria não deve quebrar a criação da vistoria', async () => {
    const id = '00000000-0000-4000-8000-0000000000a4';
    const created = new VistoriaBuilder().withId(id).build();
    writeRepo.create.mockResolvedValue(created);
    const full = new VistoriaBuilder().build();
    readRepo.findByIdComDetalhes.mockResolvedValue(full);
    mockConsolidar.execute.mockRejectedValueOnce(new Error('stub boom'));

    const result = await useCase.execute(baseInput());

    expect(result.vistoria).toBe(full);
  });

  it('enfileira score do imóvel quando imovelId presente e acessoRealizado=true', async () => {
    const id = '00000000-0000-4000-8000-0000000000a5';
    const created = new VistoriaBuilder().withId(id).withImovelId('imovel-uuid-1').build();
    writeRepo.create.mockResolvedValue(created);
    readRepo.findByIdComDetalhes.mockResolvedValue(created);

    await useCase.execute({ ...baseInput(), imovelId: 'imovel-uuid-1', acessoRealizado: true } as any);

    expect(mockEnfileirar.enfileirarPorImovel).toHaveBeenCalledWith(
      'imovel-uuid-1',
      '00000000-0000-4000-8000-000000000001',
    );
  });

  it('quota ok → cria vistoria normalmente', async () => {
    const created = new VistoriaBuilder().withId('00000000-0000-4000-8000-0000000000a5').build();
    writeRepo.create.mockResolvedValue(created);
    readRepo.findByIdComDetalhes.mockResolvedValue(created);

    const result = await useCase.execute(baseInput());

    expect(result.vistoria).toBe(created);
    expect(mockVerificarQuota.execute).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000001',
      { metrica: 'vistorias_mes' },
    );
  });

  it('quota excedida → throw ForbiddenException antes de criar vistoria', async () => {
    mockVerificarQuota.execute.mockResolvedValue({ ok: false, usado: 50, limite: 50, motivo: 'excedido' });

    await expect(useCase.execute(baseInput())).rejects.toThrow(ForbiddenException);

    expect(writeRepo.create).not.toHaveBeenCalled();
  });

  it('ciclo inválido → BadRequestException antes de criar vistoria', async () => {
    mockValidarCiclo.execute.mockRejectedValueOnce(new ForbiddenException('ciclo inválido'));

    await expect(useCase.execute(baseInput())).rejects.toThrow(ForbiddenException);

    expect(writeRepo.create).not.toHaveBeenCalled();
  });

  it('ValidarCicloVistoria é chamado com clienteId do tenant e ciclo do input', async () => {
    const created = new VistoriaBuilder().withId('00000000-0000-4000-8000-0000000000a5').build();
    writeRepo.create.mockResolvedValue(created);
    readRepo.findByIdComDetalhes.mockResolvedValue(created);

    await useCase.execute({ ...baseInput(), ciclo: 3 } as any);

    expect(mockValidarCiclo.execute).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000001',
      3,
    );
  });

  it('falha no hook enfileirarScore NÃO interrompe a criação da vistoria', async () => {
    const id = '00000000-0000-4000-8000-0000000000a6';
    const created = new VistoriaBuilder().withId(id).withImovelId('imovel-uuid-1').build();
    writeRepo.create.mockResolvedValue(created);
    const full = new VistoriaBuilder().build();
    readRepo.findByIdComDetalhes.mockResolvedValue(full);
    mockEnfileirar.enfileirarPorImovel.mockRejectedValueOnce(new Error('job_queue down'));

    const result = await useCase.execute({ ...baseInput(), imovelId: 'imovel-uuid-1', acessoRealizado: true } as any);

    expect(result.vistoria).toBe(full);
  });

  // K.3 — fn_auto_em_inspecao_por_vistoria
  it('K.3 — focoRiscoId presente → IniciarInspecao invocado best-effort', async () => {
    writeRepo.create.mockResolvedValue({ id: 'v-k3-1', focoRiscoId: 'foco-k3-1' } as any);
    readRepo.findByIdComDetalhes.mockResolvedValue(new VistoriaBuilder().build());

    await useCase.execute(baseInput());

    expect(mockIniciarInspecao.execute).toHaveBeenCalledWith('foco-k3-1', {});
  });

  it('K.3 — focoRiscoId ausente → IniciarInspecao NÃO invocado', async () => {
    const created = new VistoriaBuilder().withId('v-k3-2').build();
    writeRepo.create.mockResolvedValue(created);
    readRepo.findByIdComDetalhes.mockResolvedValue(created);

    await useCase.execute(baseInput());

    expect(mockIniciarInspecao.execute).not.toHaveBeenCalled();
  });

  it('K.3 — falha em IniciarInspecao não quebra a criação da vistoria', async () => {
    writeRepo.create.mockResolvedValue({ id: 'v-k3-3', focoRiscoId: 'foco-k3-3' } as any);
    const full = new VistoriaBuilder().build();
    readRepo.findByIdComDetalhes.mockResolvedValue(full);
    mockIniciarInspecao.execute.mockRejectedValueOnce(new Error('apenas agente inicia'));

    const result = await useCase.execute(baseInput());

    expect(result.vistoria).toBe(full);
  });

  // K.4 — fn_atualizar_perfil_imovel
  it('K.4 — imovelId presente → AtualizarPerfilImovel invocado (sem guard de acessoRealizado)', async () => {
    const created = new VistoriaBuilder().withId('v-k4-1').withImovelId('imovel-k4-1').build();
    writeRepo.create.mockResolvedValue(created);
    readRepo.findByIdComDetalhes.mockResolvedValue(new VistoriaBuilder().build());

    await useCase.execute({ ...baseInput(), imovelId: 'imovel-k4-1', acessoRealizado: true } as any);

    expect(mockAtualizarPerfil.execute).toHaveBeenCalledWith({
      imovelId: 'imovel-k4-1',
      vistoriaId: 'v-k4-1',
      agenteId: expect.anything(),
      clienteId: '00000000-0000-4000-8000-000000000001',
    });
  });

  it('K.4 — imovelId ausente → AtualizarPerfilImovel NÃO invocado', async () => {
    const created = new VistoriaBuilder().withId('v-k4-2').build();
    (created as any).imovelId = undefined;
    writeRepo.create.mockResolvedValue(created);
    readRepo.findByIdComDetalhes.mockResolvedValue(created);

    await useCase.execute({ ...baseInput() } as any);

    expect(mockAtualizarPerfil.execute).not.toHaveBeenCalled();
  });

  it('K.4 — falha em AtualizarPerfilImovel NÃO quebra a criação da vistoria', async () => {
    const created = new VistoriaBuilder().withId('v-k4-3').withImovelId('imovel-k4-3').build();
    writeRepo.create.mockResolvedValue(created);
    const full = new VistoriaBuilder().build();
    readRepo.findByIdComDetalhes.mockResolvedValue(full);
    mockAtualizarPerfil.execute.mockRejectedValueOnce(new Error('db timeout'));

    const result = await useCase.execute({ ...baseInput(), imovelId: 'imovel-k4-3' } as any);

    expect(result.vistoria).toBe(full);
  });
});
