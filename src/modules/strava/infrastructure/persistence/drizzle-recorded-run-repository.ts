import { and, count, eq, gte, lte, max } from 'drizzle-orm';

import type { Position } from '../../../../shared/domain/position.ts';
import type { Database } from '../../../../shared/infrastructure/database.ts';
import { boundsOf, type RecordedRun, type TrackPoint } from '../../domain/recorded-run.ts';
import type { RecordedRunRepository } from '../../domain/recorded-run-repository.ts';
import { recordedRuns } from './strava.schema.ts';

export class DrizzleRecordedRunRepository implements RecordedRunRepository {
  constructor(private readonly db: Database) {}

  async save(run: RecordedRun): Promise<void> {
    const bounds = boundsOf(run.track);
    await this.db
      .insert(recordedRuns)
      .values({ ...run, ...bounds })
      .onConflictDoNothing();
  }

  async latestStart(visitorId: string): Promise<Date | undefined> {
    const [row] = await this.db
      .select({ latest: max(recordedRuns.startedAt) })
      .from(recordedRuns)
      .where(eq(recordedRuns.visitorId, visitorId));
    return row?.latest ?? undefined;
  }

  async count(visitorId: string): Promise<number> {
    const [row] = await this.db
      .select({ runs: count() })
      .from(recordedRuns)
      .where(eq(recordedRuns.visitorId, visitorId));
    return row?.runs ?? 0;
  }

  async tracksSince(visitorId: string, since: Date): Promise<(readonly TrackPoint[])[]> {
    const rows = await this.db
      .select({ track: recordedRuns.track })
      .from(recordedRuns)
      .where(and(eq(recordedRuns.visitorId, visitorId), gte(recordedRuns.startedAt, since)));
    return rows.map((row) => row.track);
  }

  async passingNear({ latitude, longitude }: Position): Promise<RecordedRun[]> {
    const rows = await this.db
      .select()
      .from(recordedRuns)
      .where(
        and(
          lte(recordedRuns.south, latitude),
          gte(recordedRuns.north, latitude),
          lte(recordedRuns.west, longitude),
          gte(recordedRuns.east, longitude),
        ),
      );
    return rows.map((row) => ({
      visitorId: row.visitorId,
      stravaId: row.stravaId,
      startedAt: row.startedAt,
      distance: row.distance,
      movingTime: row.movingTime,
      track: row.track,
    }));
  }

  async deleteAllOf(visitorId: string): Promise<void> {
    await this.db.delete(recordedRuns).where(eq(recordedRuns.visitorId, visitorId));
  }
}
