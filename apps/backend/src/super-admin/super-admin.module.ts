import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { LocalUploadService } from '../common/services/local-upload.service';

import { SuperAdminJwtStrategy } from './auth/super-admin-jwt.strategy';
import { SuperAdminAuthService } from './auth/super-admin-auth.service';
import { SuperAdminAuthController } from './auth/super-admin-auth.controller';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { TenantsService } from './tenants/tenants.service';
import { TenantsController } from './tenants/tenants.controller';
import { SystemController } from './system/system.controller';
import { TenantLifecycleService } from './cron/tenant-lifecycle.service';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    PassportModule,
    // Uses its own secret â€” completely separate from tenant JWT_SECRET
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('SUPER_ADMIN_JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
    }),
  ],
  controllers: [
    SuperAdminAuthController,
    TenantsController,
    SystemController,
  ],
  providers: [
    SuperAdminJwtStrategy,
    SuperAdminAuthService,
    SuperAdminGuard,
    TenantsService,
    TenantLifecycleService,
    LocalUploadService,
  ],
  exports: [SuperAdminGuard, LocalUploadService],
})
export class SuperAdminModule {}
