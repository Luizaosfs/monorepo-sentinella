import { coerceOptionalNumber, jsonRecordOptional } from '@shared/dtos/zod-coercion';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createUnidadeSchema = z.object({
  nome: z
    .string({ required_error: 'Nome obrigatório' })
    .describe('Nome da unidade de saúde'),
  tipo: z
    .string()
    .optional()
    .default('ubs')
    .describe('Tipo da unidade (ubs, ups, hospital, etc.)'),
  endereco: z.string().optional().describe('Endereço completo'),
  latitude: coerceOptionalNumber('Latitude geográfica'),
  longitude: coerceOptionalNumber('Longitude geográfica'),
  cnes: z.string().optional().describe('Código CNES da unidade'),
  tipoSentinela: z
    .string()
    .optional()
    .default('OUTRO')
    .describe('Tipo sentinela para vigilância entomológica'),
  telefone: z.string().optional().describe('Telefone de contato'),
  bairro: z.string().optional().describe('Bairro'),
  municipio: z.string().optional().describe('Município'),
  uf: z.string().max(2).optional().describe('UF (sigla do estado, ex: SP)'),
  ativo: z.boolean().optional().default(true).describe('Unidade ativa'),
  origem: z
    .string()
    .optional()
    .default('manual')
    .describe('Origem do cadastro (manual, cnes)'),
});
export class CreateUnidadeBody extends createZodDto(createUnidadeSchema) {}

export const saveUnidadeSchema = z.object({
  nome: z.string().optional().describe('Nome da unidade de saúde'),
  tipo: z.string().optional().describe('Tipo da unidade'),
  endereco: z.string().optional().describe('Endereço completo'),
  latitude: coerceOptionalNumber('Latitude geográfica'),
  longitude: coerceOptionalNumber('Longitude geográfica'),
  cnes: z.string().optional().describe('Código CNES da unidade'),
  tipoSentinela: z.string().optional().describe('Tipo sentinela'),
  telefone: z.string().optional().describe('Telefone de contato'),
  bairro: z.string().optional().describe('Bairro'),
  municipio: z.string().optional().describe('Município'),
  uf: z.string().max(2).optional().describe('UF (sigla do estado)'),
  ativo: z.boolean().optional().describe('Unidade ativa'),
});
export class SaveUnidadeBody extends createZodDto(saveUnidadeSchema) {}

export const createCasoSchema = z.object({
  unidadeSaudeId: z
    .string()
    .uuid({ message: 'ID da unidade inválido' })
    .describe('ID da unidade de saúde notificante'),
  doenca: z
    .string()
    .optional()
    .default('suspeito')
    .describe('Doença suspeita (dengue, chikungunya, zika)'),
  status: z
    .string()
    .optional()
    .default('suspeito')
    .describe('Status do caso (suspeito, confirmado, descartado)'),
  dataInicioSintomas: z.coerce
    .date()
    .optional()
    .describe('Data de início dos sintomas'),
  dataNotificacao: z.coerce
    .date()
    .optional()
    .describe('Data da notificação (padrão: hoje)'),
  logradouroBairro: z
    .string()
    .optional()
    .describe('Logradouro e bairro do caso'),
  bairro: z.string().optional().describe('Bairro do caso'),
  latitude: coerceOptionalNumber('Latitude do endereço do caso'),
  longitude: coerceOptionalNumber('Longitude do endereço do caso'),
  regiaoId: z.string().uuid().optional().describe('ID da região associada'),
  observacao: z.string().optional().describe('Observações adicionais'),
  payload: jsonRecordOptional('Payload adicional (e-SUS, SINAN)'),
});
export class CreateCasoBody extends createZodDto(createCasoSchema) {}

export const saveCasoSchema = z.object({
  doenca: z.string().optional().describe('Doença'),
  status: z.string().optional().describe('Status do caso'),
  dataInicioSintomas: z.coerce
    .date()
    .optional()
    .describe('Data de início dos sintomas'),
  logradouroBairro: z.string().optional().describe('Logradouro e bairro'),
  bairro: z.string().optional().describe('Bairro'),
  latitude: coerceOptionalNumber('Latitude'),
  longitude: coerceOptionalNumber('Longitude'),
  regiaoId: z.string().uuid().optional().describe('ID da região'),
  observacao: z.string().optional().describe('Observações'),
});
export class SaveCasoBody extends createZodDto(saveCasoSchema) {}

export const createPushSchema = z.object({
  endpoint: z
    .string({ required_error: 'Endpoint obrigatório' })
    .describe('URL do endpoint push (gerado pelo browser)'),
  p256dh: z
    .string({ required_error: 'p256dh obrigatório' })
    .describe('Chave pública p256dh da subscription'),
  auth: z
    .string({ required_error: 'auth obrigatório' })
    .describe('Chave de autenticação da subscription'),
});
export class CreatePushBody extends createZodDto(createPushSchema) {}

export const enviarEsusSchema = z.object({
  levantamentoItemId: z.string().uuid().optional(),
  tipoAgravo: z.enum(['dengue', 'chikungunya', 'zika'], { required_error: 'Tipo de agravo obrigatório' }),
  enderecoCompleto: z.string().optional().nullable(),
  enderecoCurto: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  dataHora: z.string().optional().nullable(),
  dataInicioSintomas: z.string().optional().nullable(),
});
export type EnviarEsusInput = z.infer<typeof enviarEsusSchema>;
export class EnviarEsusBody extends createZodDto(enviarEsusSchema) {}

export const createEsusSchema = z.object({
  levantamentoItemId: z
    .string()
    .uuid()
    .optional()
    .describe('ID do item de levantamento associado'),
  tipoAgravo: z
    .string({ required_error: 'Tipo de agravo obrigatório' })
    .describe('Código do agravo (ex: A90 - dengue)'),
  numeroNotificacao: z
    .string()
    .optional()
    .describe('Número da notificação no e-SUS/SINAN'),
  payloadEnviado: jsonRecordOptional('Payload completo enviado ao e-SUS'),
});
export class CreateEsusBody extends createZodDto(createEsusSchema) {}
