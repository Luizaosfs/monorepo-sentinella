import { Injectable } from '@nestjs/common';

import { SecurityLogPayload } from '../security-log.types';

@Injectable()
export abstract class SecurityLogWriteRepository {
  abstract create(payload: SecurityLogPayload): Promise<void>;
}
