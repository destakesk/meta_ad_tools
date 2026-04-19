import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

/**
 * Authentication module — skeleton.
 *
 * Module 02 will plug in the concrete strategy (NextAuth callback / JWT /
 * Passport local) and expose `/auth/*` endpoints. This file exists now so
 * the dependency graph is stable and imports do not need to shift later.
 */
@Module({
  imports: [
    PassportModule.register({
      session: false,
      defaultStrategy: 'jwt',
    }),
  ],
})
export class AuthModule {}
