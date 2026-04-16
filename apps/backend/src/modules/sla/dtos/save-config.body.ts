import { jsonRecordRequired } from '@shared/dtos/zod-coercion';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const saveConfigSchema = z.object({
  config: jsonRecordRequired('Configuração JSON do SLA'),
});

export class SaveConfigBody extends createZodDto(saveConfigSchema) {}
