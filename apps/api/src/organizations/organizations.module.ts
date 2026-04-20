import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { EmailModule } from '../email/email.module.js';

import { OrganizationsController } from './organizations.controller.js';
import { OrganizationsService } from './organizations.service.js';

@Module({
  imports: [AuthModule, EmailModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
