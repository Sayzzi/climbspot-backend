import { and, count, desc, eq, inArray, max, min, sql, type SQL } from 'drizzle-orm';

import type { Database } from '../../../../shared/infrastructure/database.ts';
import type { AscentTimeSummary } from '../../../../shared/domain/ascent-times.ts';
import type { AscentTime } from '../../domain/ascent-time.ts';
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
    return this.summarised(
      and(eq(ascentTimes.visitorId, visitorId), inArray(ascentTimes.ascentId, [...ascentIds])),
    );
  }

  withTimesOf(visitorId: string): Promise<ReadonlyMap<string, AscentTimeSummary>> {
    return this.summarised(eq(ascentTimes.visitorId, visitorId));
  }

  /** Sums up the Ascent Times matching `where` per Ascent, the latest run first. */
  private async summarised(
    where: SQL | undefined,
  ): Promise<ReadonlyMap<string, AscentTimeSummary>> {
    const latestStartedAt = max(ascentTimes.startedAt);
    const rows = await this.db
      .select({
        ascentId: ascentTimes.ascentId,
        best: min(ascentTimes.seconds),
        count: count(),
        latestStartedAt,
        // Two Recorded Runs of the same outing (watch and phone) can start together.
        latestSeconds: sql<number>`(array_agg(${ascentTimes.seconds} order by ${ascentTimes.startedAt} desc, ${ascentTimes.stravaId} desc))[1]`,
      })
      .from(ascentTimes)
      .where(where)
      .groupBy(ascentTimes.ascentId)
      .orderBy(desc(latestStartedAt), ascentTimes.ascentId);
    return new Map(
      rows.map((row) => [
        row.ascentId,
        {
          best: row.best ?? 0,
          count: row.count,
          latest: { startedAt: row.latestStartedAt ?? new Date(0), seconds: row.latestSeconds },
        },
      ]),
    );
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
