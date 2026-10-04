import type { Position } from '../../../shared/domain/position.ts';
import type { RecordedRun, TrackPoint } from './recorded-run.ts';

export interface RecordedRunRepository {
  /** Keeps the Recorded Run, unless the Visitor already has it. */
  save(run: RecordedRun): Promise<void>;
  /** When the Visitor's latest Recorded Run started. */
  latestStart(visitorId: string): Promise<Date | undefined>;
  count(visitorId: string): Promise<number>;
  /** The tracks of the Visitor's Recorded Runs started since `since`. */
  tracksSince(visitorId: string, since: Date): Promise<(readonly TrackPoint[])[]>;
  deleteAllOf(visitorId: string): Promise<void>;
  /** Every Visitor's Recorded Runs whose track passes near `position`. */
  passingNear(position: Position): Promise<RecordedRun[]>;
}
