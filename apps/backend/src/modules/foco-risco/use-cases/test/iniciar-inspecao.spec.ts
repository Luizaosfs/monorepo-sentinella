import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { FocoRiscoException } from '../../errors/foco-risco.exception';
import { FocoRiscoReadRepository } from '../../repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '../../repositories/foco-risco-write.repository';
import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { IniciarInspecao } from '../iniciar-inspecao';
import { FocoRiscoBuilder } from './builders/foco-risco.builder';

async function buildUseCase(reqValue: unknown) {
  const readRepo = mock<FocoRiscoReadRepository>();
  const writeRepo = mock<FocoRiscoWriteRepository>();
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      IniciarInspecao,
      { provide: FocoRiscoReadRepository, useValue: readRepo },
      { provide: FocoRiscoWriteRepository, useValue: writeRepo },
      { provide: REQUEST, useValue: reqValue },
    ],
  }).compile();
  return {
    useCase: module.get<IniciarInspecao>(IniciarInspecao),
    readRepo,
    writeRepo,
  };
}

describe('IniciarInspecao (paridade fn_iniciar_inspecao_foco hardening)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('happy path: agente ativo transiciona aguarda_inspecao → em_inspecao com tipoEvento canônico', async () => {
    const { useCase, readRepo, writeRepo } = await buildUseCase(
      mockRequest({
        tenantId: 'cliente-uuid-1',
        user: {
          id: 'agente-uuid-1',
          email: 'a@t.com',
          nome: 'Agente',
          clienteId: 'cliente-uuid-1',
          papeis: ['agente'],
        },
      }),
    );
    const foco = new FocoRiscoBuilder()
      .withStatus('aguarda_inspecao')
      .build();
    readRepo.findById.mockResolvedValue(foco);
    writeRepo.save.mockResolvedValue();
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'em_inspecao',
    });

    const result = await useCase.execute(foco.id!, { observacao: 'iniciando' });

    expect(result.foco.status).toBe('em_inspecao');
    expect(result.foco.inspecaoEm).toBeInstanceOf(Date);
    expect(result.foco.responsavelId).toBe('agente-uuid-1');
    expect(result.foco.observacao).toBe('iniciando');
    expect(result.jaEmInspecao).toBe(false);
    expect(writeRepo.save).toHaveBeenCalledTimes(1);
    expect(writeRepo.createHistorico).toHaveBeenCalledWith(
      expect.objectContaining({
        statusAnterior: 'aguarda_inspecao',
        statusNovo: 'em_inspecao',
        tipoEvento: 'inspecao_iniciada',
        alteradoPor: 'agente-uuid-1',
      }),
    );
  });

  it('G1: papel NULL (papeis vazio) → papelNaoDefinido', async () => {
    const { useCase, readRepo, writeRepo } = await buildUseCase(
      mockRequest({
        tenantId: 'cliente-uuid-1',
        user: {
          id: 'user-1',
          email: 'a@t.com',
          nome: 'Sem Papel',
          clienteId: 'cliente-uuid-1',
          papeis: [],
        },
      }),
    );

    await expectHttpException(
      () => useCase.execute('foco-1', {}),
      FocoRiscoException.papelNaoDefinido(),
    );
    expect(readRepo.findById).not.toHaveBeenCalled();
    expect(writeRepo.save).not.toHaveBeenCalled();
  });

  it('G2: usuário ausente em request (proxy de inativo) → usuarioInativo', async () => {
    const { useCase, readRepo, writeRepo } = await buildUseCase({
      tenantId: 'cliente-uuid-1',
    });

    await expectHttpException(
      () => useCase.execute('foco-1', {}),
      FocoRiscoException.usuarioInativo(),
    );
    expect(readRepo.findById).not.toHaveBeenCalled();
    expect(writeRepo.save).not.toHaveBeenCalled();
  });

  it('G3: supervisor tenta iniciar → apenasAgenteInicia', async () => {
    const { useCase, readRepo, writeRepo } = await buildUseCase(
      mockRequest({
        tenantId: 'cliente-uuid-1',
        user: {
          id: 'sup-1',
          email: 's@t.com',
          nome: 'Supervisor',
          clienteId: 'cliente-uuid-1',
          papeis: ['supervisor'],
        },
      }),
    );

    await expectHttpException(
      () => useCase.execute('foco-1', {}),
      FocoRiscoException.apenasAgenteInicia(),
    );
    expect(readRepo.findById).not.toHaveBeenCalled();
    expect(writeRepo.save).not.toHaveBeenCalled();
  });

  it('G3: admin tenta iniciar → apenasAgenteInicia (admin NÃO bypassa)', async () => {
    const { useCase, readRepo, writeRepo } = await buildUseCase(
      mockRequest({
        tenantId: 'cliente-uuid-1',
        user: {
          id: 'admin-1',
          email: 'a@t.com',
          nome: 'Admin',
          clienteId: 'cliente-uuid-1',
          papeis: ['admin'],
        },
      }),
    );

    await expectHttpException(
      () => useCase.execute('foco-1', {}),
      FocoRiscoException.apenasAgenteInicia(),
    );
    expect(readRepo.findById).not.toHaveBeenCalled();
    expect(writeRepo.save).not.toHaveBeenCalled();
  });

  it('G4 idempotência: foco já em_inspecao retorna jaEmInspecao=true sem alterar', async () => {
    const { useCase, readRepo, writeRepo } = await buildUseCase(
      mockRequest({
        tenantId: 'cliente-uuid-1',
        user: {
          id: 'agente-uuid-1',
          email: 'a@t.com',
          nome: 'Agente',
          clienteId: 'cliente-uuid-1',
          papeis: ['agente'],
        },
      }),
    );
    const inspecaoEmExistente = new Date('2024-01-02T10:00:00Z');
    const foco = new FocoRiscoBuilder()
      .withStatus('em_inspecao')
      .withResponsavelId('outro-agente')
      .withInspecaoEm(inspecaoEmExistente)
      .build();
    readRepo.findById.mockResolvedValue(foco);

    const result = await useCase.execute(foco.id!, {});

    expect(result.jaEmInspecao).toBe(true);
    expect(result.foco.status).toBe('em_inspecao');
    expect(result.foco.responsavelId).toBe('outro-agente');
    expect(result.foco.inspecaoEm).toBe(inspecaoEmExistente);
    expect(writeRepo.save).not.toHaveBeenCalled();
    expect(writeRepo.createHistorico).not.toHaveBeenCalled();
  });

  it('estado inválido: foco em suspeita → statusInvalido', async () => {
    const { useCase, readRepo, writeRepo } = await buildUseCase(
      mockRequest({
        tenantId: 'cliente-uuid-1',
        user: {
          id: 'agente-uuid-1',
          email: 'a@t.com',
          nome: 'Agente',
          clienteId: 'cliente-uuid-1',
          papeis: ['agente'],
        },
      }),
    );
    const foco = new FocoRiscoBuilder().withStatus('suspeita').build();
    readRepo.findById.mockResolvedValue(foco);

    await expectHttpException(
      () => useCase.execute(foco.id!, {}),
      FocoRiscoException.statusInvalido(),
    );
    expect(writeRepo.save).not.toHaveBeenCalled();
  });

  it('foco não encontrado → notFound', async () => {
    const { useCase, readRepo } = await buildUseCase(
      mockRequest({
        tenantId: 'cliente-uuid-1',
        user: {
          id: 'agente-uuid-1',
          email: 'a@t.com',
          nome: 'Agente',
          clienteId: 'cliente-uuid-1',
          papeis: ['agente'],
        },
      }),
    );
    readRepo.findById.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute('nao-existe', {}),
      FocoRiscoException.notFound(),
    );
  });

  it('tenant check: foco de outro cliente → notFound (não vaza existência)', async () => {
    const { useCase, readRepo, writeRepo } = await buildUseCase(
      mockRequest({
        tenantId: 'cliente-uuid-1',
        user: {
          id: 'agente-uuid-1',
          email: 'a@t.com',
          nome: 'Agente',
          clienteId: 'cliente-uuid-1',
          papeis: ['agente'],
        },
      }),
    );
    const foco = new FocoRiscoBuilder()
      .withClienteId('outro-cliente')
      .withStatus('aguarda_inspecao')
      .build();
    // Simula filtro de tenant do repositório: clienteId 'cliente-uuid-1' não encontra foco de 'outro-cliente'
    readRepo.findById.mockImplementation(async (_id, clienteId) =>
      clienteId === 'outro-cliente' ? foco : null,
    );

    await expectHttpException(
      () => useCase.execute(foco.id!, {}),
      FocoRiscoException.notFound(),
    );
    expect(writeRepo.save).not.toHaveBeenCalled();
  });

  it('G6 COALESCE: responsavelId já preenchido NÃO é sobrescrito pelo user.id', async () => {
    const { useCase, readRepo, writeRepo } = await buildUseCase(
      mockRequest({
        tenantId: 'cliente-uuid-1',
        user: {
          id: 'agente-novo',
          email: 'a@t.com',
          nome: 'Agente Novo',
          clienteId: 'cliente-uuid-1',
          papeis: ['agente'],
        },
      }),
    );
    const foco = new FocoRiscoBuilder()
      .withStatus('aguarda_inspecao')
      .withResponsavelId('agente-original')
      .build();
    readRepo.findById.mockResolvedValue(foco);
    writeRepo.save.mockResolvedValue();
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'em_inspecao',
    });

    const result = await useCase.execute(foco.id!, {});

    expect(result.foco.responsavelId).toBe('agente-original');
    expect(result.foco.status).toBe('em_inspecao');
  });

  it('G6 COALESCE: inspecaoEm já preenchido NÃO é sobrescrito (caso pseudo-idempotente)', async () => {
    const { useCase, readRepo, writeRepo } = await buildUseCase(
      mockRequest({
        tenantId: 'cliente-uuid-1',
        user: {
          id: 'agente-uuid-1',
          email: 'a@t.com',
          nome: 'Agente',
          clienteId: 'cliente-uuid-1',
          papeis: ['agente'],
        },
      }),
    );
    const inspecaoEmAntiga = new Date('2024-01-05T15:30:00Z');
    const foco = new FocoRiscoBuilder()
      .withStatus('aguarda_inspecao')
      .withInspecaoEm(inspecaoEmAntiga)
      .build();
    readRepo.findById.mockResolvedValue(foco);
    writeRepo.save.mockResolvedValue();
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'em_inspecao',
    });

    const result = await useCase.execute(foco.id!, {});

    expect(result.foco.inspecaoEm).toBe(inspecaoEmAntiga);
  });

  it('observacao opcional preenche corretamente', async () => {
    const { useCase, readRepo, writeRepo } = await buildUseCase(
      mockRequest({
        tenantId: 'cliente-uuid-1',
        user: {
          id: 'agente-uuid-1',
          email: 'a@t.com',
          nome: 'Agente',
          clienteId: 'cliente-uuid-1',
          papeis: ['agente'],
        },
      }),
    );
    const foco = new FocoRiscoBuilder()
      .withStatus('aguarda_inspecao')
      .build();
    readRepo.findById.mockResolvedValue(foco);
    writeRepo.save.mockResolvedValue();
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'em_inspecao',
    });

    await useCase.execute(foco.id!, { observacao: 'inspeção iniciada com observação' });

    expect(writeRepo.createHistorico).toHaveBeenCalledWith(
      expect.objectContaining({
        motivo: 'inspeção iniciada com observação',
      }),
    );
    expect(foco.observacao).toBe('inspeção iniciada com observação');
  });
});
