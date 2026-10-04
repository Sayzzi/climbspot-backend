import type { AscentTime, AscentTimeSummary } from './ascent-time.ts';

export interface AscentTimeRepository {
  /** Keeps the Ascent Times, leaving out those already kept. */
  saveAll(times: readonly AscentTime[]): Promise<void>;
  /** The Visitor's best Ascent Time and count on each of these Ascents they went up. */
  summaries(
    visitorId: string,
    ascentIds: readonly string[],
  ): Promise<ReadonlyMap<string, AscentTimeSummary>>;
  /** The Visitor's Ascent Times on one Ascent, newest first. */
  of(visitorId: string, ascentId: string): Promise<AscentTime[]>;
  deleteAllOf(visitorId: string): Promise<void>;
}
