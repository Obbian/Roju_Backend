import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { DRIZZLE } from '../../db/db.module';
import { catalogVersions, rideCategories, rideCategoryCities, services } from '../../db/schema';

const DEFAULT_LOCALE = 'en-IN';

function resolveLocalizedText(value: unknown, locale: string): string {
  if (!value || typeof value !== 'object') return '';
  const dict = value as Record<string, string>;
  return dict[locale] ?? dict[DEFAULT_LOCALE] ?? Object.values(dict)[0] ?? '';
}

@Injectable()
export class CatalogService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listServices(locale: string) {
    const rows = await this.db
      .select()
      .from(services)
      .where(eq(services.isActive, true))
      .orderBy(asc(services.sortOrder));

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: resolveLocalizedText(row.displayName, locale),
      iconUrl: row.iconUrl,
      sortOrder: row.sortOrder,
    }));
  }

  async listCategoriesForServiceCity(serviceCode: string, city: string, locale: string) {
    const rows = await this.db
      .select({
        id: rideCategories.id,
        code: rideCategories.code,
        displayName: rideCategories.displayName,
        description: rideCategories.description,
        iconUrl: rideCategories.iconUrl,
        thumbnailUrl: rideCategories.thumbnailUrl,
        capacity: rideCategories.capacity,
        vehicleClass: rideCategories.vehicleClass,
        etaFactor: rideCategories.etaFactor,
        flags: rideCategories.flags,
        sortOrder: rideCategories.sortOrder,
      })
      .from(rideCategories)
      .innerJoin(services, eq(rideCategories.serviceId, services.id))
      .innerJoin(rideCategoryCities, eq(rideCategoryCities.rideCategoryId, rideCategories.id))
      .where(
        and(
          eq(services.code, serviceCode),
          eq(rideCategoryCities.city, city),
          eq(rideCategoryCities.isAvailable, true),
          eq(rideCategories.isActive, true),
        ),
      )
      .orderBy(asc(rideCategories.sortOrder));

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: resolveLocalizedText(row.displayName, locale),
      description: resolveLocalizedText(row.description, locale),
      iconUrl: row.iconUrl,
      thumbnailUrl: row.thumbnailUrl,
      capacity: row.capacity,
      vehicleClass: row.vehicleClass,
      etaFactor: row.etaFactor,
      flags: row.flags,
    }));
  }

  // Used by Rides at booking time — confirms the requested category actually exists and is
  // switched on for this city, and hands back the row (capacity/flags/etaFactor) so callers
  // don't need a second lookup.
  async findAvailableCategory(code: string, city: string) {
    const [row] = await this.db
      .select({
        id: rideCategories.id,
        code: rideCategories.code,
        capacity: rideCategories.capacity,
        vehicleClass: rideCategories.vehicleClass,
        etaFactor: rideCategories.etaFactor,
        flags: rideCategories.flags,
      })
      .from(rideCategories)
      .innerJoin(rideCategoryCities, eq(rideCategoryCities.rideCategoryId, rideCategories.id))
      .where(
        and(
          eq(rideCategories.code, code),
          eq(rideCategoryCities.city, city),
          eq(rideCategoryCities.isAvailable, true),
          eq(rideCategories.isActive, true),
        ),
      );

    return row ?? null;
  }

  async getVersion(scope: string) {
    const [row] = await this.db
      .select()
      .from(catalogVersions)
      .where(eq(catalogVersions.scope, scope));

    return row ?? { scope, version: 0, updatedAt: null };
  }
}
