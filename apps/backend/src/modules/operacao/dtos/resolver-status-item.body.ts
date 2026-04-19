import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const resolverStatusItemSchema = z.object({
  itemId: z.string().uuid({ message: 'ID do item inválido' }),
});
export class ResolverStatusItemBody extends createZodDto(resolverStatusItemSchema) {}
export type ResolverStatusItemInput = z.infer<typeof resolverStatusItemSchema>;

export const listExistingItemIdsSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1, { message: 'Pelo menos um itemId é obrigatório' }),
});
export class ListExistingItemIdsBody extends createZodDto(listExistingItemIdsSchema) {}
export type ListExistingItemIdsInput = z.infer<typeof listExistingItemIdsSchema>;
