import { Module } from '@nestjs/common';
import { DatabaseModule } from '@shared/modules/database/database.module';

import { SecurityLogController } from './security-log.controller';
import { SecurityLoggerService } from './security-log.service';
import { ListSecurityLogs } from './use-cases/list-security-logs';
import { SecurityLogsStats } from './use-cases/security-logs-stats';

@Module({
  imports: [DatabaseModule],
  controllers: [SecurityLogController],
  providers: [SecurityLoggerService, ListSecurityLogs, SecurityLogsStats],
  exports: [SecurityLoggerService],
})
export class SecurityLogModule {}
