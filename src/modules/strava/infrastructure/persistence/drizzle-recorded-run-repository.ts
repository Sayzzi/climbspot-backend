import { count, eq, max } from 'drizzle-orm';

import type { Database } from '../../../../shared/infrastructure/database.ts';
import type { RecordedRun } from '../../domain/recorded-run.ts';
import type { RecordedRunRepository } from '../../domain/recorded-run-repository.ts';
import { recordedRuns } from './strava.schema.ts';

export class DrizzleRecordedRunRepository implements RecordedRunRepository {
  constructor(private readonly db: Database) {}

  async save(run: RecordedRun): Promise<void> {
    await this.db.insert(recordedRuns).values(run).onConflictDoNothing();
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

  async deleteAllOf(visitorId: string): Promise<void> {
    await this.db.delete(recordedRuns).where(eq(recordedRuns.visitorId, visitorId));
  }
}
