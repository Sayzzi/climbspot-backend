import { and, eq, inArray } from 'drizzle-orm';

import type { Database } from '../../../../shared/infrastructure/database.ts';
import type { FavouriteAscents } from '../../domain/favourite-ascents.ts';
import { favouriteAscents } from './ascents.schema.ts';

export class DrizzleFavouriteAscents implements FavouriteAscents {
  constructor(private readonly db: Database) {}

  async mark(visitorId: string, ascentId: string, at: Date): Promise<void> {
    await this.db
      .insert(favouriteAscents)
      .values({ visitorId, ascentId, markedAt: at })
      .onConflictDoNothing();
  }

  async unmark(visitorId: string, ascentId: string): Promise<void> {
    await this.db
      .delete(favouriteAscents)
      .where(
        and(eq(favouriteAscents.visitorId, visitorId), eq(favouriteAscents.ascentId, ascentId)),
      );
  }

  async among(visitorId: string, ascentIds: readonly string[]): Promise<ReadonlySet<string>> {
    if (ascentIds.length === 0) {
      return new Set();
    }
    const rows = await this.db
      .select({ ascentId: favouriteAscents.ascentId })
      .from(favouriteAscents)
      .where(
        and(
          eq(favouriteAscents.visitorId, visitorId),
          inArray(favouriteAscents.ascentId, [...ascentIds]),
        ),
      );
    return new Set(rows.map((row) => row.ascentId));
  }

  /** Forgets every favourite of a Visitor, e.g. when their account is deleted. */
  async forget(visitorId: string): Promise<void> {
    await this.db.delete(favouriteAscents).where(eq(favouriteAscents.visitorId, visitorId));
  }
}
