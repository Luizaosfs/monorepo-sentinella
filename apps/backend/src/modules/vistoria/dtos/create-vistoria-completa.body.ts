import { coerceOptionalNumber } from '@shared/dtos/zod-coercion';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const depositoSchema = z.object({
  tipoDeposito: z
    .string({ required_error: 'Tipo de depósito obrigatório' })
    .describe('Tipo do depósito (A1, A2, B, C, D1, D2, E)'),
  quantidade: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .describe('Quantidade encontrada'),
  comLarva: z.boolean().optional().describe('Presença de larvas'),
  eliminado: z.boolean().optional().describe('Depósito eliminado'),
  tratado: z.boolean().optional().describe('Depósito tratado'),
  observacao: z.string().optional().describe('Observações'),
  fotoUrl: z.string().url().optional().describe('URL da foto'),
});

const sintomaSchema = z.object({
  febre:                z.boolean().default(false),
  manchasVermelhas:     z.boolean().default(false),
  dorArticulacoes:      z.boolean().default(false),
  dorCabeca:            z.boolean().default(false),
  nausea:               z.boolean().default(false),
  moradoresSintomasQtd: z.number().int().default(0),
});

const riscoSchema = z.object({
  menorIncapaz:            z.boolean().default(false),
  idosoIncapaz:            z.boolean().default(false),
  mobilidadeReduzida:      z.boolean().default(false),
  acamado:                 z.boolean().default(false),
  depQuimico:              z.boolean().default(false),
  riscoAlimentar:          z.boolean().default(false),
  riscoMoradia:            z.boolean().default(false),
  criadouroAnimais:        z.boolean().default(false),
  lixo:                    z.boolean().default(false),
  residuosOrganicos:       z.boolean().default(false),
  residuosQuimicos:        z.boolean().default(false),
  residuosMedicos:         z.boolean().default(false),
  acumuloMaterialOrganico: z.boolean().default(false),
  animaisSinaisLv:         z.boolean().default(false),
  caixaDestampada:         z.boolean().default(false),
  outroRiscoVetorial:      z.string().optional(),
});

const calhaSchema = z.object({
  tipo: z.string().optional().describe('Tipo da calha'),
  estado: z.string().optional().describe('Estado de conservação'),
  comAcumulo: z.boolean().optional().describe('Com acúmulo de água'),
  observacao: z.string().optional().describe('Observações'),
});

export const createVistoriaCompletaSchema = z.object({
  idempotencyKey: z
    .string()
    .uuid()
    .optional()
    .describe(
      'Chave de idempotência (UUID) — se já existe vistoria com idempotency_key igual, retorna o ID existente',
    ),
  clienteId: z
    .string()
    .uuid()
    .optional()
    .describe(
      'ID do cliente (tenant) — preenchido pelo backend via TenantGuard',
    ),
  imovelId: z.string().uuid().optional().describe('ID do imóvel vistoriado'),
  agenteId: z
    .string()
    .uuid()
    .optional()
    .describe('ID do agente (padrão: usuário logado)'),
  planejamentoId: z.string().uuid().optional().describe('ID do planejamento'),
  ciclo: z.coerce
    .number()
    .int()
    .min(1)
    .max(6)
    .describe('Número do ciclo epidemiológico'),
  tipoAtividade: z
    .string({ required_error: 'Tipo de atividade obrigatório' })
    .describe('Tipo da atividade (LI, LIRAa, PE, TR, etc.)'),
  dataVisita: z.coerce.date().describe('Data/hora da visita'),
  status: z.string().default('pendente').describe('Status da vistoria'),
  moradoresQtd: z.coerce.number().int().optional().describe('Qtd de moradores'),
  gravidas: z.boolean().default(false).describe('Há gestantes no imóvel'),
  idosos: z.boolean().default(false).describe('Há idosos no imóvel'),
  criancas7anos: z
    .boolean()
    .default(false)
    .describe('Há crianças menores de 7 anos'),
  latChegada: coerceOptionalNumber('Latitude de chegada'),
  lngChegada: coerceOptionalNumber('Longitude de chegada'),
  checkinEm: z.coerce.date().optional().describe('Momento do check-in'),
  observacao: z.string().optional().describe('Observações gerais'),
  payload: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Payload JSON auxiliar'),
  acessoRealizado: z
    .boolean()
    .default(true)
    .describe('Acesso ao imóvel foi realizado'),
  motivoSemAcesso: z
    .string()
    .optional()
    .describe('Motivo pelo qual não houve acesso'),
  proximoHorarioSugerido: z
    .string()
    .optional()
    .describe('Horário sugerido pelo morador para retorno'),
  observacaoAcesso: z.string().optional().describe('Observação sobre o acesso'),
  fotoExternaUrl: z
    .string()
    .url()
    .optional()
    .describe('URL da foto externa do imóvel'),
  origemVisita: z.string().optional().describe('Origem da visita'),
  habitatSelecionado: z.string().optional().describe('Habitat selecionado'),
  condicaoHabitat: z.string().optional().describe('Condição do habitat'),
  assinaturaPublicId: z
    .string()
    .optional()
    .describe('Public ID Cloudinary da assinatura'),
  fotoExternaPublicId: z
    .string()
    .optional()
    .describe('Public ID Cloudinary da foto externa'),
  focoRiscoId: z
    .string()
    .uuid()
    .optional()
    .describe('Vínculo com foco de risco'),
  assinaturaResponsavelUrl: z
    .string()
    .url()
    .optional()
    .describe('URL da assinatura do responsável'),
  pendenteAssinatura: z
    .boolean()
    .default(false)
    .describe('Aguarda assinatura do responsável'),
  pendenteFoto: z.boolean().default(false).describe('Aguarda foto externa'),
  origemOffline: z.boolean().default(false).describe('Registro feito offline'),
  depositos: z
    .array(depositoSchema)
    .optional()
    .describe('Depósitos identificados'),
  sintomas: z.array(sintomaSchema).optional().describe('Sintomas observados'),
  riscos: z.array(riscoSchema).optional().describe('Riscos identificados'),
  calhas: z.array(calhaSchema).optional().describe('Calhas inspecionadas'),
});

export class CreateVistoriaCompletaBody extends createZodDto(
  createVistoriaCompletaSchema,
) {}
