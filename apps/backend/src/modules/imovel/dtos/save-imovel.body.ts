import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const saveImovelSchema = z.object({
  regiaoId: z.string().uuid().describe('ID da região').optional(),
  tipoImovel: z.string().describe('Tipo do imóvel').optional(),
  logradouro: z.string().describe('Logradouro').optional(),
  numero: z.string().describe('Número do imóvel').optional(),
  complemento: z.string().describe('Complemento do endereço').optional(),
  bairro: z.string().describe('Bairro').optional(),
  quarteirao: z.string().describe('Quarteirão').optional(),
  latitude: z.number().describe('Latitude GPS').optional(),
  longitude: z.number().describe('Longitude GPS').optional(),
  ativo: z.boolean().describe('Ativa ou desativa o imóvel').optional(),
  proprietarioAusente: z.boolean().describe('Proprietário ausente').optional(),
  tipoAusencia: z.string().describe('Tipo de ausência').optional(),
  contatoProprietario: z
    .string()
    .describe('Contato do proprietário')
    .optional(),
  temAnimalAgressivo: z.boolean().describe('Há animal agressivo').optional(),
  historicoRecusa: z.boolean().describe('Histórico de recusa').optional(),
  temCalha: z.boolean().describe('Possui calha').optional(),
  calhaAcessivel: z.boolean().describe('Calha acessível').optional(),
  prioridadeDrone: z.boolean().describe('Prioritário para drone').optional(),
  notificacaoFormalEm: z.coerce
    .string()
    .transform((v) => (v ? new Date(v) : undefined))
    .describe('Data da notificação formal')
    .optional(),
});

export class SaveImovelBody extends createZodDto(saveImovelSchema) {}
