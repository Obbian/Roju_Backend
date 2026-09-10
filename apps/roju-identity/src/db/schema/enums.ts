import { pgEnum } from 'drizzle-orm/pg-core';

// Kept for now (drives users.role) — see service_memberships for the multi-service-ready
// model. Narrowing users.role to admin-only meaning is a follow-up once a second app
// (FixIt) actually needs the CUSTOMER/PROVIDER split enforced here, not spec'd speculatively.
export const userRole = pgEnum('user_role', ['RIDER', 'DRIVER', 'ADMIN']);

export const accountStatus = pgEnum('account_status', [
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'BANNED',
  'DELETED',
]);
