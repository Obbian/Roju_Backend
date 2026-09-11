import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { DRIZZLE } from '../../db/db.module';
import { users } from '../../db/schema';

export type PublicUser = Pick<
  typeof users.$inferSelect,
  | 'id'
  | 'phoneNumber'
  | 'email'
  | 'firstName'
  | 'lastName'
  | 'profileImageUrl'
  | 'role'
  | 'rating'
  | 'isVerified'
  | 'preferredLanguage'
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

  async createByPhone(
    phoneNumber: string,
    role: 'RIDER' | 'DRIVER',
    registeredVia: string,
    preferredLanguage?: string,
  ) {
    const [user] = await this.db
      .insert(users)
      .values({ phoneNumber, role, registeredVia, preferredLanguage })
      .returning();
    return user;
  }

  async markLoggedIn(userId: string) {
    await this.db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  }

  // Onboarding's language picker only ever runs before an account exists, so an existing
  // user re-sending it (e.g. picking a different language on a new device) is the only case
  // that lands here — harmless to just overwrite.
  async setPreferredLanguage(userId: string, preferredLanguage: string) {
    await this.db.update(users).set({ preferredLanguage }).where(eq(users.id, userId));
  }

  async updateProfile(
    userId: string,
    fields: Partial<Pick<typeof users.$inferSelect, 'firstName' | 'lastName' | 'email' | 'profileImageUrl'>>,
  ) {
    const [user] = await this.db.update(users).set(fields).where(eq(users.id, userId)).returning();
    return user;
  }

  toPublicUser(user: typeof users.$inferSelect): PublicUser {
    return {
      id: user.id,
      phoneNumber: user.phoneNumber,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      role: user.role,
      rating: user.rating,
      isVerified: user.isVerified,
      preferredLanguage: user.preferredLanguage,
    };
  }
}
