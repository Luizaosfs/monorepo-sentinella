import 'dotenv/config';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import helmet from 'helmet';
import { patchNestJsSwagger } from 'nestjs-zod';

import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { MyZodValidationPipe } from './pipes/zod-validations.pipe';
import { AppModule } from './app.module';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function () { return Number(this); };

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Permite que req.ip reflita o IP real atrás de proxy/load balancer
  app.getHttpAdapter().getInstance().set('trust proxy', true);

  //app.use(helmet());
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: [
            "'self'",
            "https://sentinellamap.com.br",
            "https://www.sentinellamap.com.br",
            "http://localhost:3333",
            "http://localhost:8080",
            "https://*.supabase.co",
            "wss://*.supabase.co",
            "https://maps.googleapis.com",
            "https://*.sentry.io",
            "https://o4511116110528512.ingest.us.sentry.io",
            "https://api.open-meteo.com",
          ],
          imgSrc: [
            "'self'",
            "data:",
            "blob:",
            "https:",
          ],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
          ],
          fontSrc: [
            "'self'",
            "data:",
            "https://fonts.gstatic.com",
          ],
        },
      },
    }),
  );

  app.useGlobalPipes(new MyZodValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());

  const allowedOrigins = process.env.CLIENT_URL?.split(',').map(o => o.trim()).filter(Boolean) ?? [];
  const isDev = process.env.NODE_ENV === 'development';

  if (!isDev && allowedOrigins.length === 0) {
    throw new Error('CLIENT_URL must be set with at least one origin in non-development environments');
  }

  app.enableCors({
    origin: isDev ? true : allowedOrigins,
    credentials: true,
  });

  if (process.env.NODE_ENV !== 'production') {
    patchNestJsSwagger();

    const config = new DocumentBuilder()
      .setTitle('Sentinella Web API')
      .setDescription('API do Sentinella Web — Vigilância Entomológica Municipal')
      .setVersion('1.0')
      .addTag('Sentinella')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
        'token',
      )
      .addSecurityRequirements('token')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api-docs', app, document);

    app.use('/reference', apiReference({ spec: { content: document } }));
  }

  await app.listen(process.env.PORT ?? 3333, '0.0.0.0');
  const logger = new Logger('Bootstrap');
  logger.log(`Sentinella API rodando na porta ${process.env.PORT ?? 3333}`);
  Logger.verbose(
    `\x1b[33m💰💵 API running on port ${process.env.PORT ?? 3333} 💵💰`,
  );
  Logger.verbose(
    `\x1b[36mAccess at http://127.0.0.1:${process.env.PORT ?? 3333}/reference ...\n`,
  );
}
bootstrap();
