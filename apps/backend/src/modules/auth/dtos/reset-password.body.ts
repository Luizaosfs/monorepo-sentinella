import { z } from 'zod';

export const resetPasswordSchema = z.object({
  token: z.string().min(64).max(128),
  newPassword: z.string().min(8).max(128),
});

export type ResetPasswordBody = z.infer<typeof resetPasswordSchema>;
