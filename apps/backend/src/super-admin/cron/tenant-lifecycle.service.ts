import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { LocalUploadService } from '../../common/services/local-upload.service';

@Injectable()
export class TenantLifecycleService {
  private readonly logger = new Logger(TenantLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: LocalUploadService,
  ) {}

  /** Daily at midnight — move TRIAL tenants past trialEndsAt to EXPIRED. */
  @Cron('0 0 * * *')
  async expireTrials() {
    const result = await this.prisma.restaurant.updateMany({
      where: {
        status: 'TRIAL',
        trialEndsAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    });
    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} trial tenant(s)`);
    }
  }

  /**
   * Daily at 02:00 — hard-purge CANCELLED tenants past the 30-day grace period.
   * Deletes local upload files first, then the DB row (cascade removes all data).
   */
  @Cron('0 2 * * *')
  async purgeExpiredTenants() {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const tenants = await this.prisma.restaurant.findMany({
      where: { status: 'CANCELLED', cancelledAt: { lt: cutoff } },
      select: { id: true, name: true },
    });

    for (const tenant of tenants) {
      try {
        // Remove uploads directory for this tenant before deleting DB records
        this.uploads.deletePrefix(tenant.id);
        // Cascade-delete removes branches, users, orders, etc.
        await this.prisma.restaurant.delete({ where: { id: tenant.id } });
        this.logger.log(`Purged tenant: ${tenant.name} (${tenant.id})`);
      } catch (err) {
        this.logger.error(`Failed to purge tenant ${tenant.id}:`, err);
      }
    }
  }
}
