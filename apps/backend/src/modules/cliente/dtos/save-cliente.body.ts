import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const saveClienteSchema = z.object({
  nome: z
    .string()
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .describe('Nome do município/cliente')
    .optional(),
  cnpj: z.string().describe('CNPJ da prefeitura').optional(),
  contatoEmail: z
    .string()
    .email('Email inválido')
    .describe('Email de contato da prefeitura')
    .optional(),
  contatoTelefone: z
    .string()
    .describe('Telefone de contato da prefeitura')
    .optional(),
  latitudeCentro: z
    .number()
    .describe('Latitude do centro geográfico do município')
    .optional(),
  longitudeCentro: z
    .number()
    .describe('Longitude do centro geográfico do município')
    .optional(),
  bounds: z
    .object({})
    .passthrough()
    .describe('Bounding box GeoJSON do município')
    .optional(),
  kmzUrl: z
    .string()
    .url('URL inválida')
    .describe('URL do arquivo KMZ com os limites do município')
    .optional(),
  ativo: z
    .boolean()
    .describe('Ativa ou desativa o cliente na plataforma')
    .optional(),
  area: z
    .object({})
    .passthrough()
    .describe('GeoJSON com a área do município')
    .optional(),
  endereco: z.string().describe('Endereço da sede da prefeitura').optional(),
  bairro: z.string().describe('Bairro da sede').optional(),
  cidade: z.string().describe('Cidade').optional(),
  estado: z.string().describe('Estado por extenso').optional(),
  cep: z.string().describe('CEP da sede').optional(),
  uf: z
    .string()
    .length(2, 'UF deve ter 2 caracteres')
    .describe('Sigla do estado (ex: SP)')
    .optional(),
  ibgeMunicipio: z
    .string()
    .length(7, 'Código IBGE deve ter 7 dígitos')
    .describe('Código IBGE do município com 7 dígitos')
    .optional(),
  surtoAtivo: z
    .boolean()
    .describe('Indica se há surto ativo no município')
    .optional(),
  janelaRecorrenciaDias: z
    .number()
    .int()
    .positive()
    .describe('Janela em dias para considerar recorrência de focos')
    .optional(),
});

export class SaveClienteBody extends createZodDto(saveClienteSchema) {}
