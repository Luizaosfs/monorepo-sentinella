import { Injectable, Logger } from '@nestjs/common';

import { SecurityLogWriteRepository } from './repositories/security-log-write.repository';
import { SecurityLogPayload } from './security-log.types';

@Injectable()
export class SecurityLoggerService {
  private readonly logger = new Logger(SecurityLoggerService.name);

  constructor(private readonly writeRepository: SecurityLogWriteRepository) {}

  async log(payload: SecurityLogPayload): Promise<void> {
    try {
      await this.writeRepository.create(payload);
    } catch (err) {
      this.logger.warn(
        `[SecurityLog] Falha ao gravar ${payload.eventType}: ${(err as Error).message}`,
      );
    }
  }
}
