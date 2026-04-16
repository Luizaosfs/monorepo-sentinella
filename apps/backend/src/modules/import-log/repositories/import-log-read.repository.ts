import { Injectable } from '@nestjs/common';

import { FilterImportLogInput } from '../dtos/filter-import-log.input';
import { ImportLog } from '../entities/import-log';

@Injectable()
export abstract class ImportLogReadRepository {
  abstract findById(id: string): Promise<ImportLog | null>;
  abstract findAll(filters: FilterImportLogInput): Promise<ImportLog[]>;
}
