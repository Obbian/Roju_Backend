import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { schema } from './client';
import { rideCategories, rideCategoryCities, services } from './schema';

const CITY = 'Hyderabad';

const CATEGORIES = [
  {
    code: 'AUTO',
    displayName: { 'en-IN': 'Auto' },
    vehicleClass: 'AUTO',
    capacity: 3,
    sortOrder: 0,
  },
  {
    code: 'BIKE',
    displayName: { 'en-IN': 'Bike' },
    vehicleClass: 'BIKE',
    capacity: 1,
    sortOrder: 1,
  },
  { code: 'CABX', displayName: { 'en-IN': 'Cab' }, vehicleClass: 'CAB', capacity: 4, sortOrder: 2 },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL must be set to run the seed script');
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  await db
    .insert(services)
    .values({ code: 'RIDE', displayName: { 'en-IN': 'Ride' }, sortOrder: 0 })
    .onConflictDoNothing({ target: services.code });

  const rideService = await db.query.services.findFirst({ where: eq(services.code, 'RIDE') });
  if (!rideService) {
    throw new Error('Failed to seed/find the RIDE service');
  }

  for (const category of CATEGORIES) {
    await db
      .insert(rideCategories)
      .values({ serviceId: rideService.id, ...category })
      .onConflictDoNothing({ target: rideCategories.code });

    const row = await db.query.rideCategories.findFirst({
      where: eq(rideCategories.code, category.code),
    });
    if (!row) {
      throw new Error(`Failed to seed/find ride category ${category.code}`);
    }

    await db
      .insert(rideCategoryCities)
      .values({ rideCategoryId: row.id, city: CITY })
      .onConflictDoNothing({
        target: [rideCategoryCities.rideCategoryId, rideCategoryCities.city],
      });
  }

  await pool.end();

  // eslint-disable-next-line no-console
  console.log(`Seeded catalog: ${CATEGORIES.length} ride categories in ${CITY}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  process.exit(1);
});
