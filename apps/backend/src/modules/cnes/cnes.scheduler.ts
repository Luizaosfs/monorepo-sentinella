import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { CnesService } from './cnes.service';

@Injectable()
export class CnesScheduler {
  private readonly logger = new Logger(CnesScheduler.name);

  constructor(private cnesService: CnesService) {}

  @Cron(CronExpression.EVERY_WEEK)
  async syncAll() {
    this.logger.log('[CnesScheduler.syncAll] Iniciando sync semanal CNES');
    await this.cnesService.sync();
  }
}
