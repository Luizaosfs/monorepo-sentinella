import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const nn = <T extends z.ZodTypeAny>(s: T) =>
  z.preprocess((v) => (v === null ? undefined : v), s);

export const createPlanejamentoSchema = z.object({
  descricao: nn(z.string().optional()).describe('Descrição do planejamento'),
  dataPlanejamento: nn(z.coerce.date().optional()).describe('Data do planejamento'),
  areaTotal: nn(z.number().optional()).describe('Área total em m²'),
  alturaVoo: nn(z.number().optional()).describe('Altura de voo em metros'),
  tipo: nn(z.string().optional()).describe('Tipo do planejamento'),
  ativo: z.boolean().optional().default(false).describe('Planejamento ativo'),
  tipoEntrada: nn(z.string().optional()).describe('Tipo de entrada'),
  tipoLevantamento: nn(
    z.enum(['DRONE', 'MANUAL']).optional().default('MANUAL'),
  ).describe('Tipo de levantamento'),
  regiaoId: nn(z.string().uuid().optional()).describe('ID da região'),
  clienteId: nn(
    z.string().uuid().optional(),
  ).describe('ID do cliente (preenchido pelo backend)'),
});

export class CreatePlanejamentoBody extends createZodDto(
  createPlanejamentoSchema,
) {}
