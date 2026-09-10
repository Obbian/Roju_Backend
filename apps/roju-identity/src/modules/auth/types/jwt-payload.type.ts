import type { userRole } from '../../../db/schema/enums';

export type UserRole = (typeof userRole.enumValues)[number];

export interface JwtPayload {
  sub: string;
  role: UserRole;
  phoneNumber: string;
}
