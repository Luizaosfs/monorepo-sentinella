import { z } from 'zod';

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

export type ResetPasswordBody = z.infer<typeof resetPasswordSchema>;
