import type { userRole } from '../../db/schema/enums';

// Duplicated from roju-identity's own copy of this type on purpose — it's the shared JWT
// contract between two independent services/databases, not a live reference across a
// service boundary. Keep both in sync by hand until packages/common exists to hold it once.
export type UserRole = (typeof userRole.enumValues)[number];

export interface JwtPayload {
  sub: string;
  role: UserRole;
  phoneNumber: string;
}
