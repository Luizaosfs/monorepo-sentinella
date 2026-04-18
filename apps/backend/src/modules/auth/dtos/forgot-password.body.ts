import { z } from 'zod';

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
  redirectTo: z.string().url().optional(),
});

export type ForgotPasswordBody = z.infer<typeof forgotPasswordSchema>;
