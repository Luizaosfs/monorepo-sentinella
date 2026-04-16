import { Injectable } from '@nestjs/common';

import { FilterReinspecaoInput } from '../dtos/filter-reinspecao.input';
import { Reinspecao } from '../entities/reinspecao';

@Injectable()
export abstract class ReinspecaoReadRepository {
  abstract findById(id: string): Promise<Reinspecao | null>;
  abstract findAll(filters: FilterReinspecaoInput): Promise<Reinspecao[]>;
}
