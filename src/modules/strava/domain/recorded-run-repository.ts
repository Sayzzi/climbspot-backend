import type { RecordedRun } from './recorded-run.ts';

export interface RecordedRunRepository {
  /** Keeps the Recorded Run, unless the Visitor already has it. */
  save(run: RecordedRun): Promise<void>;
  /** When the Visitor's latest Recorded Run started. */
  latestStart(visitorId: string): Promise<Date | undefined>;
  count(visitorId: string): Promise<number>;
  deleteAllOf(visitorId: string): Promise<void>;
}
