import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const MOTIVOS_SEM_ACESSO = ['fechado_ausente', 'fechado_viagem', 'recusa_entrada', 'cachorro_bravo', 'calha_inacessivel', 'outro'] as const;
export type MotivoSemAcesso = (typeof MOTIVOS_SEM_ACESSO)[number];

export const registrarSemAcessoSchema = z.object({
  motivo: z.enum(MOTIVOS_SEM_ACESSO, {
    required_error: 'Motivo de sem acesso é obrigatório',
  }),
  observacao: z.string().max(500).optional(),
  proximoHorarioSugerido: z.string().max(100).optional(),
  focoRiscoId: z.string().uuid().optional(),
});

export class RegistrarSemAcessoBody extends createZodDto(registrarSemAcessoSchema) {}
export type RegistrarSemAcessoInput = z.infer<typeof registrarSemAcessoSchema>;
