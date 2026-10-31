import {
  Body,
  Controller,
  Get,
  Post,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { SuperAdmin } from '../guards/super-admin.guard';
import { CurrentSuperAdmin } from '../decorators/current-super-admin.decorator';
import type { SuperAdminSession } from './super-admin-jwt.strategy';
import { SuperAdminAuthService } from './super-admin-auth.service';

const SUPER_SESSION_COOKIE = 'nodedr_super_session';
const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function isCookieSecure() {
  return process.env.COOKIE_SECURE === 'true';
}

@Controller('v1/super-admin/auth')
export class SuperAdminAuthController {
  constructor(private readonly authService: SuperAdminAuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  async login(
    @Body() body: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, admin } = await this.authService.login(body.email, body.password);
    res.cookie(SUPER_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isCookieSecure(),
      maxAge: COOKIE_MAX_AGE_MS,
    });
    return { admin };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SUPER_SESSION_COOKIE, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isCookieSecure(),
    });
    return { ok: true };
  }

  @SuperAdmin()
  @Get('me')
  me(@CurrentSuperAdmin() admin: SuperAdminSession) {
    return this.authService.getProfile(admin.id);
  }
}
