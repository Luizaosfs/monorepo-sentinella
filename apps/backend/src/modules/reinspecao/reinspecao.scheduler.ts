import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { MarcarVencidas } from './use-cases/marcar-vencidas';

@Injectable()
export class ReinspecaoScheduler {
  private readonly logger = new Logger(ReinspecaoScheduler.name);

  constructor(private marcarVencidas: MarcarVencidas) {}

  @Cron('0 6 * * *')
  async marcarReinspecoesVencidas() {
    this.logger.log(
      '[ReinspecaoScheduler] Marcando reinspeções pendentes vencidas',
    );
    const { atualizadas } = await this.marcarVencidas.execute();
    this.logger.log(`[ReinspecaoScheduler] Atualizadas: ${atualizadas}`);
  }
}
