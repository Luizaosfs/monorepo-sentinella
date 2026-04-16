import { Injectable } from '@nestjs/common';

import { ImportLog } from '../entities/import-log';

@Injectable()
export abstract class ImportLogWriteRepository {
  abstract create(entity: ImportLog): Promise<ImportLog>;
}
