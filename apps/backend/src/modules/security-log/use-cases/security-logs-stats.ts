import { Injectable } from '@nestjs/common';

import { SecurityLogReadRepository } from '../repositories/security-log-read.repository';

@Injectable()
export class SecurityLogsStats {
  constructor(private readonly readRepository: SecurityLogReadRepository) {}

  async execute(days: number) {
    return this.readRepository.stats(days);
  }
}
