import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string({ required_error: 'DATABASE_URL é obrigatória' }),
  SECRET_JWT: z.string({ required_error: 'SECRET_JWT é obrigatória' }),
  JWT_EXPIRES_IN: z.string().default('7d'),
  PORT: z.string().optional().default('3333'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  CLIENT_URL: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ESUS_API_URL: z.string().optional(),
  ESUS_API_TOKEN: z.string().optional(),
  CNES_API_URL: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
  /** Bridge de migração: JWT secret do projeto Supabase (Settings → API → JWT Secret).
   *  Quando definido, o AuthGuard aceita tokens Supabase além dos NestJS JWT.
   *  Remover após migração completa do auth. */
  SUPABASE_JWT_SECRET: z.string().optional(),
});

const getEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error: any) {
    throw new Error(
      `${error.issues[0].message} - ${error.issues[0].path[0] || ''}` ||
        'Erro ao processar variáveis de ambiente',
    );
  }
};

export const env = getEnv();
