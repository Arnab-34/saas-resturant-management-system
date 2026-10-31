import { applyDecorators, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

export class SuperAdminGuard extends AuthGuard('super-admin-jwt') {}

/** Apply to any controller or route to require super-admin authentication. */
export function SuperAdmin() {
  return applyDecorators(UseGuards(SuperAdminGuard));
}
