import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createLevantamentoItemSchema = z.object({
  latitude: z.number().describe('Latitude GPS').optional(),
  longitude: z.number().describe('Longitude GPS').optional(),
  item: z.string().describe('Classificação do item detectado').optional(),
  risco: z.string().describe('Nível de risco').optional(),
  acao: z.string().describe('Ação recomendada').optional(),
  scoreFinal: z.number().int().describe('Score de risco calculado').optional(),
  prioridade: z.string().describe('Prioridade (P1–P5)').optional(),
  slaHoras: z.number().int().describe('SLA em horas').optional(),
  enderecoCurto: z.string().describe('Endereço resumido').optional(),
  enderecoCompleto: z.string().describe('Endereço completo').optional(),
  imageUrl: z.string().describe('URL da imagem').optional(),
  maps: z.string().describe('Link Google Maps').optional(),
  waze: z.string().describe('Link Waze').optional(),
  dataHora: z.coerce.date().describe('Data/hora da detecção').optional(),
  peso: z.number().int().describe('Peso para ordenação').optional(),
  payload: z.record(z.unknown()).describe('Dados extras').optional(),
  imagePublicId: z.string().describe('Public ID Cloudinary').optional(),
});

export class CreateLevantamentoItemBody extends createZodDto(
  createLevantamentoItemSchema,
) {}
