import { z } from 'zod';

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export type ChangePasswordBody = z.infer<typeof changePasswordSchema>;
