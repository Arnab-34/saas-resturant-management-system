import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * Blocks entire route groups for tenant users when SAAS_MODE=true.
 *
 * Applied to:
 *   - /api/v1/backups/*   — backup/restore is a platform-level operation
 *   - /api/v1/system/*    — updater sidecar controls the whole deployment
 *   - /api/v1/sync/*      — DB sync could leak cross-tenant data
 *
 * These routes are still accessible to the super admin via their own
 * dedicated /api/v1/super-admin/* endpoints (built in Phase 2).
 */
@Injectable()
export class SaasRouteBlockMiddleware implements NestMiddleware {
  use(_req: Request, res: Response, next: NextFunction) {
    if (process.env.SAAS_MODE !== 'true') {
      return next();
    }
    res.status(403).json({
      statusCode: 403,
      message:
        'This feature is managed by the platform administrator and is not available to tenants.',
    });
  }
}
