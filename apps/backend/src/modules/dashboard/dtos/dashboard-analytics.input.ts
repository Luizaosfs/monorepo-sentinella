import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const cicloClienteBase = {
  clienteId: z
    .string()
    .uuid()
    .optional()
    .describe('ID do cliente (padrão: tenant do token)'),
  ciclo: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .describe('Número do ciclo de levantamento'),
};

export const liraaQuerySchema = z.object(cicloClienteBase);
export class LiraaQuery extends createZodDto(liraaQuerySchema) {}

export const comparativoAgentesQuerySchema = z.object(cicloClienteBase);
export class ComparativoAgentesQuery extends createZodDto(
  comparativoAgentesQuerySchema,
) {}

export const consumoLarvicidaQuerySchema = z.object(cicloClienteBase);
export class ConsumoLarvicidaQuery extends createZodDto(
  consumoLarvicidaQuerySchema,
) {}

export const resumoRegionalQuerySchema = z.object({
  ...cicloClienteBase,
  de: z.coerce.date().optional().describe('Data início (vistorias)'),
  ate: z.coerce.date().optional().describe('Data fim (vistorias)'),
});
export class ResumoRegionalQuery extends createZodDto(resumoRegionalQuerySchema) {}

export const scoreSurtoQuerySchema = z.object({
  clienteId: z.string().uuid().optional().describe('ID do cliente'),
});
export class ScoreSurtoQuery extends createZodDto(scoreSurtoQuerySchema) {}

export const resumoAgenteQuerySchema = z.object({
  ...cicloClienteBase,
  agenteId: z
    .string()
    .uuid({ message: 'agenteId deve ser um UUID válido' })
    .describe('ID do agente'),
});
export class ResumoAgenteQuery extends createZodDto(resumoAgenteQuerySchema) {}

export const relatorioAnaliticoBodySchema = z.object({
  clienteId: z.string().uuid().optional().describe('ID do cliente'),
  periodoInicio: z.coerce.date().describe('Início do período analítico'),
  periodoFim: z.coerce.date().describe('Fim do período analítico'),
  ciclo: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .describe('Ciclo específico (opcional)'),
});
export class RelatorioAnaliticoBody extends createZodDto(
  relatorioAnaliticoBodySchema,
) {}
