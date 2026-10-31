import { Body, Controller, Get, Patch } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SuperAdmin } from '../guards/super-admin.guard';

@SuperAdmin()
@Controller('v1/super-admin/system')
export class SystemController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('config')
  async getConfig() {
    const config = await this.prisma.platformConfig.findUnique({
      where: { id: 'singleton' },
    });
    // Return defaults if singleton not yet created
    return (
      config ?? {
        defaultTrialDays: 14,
        routingMode: 'BOTH',
        cookieDomain: null,
        s3Bucket: null,
        s3Region: null,
        smtpConfigured: false,
      }
    );
  }

  @Patch('config')
  async updateConfig(
    @Body()
    dto: {
      defaultTrialDays?: number;
      routingMode?: string;
      cookieDomain?: string | null;
      s3Bucket?: string | null;
      s3Region?: string | null;
    },
  ) {
    return this.prisma.platformConfig.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...dto },
      update: dto,
    });
  }
}
