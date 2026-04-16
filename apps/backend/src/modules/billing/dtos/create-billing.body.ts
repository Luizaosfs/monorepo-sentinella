import { jsonRecordOptional } from '@shared/dtos/zod-coercion';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createPlanoSchema = z.object({
  nome: z
    .string({ required_error: 'Nome obrigatório' })
    .describe('Nome do plano (ex: Básico, Profissional, Enterprise)'),
  descricao: z.string().optional().describe('Descrição detalhada do plano'),
  precoMensal: z.coerce.number().optional().describe('Preço mensal em reais'),
  limiteUsuarios: z
    .coerce.number()
    .int()
    .optional()
    .describe('Limite de usuários ativos'),
  limiteImoveis: z
    .coerce.number()
    .int()
    .optional()
    .describe('Limite de imóveis cadastrados'),
  limiteVistoriasMes: z
    .coerce.number()
    .int()
    .optional()
    .describe('Limite de vistorias por mês'),
  limiteLevantamentosMes: z
    .coerce.number()
    .int()
    .optional()
    .describe('Limite de levantamentos por mês'),
  limiteVoosMes: z
    .coerce.number()
    .int()
    .optional()
    .describe('Limite de voos de drone por mês'),
  limiteStorageGb: z
    .coerce.number()
    .optional()
    .describe('Limite de armazenamento em GB'),
  limiteIaCallsMes: z
    .coerce.number()
    .int()
    .optional()
    .describe('Limite de chamadas à IA por mês'),
  limiteDenunciasMes: z
    .coerce.number()
    .int()
    .optional()
    .describe('Limite de denúncias recebidas por mês'),
  droneHabilitado: z
    .boolean()
    .optional()
    .default(false)
    .describe('Módulo de drone habilitado'),
  slaAvancado: z
    .boolean()
    .optional()
    .default(false)
    .describe('SLA avançado com escalamento automático'),
  integracoesHabilitadas: z
    .array(z.string())
    .optional()
    .default([])
    .describe('Integrações habilitadas (esus, sinan, cnes)'),
  ativo: z
    .boolean()
    .optional()
    .default(true)
    .describe('Plano disponível para contratação'),
  ordem: z
    .coerce.number()
    .int()
    .optional()
    .default(0)
    .describe('Ordem de exibição na listagem'),
});
export class CreatePlanoBody extends createZodDto(createPlanoSchema) {}

export const savePlanoSchema = z.object({
  nome: z.string().optional().describe('Nome do plano'),
  descricao: z.string().optional().describe('Descrição do plano'),
  precoMensal: z.coerce.number().optional().describe('Preço mensal em reais'),
  ativo: z.boolean().optional().describe('Plano disponível para contratação'),
  ordem: z.coerce.number().int().optional().describe('Ordem de exibição'),
});
export class SavePlanoBody extends createZodDto(savePlanoSchema) {}

export const createClientePlanoSchema = z.object({
  clienteId: z
    .string()
    .uuid({ message: 'ID do cliente inválido' })
    .describe('ID do cliente/município'),
  planoId: z
    .string()
    .uuid({ message: 'ID do plano inválido' })
    .describe('ID do plano contratado'),
  dataInicio: z.coerce
    .date()
    .optional()
    .describe('Data de início da vigência (padrão: hoje)'),
  dataFim: z.coerce
    .date()
    .optional()
    .describe('Data de fim da vigência (null = indeterminado)'),
  status: z
    .string()
    .optional()
    .default('ativo')
    .describe('Status do contrato (ativo, cancelado, suspenso, trial)'),
  limitesPersonalizados: jsonRecordOptional(
    'Limites customizados que sobrescrevem o plano padrão',
  ),
  contratoRef: z
    .string()
    .optional()
    .describe('Referência do contrato físico/digital'),
  observacao: z.string().optional().describe('Observações internas'),
  dataTrialFim: z.coerce
    .date()
    .optional()
    .describe('Data de fim do período trial'),
});
export class CreateClientePlanoBody extends createZodDto(
  createClientePlanoSchema,
) {}

export const createCicloSchema = z.object({
  clienteId: z.string().uuid().describe('ID do cliente/município'),
  clientePlanoId: z
    .string()
    .uuid()
    .optional()
    .describe('ID do cliente_plano associado'),
  periodoInicio: z.coerce
    .date({ required_error: 'Período início obrigatório' })
    .describe('Início do ciclo de faturamento'),
  periodoFim: z.coerce
    .date({ required_error: 'Período fim obrigatório' })
    .describe('Fim do ciclo de faturamento'),
  valorBase: z
    .coerce.number()
    .optional()
    .describe('Valor base do plano para este ciclo'),
  observacao: z.string().optional().describe('Observações internas'),
});
export class CreateCicloBody extends createZodDto(createCicloSchema) {}

export const upsertQuotasSchema = z.object({
  voosMes: z
    .coerce.number()
    .int()
    .optional()
    .describe('Quota de voos de drone por mês'),
  levantamentosMes: z
    .coerce.number()
    .int()
    .optional()
    .describe('Quota de levantamentos por mês'),
  itensMes: z
    .coerce.number()
    .int()
    .optional()
    .describe('Quota de itens de levantamento por mês'),
  usuariosAtivos: z
    .coerce.number()
    .int()
    .optional()
    .describe('Quota de usuários ativos simultâneos'),
  vistoriasMes: z
    .coerce.number()
    .int()
    .optional()
    .describe('Quota de vistorias por mês'),
  iaCallsMes: z
    .coerce.number()
    .int()
    .optional()
    .describe('Quota de chamadas à IA por mês'),
  storageGb: z.coerce.number().optional().describe('Quota de armazenamento em GB'),
});
export class UpsertQuotasBody extends createZodDto(upsertQuotasSchema) {}
