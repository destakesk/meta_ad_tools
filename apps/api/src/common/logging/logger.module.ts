import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';

import type { AppConfig } from '../../config/configuration.js';

/**
 * Centralised pino logger.
 *
 * Redaction paths cover the OWASP logging cheatsheet's minimum — any
 * Authorization header, cookies, passwords, tokens, or API keys are
 * replaced with [REDACTED] before the log leaves the process.
 *
 * Each request is tagged with an `x-request-id` (generated if the client
 * didn't provide one) so child loggers can correlate downstream work.
 */
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const isDev = config.get('env', { infer: true }) === 'development';
        const level = config.get('logLevel', { infer: true });

        return {
          pinoHttp: {
            level,
            genReqId: (req, res) => {
              const existing = req.headers['x-request-id'];
              const id =
                typeof existing === 'string' && existing.length > 0 ? existing : randomUUID();
              res.setHeader('x-request-id', id);
              return id;
            },
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.headers["set-cookie"]',
                'req.headers["x-api-key"]',
                'res.headers["set-cookie"]',
                '*.password',
                '*.token',
                '*.accessToken',
                '*.refreshToken',
                '*.apiKey',
                '*.secret',
              ],
              censor: '[REDACTED]',
            },
            serializers: {
              req: (req: { id?: string; method?: string; url?: string }) => ({
                id: req.id,
                method: req.method,
                url: req.url,
              }),
              res: (res: { statusCode?: number }) => ({
                statusCode: res.statusCode,
              }),
            },
            transport: isDev
              ? {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname,req,res,responseTime',
                  },
                }
              : undefined,
          },
        };
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
