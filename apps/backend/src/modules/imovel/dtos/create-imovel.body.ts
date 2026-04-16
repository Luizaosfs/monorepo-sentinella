import { coerceOptionalNumber } from '@shared/dtos/zod-coercion';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createImovelSchema = z.object({
  regiaoId: z.string().uuid().describe('ID da região').optional(),
  tipoImovel: z
    .string()
    .default('residencial')
    .describe('Tipo do imóvel (residencial, comercial, terreno, etc.)'),
  logradouro: z.string().describe('Logradouro (rua, avenida)').optional(),
  numero: z.string().describe('Número do imóvel').optional(),
  complemento: z.string().describe('Complemento do endereço').optional(),
  bairro: z.string().describe('Bairro').optional(),
  quarteirao: z.string().describe('Quarteirão').optional(),
  latitude: coerceOptionalNumber('Latitude GPS do imóvel'),
  longitude: coerceOptionalNumber('Longitude GPS do imóvel'),
  proprietarioAusente: z
    .boolean()
    .default(false)
    .describe('Proprietário ausente no momento da vistoria'),
  tipoAusencia: z
    .string()
    .describe('Tipo de ausência do proprietário')
    .optional(),
  contatoProprietario: z
    .string()
    .describe('Contato do proprietário')
    .optional(),
  temAnimalAgressivo: z
    .boolean()
    .default(false)
    .describe('Há animal agressivo no imóvel'),
  historicoRecusa: z
    .boolean()
    .default(false)
    .describe('Imóvel possui histórico de recusa de vistoria'),
  temCalha: z.boolean().default(false).describe('Imóvel possui calha'),
  calhaAcessivel: z
    .boolean()
    .default(true)
    .describe('Calha é acessível para vistoria'),
  prioridadeDrone: z
    .boolean()
    .default(false)
    .describe('Imóvel é prioritário para voo de drone'),
  notificacaoFormalEm: z.coerce
    .string()
    .transform((v) => (v ? new Date(v) : undefined))
    .describe('Data da notificação formal')
    .optional(),
});

export class CreateImovelBody extends createZodDto(createImovelSchema) {}
