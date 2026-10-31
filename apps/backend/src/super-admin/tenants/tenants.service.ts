import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SAAS_OWNER_PERMISSIONS } from '@nodedr-restaurant/types';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  CreateTenantDto,
  SetTenantStatusDto,
  UpdateTenantDto,
} from '../dto/tenant.dto';

// Max limits per tier
const TIER_LIMITS: Record<
  'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE',
  { maxBranches: number; maxStaff: number }
> = {
  STARTER: { maxBranches: 1, maxStaff: 10 },
  PROFESSIONAL: { maxBranches: 5, maxStaff: 50 },
  ENTERPRISE: { maxBranches: 999, maxStaff: 9999 },
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async findAll(page = 1, limit = 20, status?: string) {
    const where = status ? { status: status as never } : {};
    const [data, total] = await Promise.all([
      this.prisma.restaurant.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          subscriptionTier: true,
          maxBranches: true,
          maxStaff: true,
          contactEmail: true,
          trialEndsAt: true,
          expiresAt: true,
          cancelledAt: true,
          createdAt: true,
          _count: { select: { branches: true, users: true } },
        },
      }),
      this.prisma.restaurant.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const tenant = await this.prisma.restaurant.findUnique({
      where: { id },
      include: {
        _count: { select: { branches: true, users: true } },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async getStats() {
    const [total, byStatus] = await Promise.all([
      this.prisma.restaurant.count(),
      this.prisma.restaurant.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);
    const statusMap = Object.fromEntries(
      byStatus.map((r) => [r.status, r._count._all]),
    );
    return {
      total,
      TRIAL: statusMap['TRIAL'] ?? 0,
      ACTIVE: statusMap['ACTIVE'] ?? 0,
      SUSPENDED: statusMap['SUSPENDED'] ?? 0,
      EXPIRED: statusMap['EXPIRED'] ?? 0,
      CANCELLED: statusMap['CANCELLED'] ?? 0,
    };
  }

  async create(dto: CreateTenantDto, superAdminId: string) {
    const tier = dto.subscriptionTier ?? 'STARTER';
    const tierLimits = TIER_LIMITS[tier];
    const maxBranches = dto.maxBranches ?? tierLimits.maxBranches;
    const maxStaff = dto.maxStaff ?? tierLimits.maxStaff;

    // Resolve slug — auto-derive from name, append random suffix if taken
    let slug = dto.slug ?? slugify(dto.name);
    const existing = await this.prisma.restaurant.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${randomBytes(3).toString('hex')}`;
    }

    // Determine trial expiry
    const config = await this.prisma.platformConfig.findUnique({
      where: { id: 'singleton' },
    });
    const trialDays = dto.trialDays ?? config?.defaultTrialDays ?? 14;
    const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

    // Atomic provisioning transaction
    const { restaurant, invitationToken } = await this.prisma.$transaction(
      async (tx) => {
        // 1. Create restaurant (tenant)
        const restaurant = await tx.restaurant.create({
          data: {
            name: dto.name,
            slug,
            status: 'TRIAL',
            subscriptionTier: tier,
            maxBranches,
            maxStaff,
            contactEmail: dto.email,
            notes: dto.notes,
            trialEndsAt,
            s3Prefix: `restaurants/`,
          },
        });

        // 2. Create OWNER role with SaaS-safe permissions
        const ownerRole = await tx.role.create({
          data: {
            name: 'OWNER',
            label: 'Owner',
            restaurantId: restaurant.id,
          },
        });

        // 3. Seed permissions for OWNER role
        const allPerms = await tx.permission.findMany({
          where: { key: { in: SAAS_OWNER_PERMISSIONS as unknown as string[] } },
        });
        if (allPerms.length > 0) {
          await tx.rolePermission.createMany({
            data: allPerms.map((p) => ({
              roleId: ownerRole.id,
              permissionId: p.id,
            })),
          });
        }

        // 4. Create a placeholder owner User (password set via invitation flow)
        const tmpPasswordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
        await tx.user.create({
          data: {
            restaurantId: restaurant.id,
            name: 'Owner',
            email: dto.email,
            passwordHash: tmpPasswordHash,
            roleId: ownerRole.id,
            isActive: false, // activated when invitation is accepted
          },
        });

        // 5. Create invitation token (72-hour expiry)
        const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
        const invitation = await tx.tenantInvitation.create({
          data: {
            email: dto.email,
            restaurantId: restaurant.id,
            expiresAt,
          },
        });

        return { restaurant, invitationToken: invitation.token };
      },
    );

    // Audit log (outside transaction — non-critical)
    await this.audit.record({
      restaurantId: restaurant.id,
      action: 'tenant.created',
      entity: 'Restaurant',
      entityId: restaurant.id,
      metadata: { name: restaurant.name, slug, tier, superAdminId },
    });

    return {
      restaurant,
      invitationToken,
      invitationUrl: `/auth/invitation/${invitationToken}`,
    };
  }

  async update(id: string, dto: UpdateTenantDto, superAdminId: string) {
    const tenant = await this.prisma.restaurant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const updated = await this.prisma.restaurant.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.contactEmail ? { contactEmail: dto.contactEmail } : {}),
        ...(dto.subscriptionTier ? { subscriptionTier: dto.subscriptionTier } : {}),
        ...(dto.maxBranches !== undefined ? { maxBranches: dto.maxBranches } : {}),
        ...(dto.maxStaff !== undefined ? { maxStaff: dto.maxStaff } : {}),
        ...(dto.expiresAt ? { expiresAt: new Date(dto.expiresAt) } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });

    await this.audit.record({
      restaurantId: id,
      action: 'tenant.updated',
      entity: 'Restaurant',
      entityId: id,
      metadata: { changes: JSON.parse(JSON.stringify(dto)), superAdminId },
    });

    return updated;
  }

  async setStatus(id: string, dto: SetTenantStatusDto, superAdminId: string) {
    const tenant = await this.prisma.restaurant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const data: Record<string, unknown> = { status: dto.status };
    if (dto.status === 'CANCELLED') data.cancelledAt = new Date();

    const updated = await this.prisma.restaurant.update({ where: { id }, data });

    await this.audit.record({
      restaurantId: id,
      action: `tenant.status.${dto.status.toLowerCase()}`,
      entity: 'Restaurant',
      entityId: id,
      metadata: { previousStatus: tenant.status, newStatus: dto.status, reason: dto.reason, superAdminId },
    });

    return updated;
  }

  async impersonate(tenantId: string, superAdminId: string) {
    const tenant = await this.prisma.restaurant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const owner = await this.prisma.user.findFirst({
      where: { restaurantId: tenantId, role: { name: 'OWNER' }, isActive: true },
      select: { id: true, name: true, restaurantId: true },
    });
    if (!owner) throw new NotFoundException('No active owner found for this tenant');

    // Short-lived token (15 min) — MUST be signed with JWT_SECRET (tenant secret)
    // so the normal JwtStrategy can verify it. The JwtModule in SuperAdminModule
    // uses SUPER_ADMIN_JWT_SECRET, so we override per-call here.
    const token = this.jwt.sign(
      {
        sub: owner.id,
        restaurantId: owner.restaurantId,
        impersonatedBy: superAdminId,
        impersonation: true,
      },
      { expiresIn: '15m', secret: process.env.JWT_SECRET },
    );

    await this.audit.record({
      restaurantId: tenantId,
      action: 'tenant.impersonated',
      entity: 'Restaurant',
      entityId: tenantId,
      metadata: { superAdminId, targetUserId: owner.id, targetUserName: owner.name },
    });

    return { token, tenantName: tenant.name };
  }

  async exportData(id: string) {
    const tenant = await this.findOne(id);
    const [branches, users, menuCount, orderCount] = await Promise.all([
      this.prisma.branch.findMany({ where: { restaurantId: id }, select: { id: true, name: true } }),
      this.prisma.user.findMany({ where: { restaurantId: id }, select: { id: true, name: true, email: true } }),
      this.prisma.menuItem.count({ where: { branch: { restaurantId: id } } }),
      this.prisma.order.count({ where: { branch: { restaurantId: id } } }),
    ]);
    return {
      tenant,
      branches,
      users,
      summary: { menuItems: menuCount, orders: orderCount },
      exportedAt: new Date().toISOString(),
    };
  }
}
