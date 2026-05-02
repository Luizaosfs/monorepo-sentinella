import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const addDepositoSchema = z.object({
  tipo:              z.string({ required_error: 'Tipo do depósito obrigatório' }),
  qtdInspecionados:  z.number().int().default(0),
  qtdComFocos:       z.number().int().default(0),
  qtdEliminados:     z.number().int().default(0),
  usouLarvicida:     z.boolean().default(false),
  qtdLarvicidaG:     z.number().optional().nullable(),
  qtdComAgua:        z.number().int().default(0),
  eliminado:         z.boolean().default(false),
  vedado:            z.boolean().default(false),
  iaIdentificacao:   z.record(z.unknown()).optional().nullable(),
});
export class AddDepositoBody extends createZodDto(addDepositoSchema) {}
export type AddDepositoInput = z.infer<typeof addDepositoSchema>;

export const addSintomasSchema = z.object({
  vistoriaId:           z.string().uuid({ message: 'ID da vistoria inválido' }),
  febre:                z.boolean().default(false),
  manchasVermelhas:     z.boolean().default(false),
  dorArticulacoes:      z.boolean().default(false),
  dorCabeca:            z.boolean().default(false),
  nausea:               z.boolean().default(false),
  moradoresSintomasQtd: z.number().int().default(0),
});
export class AddSintomasBody extends createZodDto(addSintomasSchema) {}
export type AddSintomasInput = z.infer<typeof addSintomasSchema>;

export const addRiscosSchema = z.object({
  vistoriaId:              z.string().uuid({ message: 'ID da vistoria inválido' }),
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
  outroRiscoVetorial:      z.string().optional().nullable(),
});
export class AddRiscosBody extends createZodDto(addRiscosSchema) {}
export type AddRiscosInput = z.infer<typeof addRiscosSchema>;
