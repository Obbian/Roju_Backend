import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { DRIZZLE } from '../../db/db.module';
import { users } from '../../db/schema';

export type PublicUser = Pick<
  typeof users.$inferSelect,
  | 'id'
  | 'phoneNumber'
  | 'firstName'
  | 'lastName'
  | 'profileImageUrl'
  | 'role'
  | 'rating'
  | 'isVerified'
>;

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  findByPhone(phoneNumber: string) {
    return this.db.query.users.findFirst({ where: eq(users.phoneNumber, phoneNumber) });
  }

  findById(id: string) {
    return this.db.query.users.findFirst({ where: eq(users.id, id) });
  }

  async createByPhone(phoneNumber: string, role: 'RIDER' | 'DRIVER', registeredVia: string) {
    const [user] = await this.db
      .insert(users)
      .values({ phoneNumber, role, registeredVia })
      .returning();
    return user;
  }

  async markLoggedIn(userId: string) {
    await this.db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  }

  toPublicUser(user: typeof users.$inferSelect): PublicUser {
    return {
      id: user.id,
      phoneNumber: user.phoneNumber,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      role: user.role,
      rating: user.rating,
      isVerified: user.isVerified,
    };
  }
}
