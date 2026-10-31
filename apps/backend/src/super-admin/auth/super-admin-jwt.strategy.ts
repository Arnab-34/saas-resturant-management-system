import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

export interface SuperAdminPayload {
  sub: string;
  type: 'super-admin';
}

export interface SuperAdminSession {
  id: string;
  email: string;
  name: string;
  isSuperAdmin: true;
}

const cookieExtractor = (req: {
  cookies?: Record<string, string>;
}): string | null => req.cookies?.['nodedr_super_session'] ?? null;

@Injectable()
export class SuperAdminJwtStrategy extends PassportStrategy(
  Strategy,
  'super-admin-jwt',
) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('SUPER_ADMIN_JWT_SECRET'),
    });
  }

  async validate(payload: SuperAdminPayload): Promise<SuperAdminSession> {
    if (payload.type !== 'super-admin') {
      throw new UnauthorizedException('Invalid session type');
    }
    const admin = await this.prisma.superAdmin.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true },
    });
    if (!admin) throw new UnauthorizedException('Super admin not found');
    return { ...admin, isSuperAdmin: true };
  }
}
