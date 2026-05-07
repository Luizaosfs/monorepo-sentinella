import { Injectable } from '@nestjs/common';

import { ListSecurityLogsInputType } from '../dtos/list-security-logs.input';
import { SecurityLogReadRepository } from '../repositories/security-log-read.repository';
import { SecurityLogViewModel } from '../view-model/security-log';

@Injectable()
export class ListSecurityLogs {
  constructor(private readonly readRepository: SecurityLogReadRepository) {}

  async execute(filter: ListSecurityLogsInputType) {
    const result = await this.readRepository.findMany(filter);
    return {
      ...result,
      data: result.data.map(SecurityLogViewModel.toHttp),
    };
  }
}
