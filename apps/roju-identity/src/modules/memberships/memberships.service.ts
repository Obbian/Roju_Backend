import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { DRIZZLE } from '../../db/db.module';
import { serviceMemberships } from '../../db/schema';

export type MembershipRole = 'CUSTOMER' | 'PROVIDER';

@Injectable()
export class MembershipsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  findOne(userId: string, serviceCode: string, membershipRole: MembershipRole) {
    return this.db.query.serviceMemberships.findFirst({
      where: and(
        eq(serviceMemberships.userId, userId),
        eq(serviceMemberships.serviceCode, serviceCode),
        eq(serviceMemberships.membershipRole, membershipRole),
      ),
    });
  }

  listForUser(userId: string) {
    return this.db.query.serviceMemberships.findMany({
      where: eq(serviceMemberships.userId, userId),
    });
  }

  // Called on every successful login — cheap no-op if the membership already exists.
  // A PROVIDER enrollment starts PENDING_VERIFICATION; a CUSTOMER one is usable immediately.
  async ensureMembership(userId: string, serviceCode: string, membershipRole: MembershipRole) {
    const existing = await this.findOne(userId, serviceCode, membershipRole);
    if (existing) return existing;

    const [created] = await this.db
      .insert(serviceMemberships)
      .values({
        userId,
        serviceCode,
        membershipRole,
        status: membershipRole === 'PROVIDER' ? 'PENDING_VERIFICATION' : 'ACTIVE',
      })
      .onConflictDoNothing({
        target: [
          serviceMemberships.userId,
          serviceMemberships.serviceCode,
          serviceMemberships.membershipRole,
        ],
      })
      .returning();

    return created ?? (await this.findOne(userId, serviceCode, membershipRole));
  }
}
