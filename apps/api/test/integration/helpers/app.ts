import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';

import { AppModule } from '../../../src/app.module.js';
import { GlobalExceptionFilter } from '../../../src/common/filters/global-exception.filter.js';
import { ApiResponseInterceptor } from '../../../src/common/interceptors/api-response.interceptor.js';

import type { INestApplication } from '@nestjs/common';

/**
 * Boots a full NestJS instance against the testcontainers Postgres + Redis.
 * Mirrors the real `main.ts` bootstrap so guards, pipes, and prefixes match
 * production behaviour.
 *
 * Tests should call `app.close()` in afterAll to free queue + db connections.
 */
export async function buildTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  app.setGlobalPrefix('api', { exclude: ['health', 'health/live', 'health/ready'] });
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  await app.init();
  return app;
}
