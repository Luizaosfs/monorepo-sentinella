import { Injectable } from '@nestjs/common';

import { RelatorioGerado } from '../entities/dashboard';

@Injectable()
export abstract class DashboardWriteRepository {
  abstract createRelatorio(entity: RelatorioGerado): Promise<RelatorioGerado>;
  abstract resolverAlert(id: string): Promise<void>;
}
