import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';

import { WorkspacesController } from './workspaces.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [WorkspacesController],
})
export class WorkspacesModule {}
