import { z } from 'zod';

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
  redirectTo: z
    .string()
    .url()
    .refine((value) => {
      try {
        const url = new URL(value);
        return (
          (url.protocol === 'http:' || url.protocol === 'https:') &&
          !url.username &&
          !url.password
        );
      } catch {
        return false;
      }
    }, { message: 'redirectTo deve ser http(s) sem credenciais' })
    .optional(),
});

export type ForgotPasswordBody = z.infer<typeof forgotPasswordSchema>;
