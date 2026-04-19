import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '@metaflow/shared-types';

export const REQUIRED_PERMISSION_KEY = 'auth:required-permission';

/** Endpoint requires this permission for the current user (scope inferred from key). */
export const RequirePermission = (permission: PermissionKey): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_PERMISSION_KEY, permission);
