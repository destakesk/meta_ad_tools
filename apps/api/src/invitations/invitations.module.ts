import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { InvitationsController } from './invitations.controller.js';

@Module({
  imports: [AuthModule, OrganizationsModule],
  controllers: [InvitationsController],
})
export class InvitationsModule {}
