import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { DRIZZLE } from '../../db/db.module';
import { drivers } from '../../db/schema';
import { LocationGeoCacheService } from '../location/location-geo-cache.service';

@Injectable()
export class DriversService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly geoCache: LocationGeoCacheService,
  ) {}

  async setStatus(driverId: string, status: 'ONLINE' | 'OFFLINE'): Promise<void> {
    const driver = await this.db.query.drivers.findFirst({
      where: eq(drivers.userId, driverId),
    });
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    if (status === 'ONLINE' && !driver.isComplianceVerified) {
      throw new ForbiddenException('Complete document verification before going online');
    }

    await this.db
      .update(drivers)
      .set({
        status,
        onlineSince: status === 'ONLINE' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(drivers.userId, driverId));

    if (status === 'OFFLINE') {
      await this.geoCache.remove(driver.vehicleType, driverId);
    }
  }
}
