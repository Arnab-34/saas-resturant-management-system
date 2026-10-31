import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { SuperAdmin } from '../guards/super-admin.guard';
import { CurrentSuperAdmin } from '../decorators/current-super-admin.decorator';
import type { SuperAdminSession } from '../auth/super-admin-jwt.strategy';
import {
  CreateTenantDto,
  SetTenantStatusDto,
  UpdateTenantDto,
} from '../dto/tenant.dto';
import { TenantsService } from './tenants.service';

@SuperAdmin()
@Controller('v1/super-admin/tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('stats')
  getStats() {
    return this.tenantsService.getStats();
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.tenantsService.findAll(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      status,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Post()
  create(
    @Body() dto: CreateTenantDto,
    @CurrentSuperAdmin() admin: SuperAdminSession,
  ) {
    return this.tenantsService.create(dto, admin.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
    @CurrentSuperAdmin() admin: SuperAdminSession,
  ) {
    return this.tenantsService.update(id, dto, admin.id);
  }

  @Post(':id/status')
  setStatus(
    @Param('id') id: string,
    @Body() dto: SetTenantStatusDto,
    @CurrentSuperAdmin() admin: SuperAdminSession,
  ) {
    return this.tenantsService.setStatus(id, dto, admin.id);
  }

  @Post(':id/impersonate')
  impersonate(
    @Param('id') id: string,
    @CurrentSuperAdmin() admin: SuperAdminSession,
  ) {
    return this.tenantsService.impersonate(id, admin.id);
  }

  @Get(':id/export')
  exportData(@Param('id') id: string) {
    return this.tenantsService.exportData(id);
  }
}
