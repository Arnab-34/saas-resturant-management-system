import {
  ForbiddenException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SuperAdminAuthService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** On first boot: if no super admin exists, create one from env vars and
   *  print the generated password to stdout exactly once. */
  async onModuleInit() {
    if (process.env.SAAS_MODE !== 'true') return;

    const existing = await this.prisma.superAdmin.count();
    if (existing > 0) return;

    const email = process.env.SUPER_ADMIN_EMAIL;
    if (!email) {
      console.warn(
        '[SuperAdmin] SAAS_MODE=true but SUPER_ADMIN_EMAIL is not set — skipping seed.',
      );
      return;
    }

    const password = randomBytes(12).toString('hex'); // 24-char hex
    const passwordHash = await bcrypt.hash(password, 12);

    await this.prisma.superAdmin.create({
      data: { email, name: 'Platform Admin', passwordHash },
    });

    console.log('\n============================================================');
    console.log('  Super Admin account created:');
    console.log(`  Email   : ${email}`);
    console.log(`  Password: ${password}`);
    console.log('  Change this password immediately after first login!');
    console.log('============================================================\n');
  }

  async login(email: string, password: string) {
    const admin = await this.prisma.superAdmin.findUnique({ where: { email } });
    if (!admin) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const token = this.jwt.sign(
      { sub: admin.id, type: 'super-admin' },
      { expiresIn: '24h' },
    );
    return { token, admin: { id: admin.id, email: admin.email, name: admin.name } };
  }

  async getProfile(id: string) {
    const admin = await this.prisma.superAdmin.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, createdAt: true, updatedAt: true },
    });
    if (!admin) throw new ForbiddenException('Super admin not found');
    return admin;
  }
}
