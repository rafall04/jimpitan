/**
 * Purpose: Bootstrap the JIMPITAN NestJS API process.
 * Caller: Node.js runtime after TypeScript compilation.
 * Deps: NestFactory, AppModule, ConfigService, Swagger, validation pipe, exception filter, runtime logging.
 * MainFuncs: Configures proxy trust, CORS, API prefix, versioning, validation, exception handling, Swagger, and server listen.
 * SideEffects: Opens an HTTP listener for the backend API.
 */
import 'reflect-metadata';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { validationExceptionFactory } from './common/pipes/validation-exception.factory';
import { resolveLogLevels } from './runtime/logging';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, logger: resolveLogLevels() });
  const config = app.get(ConfigService);
  const apiPrefix = config.get<string>('api.prefix', 'api');
  const apiVersion = config.get<string>('api.version', '1');
  const trustProxyHops = config.get<number>('security.trustProxyHops', 0);
  const corsAllowedOrigins = config.get<string[]>('security.corsAllowedOrigins', []);

  if (trustProxyHops > 0) {
    app.getHttpAdapter().getInstance().set('trust proxy', trustProxyHops);
  }

  if (corsAllowedOrigins.length > 0) {
    app.enableCors({
      credentials: true,
      origin: corsAllowedOrigins,
    });
  }

  app.setGlobalPrefix(apiPrefix);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: apiVersion,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.enableShutdownHooks();

  if (config.get<boolean>('swagger.enabled', true)) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('JIMPITAN API')
      .setDescription('REST API contract for the JIMPITAN RT financial management backend.')
      .setVersion(apiVersion)
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document);
  }

  await app.listen(config.get<number>('api.port', 3001));
}

void bootstrap();
