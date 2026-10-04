import { and, count, desc, eq, inArray, min } from 'drizzle-orm';

import type { Database } from '../../../../shared/infrastructure/database.ts';
import type { AscentTime, AscentTimeSummary } from '../../domain/ascent-time.ts';
import type { AscentTimeRepository } from '../../domain/ascent-time-repository.ts';
import { ascentTimes } from './strava.schema.ts';

export class DrizzleAscentTimeRepository implements AscentTimeRepository {
  constructor(private readonly db: Database) {}

  async saveAll(times: readonly AscentTime[]): Promise<void> {
    if (times.length > 0) {
      await this.db
        .insert(ascentTimes)
        .values([...times])
        .onConflictDoNothing();
    }
  }

  async summaries(
    visitorId: string,
    ascentIds: readonly string[],
  ): Promise<ReadonlyMap<string, AscentTimeSummary>> {
    if (ascentIds.length === 0) {
      return new Map();
    }
    const rows = await this.db
      .select({ ascentId: ascentTimes.ascentId, best: min(ascentTimes.seconds), count: count() })
      .from(ascentTimes)
      .where(
        and(eq(ascentTimes.visitorId, visitorId), inArray(ascentTimes.ascentId, [...ascentIds])),
      )
      .groupBy(ascentTimes.ascentId);
    return new Map(rows.map((row) => [row.ascentId, { best: row.best ?? 0, count: row.count }]));
  }

  of(visitorId: string, ascentId: string): Promise<AscentTime[]> {
    return this.db
      .select()
      .from(ascentTimes)
      .where(and(eq(ascentTimes.visitorId, visitorId), eq(ascentTimes.ascentId, ascentId)))
      .orderBy(desc(ascentTimes.startedAt));
  }

  async deleteAllOf(visitorId: string): Promise<void> {
    await this.db.delete(ascentTimes).where(eq(ascentTimes.visitorId, visitorId));
  }
}
