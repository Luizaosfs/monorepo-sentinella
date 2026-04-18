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
  // === SMTP (envio de email próprio) ===
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional().default('587'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  // === Bridge Supabase (manter enquanto tokens antigos circulam) ===
  /** AuthGuard aceita tokens Supabase enquanto migração não está 100% concluída. */
  SUPABASE_JWT_SECRET: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
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
