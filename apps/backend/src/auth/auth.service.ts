import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  STAFF_ROLES,
  type LoginDto,
  type PinLoginDto,
  type RegisterDto,
  type SessionUser,
} from '@nodedr-restaurant/types';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { TwoFactorService } from './two-factor.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  private toSessionUser(user: {
    id: string;
    restaurantId: string;
    name: string;
    roleId: string;
    role: { name: string; permissions: { permission: { key: string } }[] };
  }): SessionUser {
    return {
      id: user.id,
      restaurantId: user.restaurantId,
      name: user.name,
      roleId: user.roleId,
      roleName: user.role.name,
      permissions: user.role.permissions.map((rp) => rp.permission.key),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, isActive: true },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Only asked for after the password is right, so the response never
    // reveals which emails exist or which accounts use two-factor.
    if (user.twoFactorEnabled) {
      await this.twoFactor.verifyLogin(user, dto.totp);
    }

    return this.issueSession(user);
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException(
        'An account with this email already exists',
      );
    }

    // Permissions are global, not per-tenant — upsert (idempotent) outside
    // the transaction below rather than re-creating them per restaurant.
    for (const permission of PERMISSIONS) {
      await this.prisma.permission.upsert({
        where: { key: permission.key },
        update: {},
        create: permission,
      });
    }
    const allPermissions = await this.prisma.permission.findMany();
    const permissionByKey = new Map(allPermissions.map((p) => [p.key, p]));

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const owner = await this.prisma.$transaction(async (tx) => {
      const restaurant = await tx.restaurant.create({
        data: { name: dto.restaurantName },
      });
      const branch = await tx.branch.create({
        data: { restaurantId: restaurant.id, name: dto.branchName },
      });

      let ownerRoleId = '';
      for (const roleName of STAFF_ROLES) {
        const role = await tx.role.create({
          data: {
            restaurantId: restaurant.id,
            name: roleName,
            label: roleName.replace(/_/g, ' '),
          },
        });
        if (roleName === 'OWNER') ownerRoleId = role.id;

        const grantedKeys = DEFAULT_ROLE_PERMISSIONS[roleName];
        await tx.rolePermission.createMany({
          data: grantedKeys
            .map((key) => permissionByKey.get(key))
            .filter((p): p is NonNullable<typeof p> => Boolean(p))
            .map((permission) => ({
              roleId: role.id,
              permissionId: permission.id,
            })),
        });
      }

      const user = await tx.user.create({
        data: {
          restaurantId: restaurant.id,
          roleId: ownerRoleId,
          name: dto.ownerName,
          email: dto.email,
          passwordHash,
        },
        include: {
          role: { include: { permissions: { include: { permission: true } } } },
        },
      });

      await tx.userBranch.create({
        data: { userId: user.id, branchId: branch.id },
      });

      return user;
    });

    return this.issueSession(owner);
  }

  async hasAnyRestaurant(): Promise<boolean> {
    // In SaaS mode the landing page must never show the public signup flow -
    // registration is gated behind super-admin provisioning. Returning true
    // makes setup-status always report already set up, routing UI to login.
    if (process.env.SAAS_MODE === 'true') return true;

    const restaurant = await this.prisma.restaurant.findFirst({
      select: { id: true },
    });
    return restaurant !== null;
  }

  async pinLogin(dto: PinLoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });

    if (!user || !user.isActive || !user.pinHash) {
      throw new UnauthorizedException('PIN login not available for this user');
    }
    // A 4-8 digit PIN must not be a way around the second factor.
    if (user.twoFactorEnabled) {
      throw new UnauthorizedException(
        'PIN login is off for accounts with two-factor authentication — sign in with your password',
      );
    }

    const valid = await bcrypt.compare(dto.pin, user.pinHash);
    if (!valid) {
      throw new UnauthorizedException('Incorrect PIN');
    }

    return this.issueSession(user);
  }

  // ---------------------------------------------------------------------------
  // Invitation token flow (SaaS onboarding — Phase 3)
  // ---------------------------------------------------------------------------

  async getInvitation(token: string) {
    const invitation = await this.prisma.tenantInvitation.findUnique({
      where: { token },
    });
    if (!invitation) throw new BadRequestException('Invalid invitation link');
    if (invitation.usedAt) throw new BadRequestException('This invitation has already been used');
    if (invitation.expiresAt < new Date()) throw new BadRequestException('Invitation has expired');
    return { email: invitation.email, restaurantId: invitation.restaurantId };
  }

  async setupTenantOwner(token: string, password: string) {
    const invitation = await this.prisma.tenantInvitation.findUnique({
      where: { token },
      
    });
    if (!invitation || invitation.usedAt || invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired invitation');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await this.prisma.$transaction(async (tx) => {
      // Activate the placeholder owner user created during provisioning
      await tx.user.updateMany({
        where: { email: invitation.email, restaurantId: invitation.restaurantId ?? undefined },
        data: { passwordHash, isActive: true },
      });
      // Mark invitation as used
      await tx.tenantInvitation.update({
        where: { id: invitation.id },
        data: { usedAt: new Date() },
      });
      // Activate the tenant
      if (invitation.restaurantId) {
        await tx.restaurant.update({
          where: { id: invitation.restaurantId },
          data: { status: 'ACTIVE' },
        });
      }
    });

    // Issue session for the newly activated owner
    const owner = await this.prisma.user.findFirst({
      where: { email: invitation.email, restaurantId: invitation.restaurantId ?? undefined },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });
    if (!owner) throw new BadRequestException('Owner account not found');
    return this.issueSession(owner);
  }

  async exchangeImpersonationToken(token: string) {
    // Verify the 15-min impersonation JWT issued by TenantsService.impersonate()
    let payload: { sub: string; impersonatedBy: string; impersonation: boolean };
    try {
      payload = this.jwt.verify(token) as typeof payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired impersonation token');
    }
    if (!payload.impersonation) throw new UnauthorizedException('Not an impersonation token');

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    });
    if (!user || !user.isActive) throw new UnauthorizedException('Target user not found');
    return this.issueSession(user);
  }
  private async issueSession(
    user: Parameters<AuthService['toSessionUser']>[0],
  ) {
    const sessionUser = this.toSessionUser(user);
    const token = await this.jwt.signAsync({ sub: user.id });
    return { token, user: sessionUser };
  }
}
