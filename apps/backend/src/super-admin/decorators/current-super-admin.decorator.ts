import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { SuperAdminSession } from '../auth/super-admin-jwt.strategy';

export const CurrentSuperAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SuperAdminSession => {
    return ctx.switchToHttp().getRequest().user as SuperAdminSession;
  },
);
