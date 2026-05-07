import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';

import { SecurityLogWriteRepository } from '../repositories/security-log-write.repository';
import { SecurityLoggerService } from '../security-log.service';
import { SecurityEventType, SecuritySeverity } from '../security-log.types';

describe('SecurityLoggerService', () => {
  let service: SecurityLoggerService;
  const writeRepository = mockDeep<SecurityLogWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        SecurityLoggerService,
        { provide: SecurityLogWriteRepository, useValue: writeRepository },
      ],
    }).compile();

    service = module.get(SecurityLoggerService);
  });

  it('grava ACCESS_DENIED e chama writeRepository.create', async () => {
    writeRepository.create.mockResolvedValue(undefined);

    await service.log({
      eventType: SecurityEventType.ACCESS_DENIED,
      severity: SecuritySeverity.WARN,
      userId: 'user-123',
      clienteId: null,
      role: 'agente',
      ip: '192.168.1.1',
      method: 'GET',
      path: '/vistorias',
      statusCode: 403,
      message: 'Acesso negado — papel insuficiente',
      metadata: { required: ['supervisor'], actual: ['agente'] },
    });

    expect(writeRepository.create).toHaveBeenCalledTimes(1);
    expect(writeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: SecurityEventType.ACCESS_DENIED,
        severity: SecuritySeverity.WARN,
        userId: 'user-123',
        path: '/vistorias',
      }),
    );
  });

  it('ignora erro de gravação sem quebrar o fluxo (fail-safe)', async () => {
    writeRepository.create.mockRejectedValue(new Error('connection refused'));

    await expect(
      service.log({
        eventType: SecurityEventType.ACCESS_DENIED,
        severity: SecuritySeverity.WARN,
        message: 'teste fail-safe',
      }),
    ).resolves.toBeUndefined();

    expect(writeRepository.create).toHaveBeenCalledTimes(1);
  });

  it('fail-safe emite logger.warn com o eventType e mensagem do erro', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    writeRepository.create.mockRejectedValue(new Error('ECONNREFUSED 5432'));

    await service.log({
      eventType: SecurityEventType.INTERNAL_ERROR,
      severity: SecuritySeverity.CRITICAL,
      message: 'falha crítica simulada',
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('INTERNAL_ERROR'),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('ECONNREFUSED 5432'),
    );
    warnSpy.mockRestore();
  });

  it('registra RATE_LIMIT_BLOCKED com IP e path do endpoint bloqueado', async () => {
    writeRepository.create.mockResolvedValue(undefined);

    await service.log({
      eventType: SecurityEventType.RATE_LIMIT_BLOCKED,
      severity: SecuritySeverity.WARN,
      ip: '198.51.100.7',
      method: 'POST',
      path: '/denuncias/cidadao',
      statusCode: 429,
      message: 'Rate limit excedido',
      metadata: { limit: 5, ttl: 60 },
    });

    expect(writeRepository.create).toHaveBeenCalledTimes(1);
    expect(writeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: SecurityEventType.RATE_LIMIT_BLOCKED,
        severity: SecuritySeverity.WARN,
        ip: '198.51.100.7',
        statusCode: 429,
        metadata: { limit: 5, ttl: 60 },
      }),
    );
  });

  it('registra TENANT_VIOLATION com metadata', async () => {
    writeRepository.create.mockResolvedValue(undefined);

    await service.log({
      eventType: SecurityEventType.TENANT_VIOLATION,
      severity: SecuritySeverity.WARN,
      userId: 'user-456',
      clienteId: 'cliente-abc',
      role: 'analista_regional',
      ip: '10.0.0.1',
      method: 'GET',
      path: '/dashboard',
      statusCode: 403,
      message: 'Município não pertence ao agrupamento',
      metadata: { requestedClienteId: 'cliente-xyz', agrupamentoId: 'agrup-1' },
    });

    expect(writeRepository.create).toHaveBeenCalledTimes(1);
    expect(writeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: SecurityEventType.TENANT_VIOLATION,
        metadata: { requestedClienteId: 'cliente-xyz', agrupamentoId: 'agrup-1' },
      }),
    );
  });

  it('registra INTERNAL_ERROR sem expor stack trace em metadata', async () => {
    writeRepository.create.mockResolvedValue(undefined);

    await service.log({
      eventType: SecurityEventType.INTERNAL_ERROR,
      severity: SecuritySeverity.ERROR,
      ip: '10.0.0.2',
      method: 'POST',
      path: '/focos-risco',
      statusCode: 500,
      message: 'Erro interno do servidor',
      metadata: { errorName: 'TypeError' },
    });

    expect(writeRepository.create).toHaveBeenCalledTimes(1);
    expect(writeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: SecurityEventType.INTERNAL_ERROR,
        severity: SecuritySeverity.ERROR,
        metadata: { errorName: 'TypeError' },
      }),
    );
  });

  it('registra TOKEN_INVALID sem userId', async () => {
    writeRepository.create.mockResolvedValue(undefined);

    await service.log({
      eventType: SecurityEventType.TOKEN_INVALID,
      severity: SecuritySeverity.WARN,
      userId: null,
      ip: '203.0.113.5',
      method: 'GET',
      path: '/vistorias',
      statusCode: 401,
      message: 'JWT inválido ou expirado',
      metadata: { reason: 'jwt expired' },
    });

    expect(writeRepository.create).toHaveBeenCalledTimes(1);
    expect(writeRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: SecurityEventType.TOKEN_INVALID,
        userId: null,
        statusCode: 401,
      }),
    );
  });
});
