import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PluvioSchedulerService } from './pluvio-scheduler.service';

@Injectable()
export class PluvioScheduler {
  private readonly logger = new Logger(PluvioScheduler.name);

  constructor(private pluvioSchedulerService: PluvioSchedulerService) {}

  @Cron('0 6 * * *')
  async riscoDaily() {
    this.logger.log('[PluvioScheduler.riscoDaily] Iniciando coleta meteorológica diária');
    await this.pluvioSchedulerService.riscoDaily();
  }
}
