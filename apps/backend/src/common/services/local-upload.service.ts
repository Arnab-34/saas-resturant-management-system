import { Injectable, Logger } from '@nestjs/common';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { uploadsDir } from '../upload/image-upload.config';

/**
 * LocalUploadService — tenant-namespaced local-disk file storage.
 *
 * All uploads land under:
 *   {UPLOADS_DIR}/{restaurantId}/{filename}
 *
 * The parent `UPLOADS_DIR` is already a Docker bind-mount / named volume
 * (see docker-compose.yml and image-upload.config.ts), so files survive
 * container rebuilds. Nothing changes for existing code that calls multer
 * directly — this service is used only by the SaaS provisioning/purge layer.
 *
 * Served as static assets at /api/uploads/{restaurantId}/... by main.ts.
 */
@Injectable()
export class LocalUploadService {
  private readonly logger = new Logger(LocalUploadService.name);

  /** Ensure per-tenant upload directory exists. Called during tenant provisioning. */
  ensureTenantDir(restaurantId: string): string {
    const dir = join(uploadsDir(), restaurantId);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  /**
   * Delete every file under `{UPLOADS_DIR}/{restaurantId}/`.
   * Called during the 30-day grace-period hard purge.
   */
  deletePrefix(restaurantId: string): void {
    const dir = join(uploadsDir(), restaurantId);
    if (!existsSync(dir)) return;
    try {
      rmSync(dir, { recursive: true, force: true });
      this.logger.log(`Deleted local upload directory for tenant "${restaurantId}"`);
    } catch (err) {
      this.logger.error(`Failed to delete upload dir for tenant ${restaurantId}:`, err);
    }
  }
}
