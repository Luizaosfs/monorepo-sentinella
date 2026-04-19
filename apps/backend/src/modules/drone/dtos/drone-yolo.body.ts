import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const bulkCreateVoosSchema = z.object({
  rows: z
    .array(
      z.object({
        inicio:           z.coerce.date(),
        fim:              z.coerce.date().optional().nullable(),
        planejamentoId:   z.string().uuid().optional().nullable(),
        pilotoId:         z.string().uuid().optional().nullable(),
        vooNumero:        z.number().int().optional().nullable(),
        duracaoMin:       z.number().optional().nullable(),
        km:               z.number().optional().nullable(),
        ha:               z.number().optional().nullable(),
        baterias:         z.number().int().optional().nullable(),
        fotos:            z.number().int().optional().nullable(),
        amostLat:         z.number().optional().nullable(),
        amostLon:         z.number().optional().nullable(),
        amostDataHora:    z.coerce.date().optional().nullable(),
        amostArquivo:     z.string().optional().nullable(),
      }),
    )
    .min(1)
    .max(500),
});
export type BulkCreateVoosInput = z.infer<typeof bulkCreateVoosSchema>;
export class BulkCreateVoosBody extends createZodDto(bulkCreateVoosSchema) {}

export const updateDroneRiskConfigSchema = z.object({
  baseByRisco:           z.record(z.number()).optional(),
  priorityThresholds:    z.record(z.number()).optional(),
  slaByPriorityHours:    z.record(z.number()).optional(),
  confidenceMultiplier:  z.number().optional(),
  itemOverrides:         z.record(z.unknown()).optional(),
});
export type UpdateDroneRiskConfigInput = z.infer<typeof updateDroneRiskConfigSchema>;
export class UpdateDroneRiskConfigBody extends createZodDto(updateDroneRiskConfigSchema) {}

export const updateYoloClassSchema = z.object({
  item:      z.string().optional(),
  risco:     z.string().optional(),
  peso:      z.number().int().optional(),
  acao:      z.string().optional().nullable(),
  isActive:  z.boolean().optional(),
});
export type UpdateYoloClassInput = z.infer<typeof updateYoloClassSchema>;
export class UpdateYoloClassBody extends createZodDto(updateYoloClassSchema) {}

export const addSynonymSchema = z.object({
  synonym: z.string().min(1).transform(v => v.trim().toLowerCase()),
  mapsTo:  z.string().min(1).transform(v => v.trim().toLowerCase()),
});
export type AddSynonymInput = z.infer<typeof addSynonymSchema>;
export class AddSynonymBody extends createZodDto(addSynonymSchema) {}
