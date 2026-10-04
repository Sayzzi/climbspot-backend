import type { AscentPath, AscentTimeSummary } from '../../../shared/domain/ascent-times.ts';

export type { AscentTimeSummary } from '../../../shared/domain/ascent-times.ts';

/** One of a Visitor's Ascent Times: when they left the Start, and how long they took. */
export interface PersonalAscentTime {
  readonly startedAt: Date;
  readonly seconds: number;
}

/**
 * Each Visitor's own Ascent Times, found in their Recorded Runs by another part of
 * ClimbSpot; never shown to anyone else.
 */
export interface PersonalAscentTimes {
  summaries(
    visitorId: string,
    ascentIds: readonly string[],
  ): Promise<ReadonlyMap<string, AscentTimeSummary>>;
  /** Newest first. */
  of(visitorId: string, ascentId: string): Promise<PersonalAscentTime[]>;
}

/** Nobody has any Ascent Time. */
export const noAscentTimes: PersonalAscentTimes = {
  summaries: () => Promise.resolve(new Map()),
  of: () => Promise.resolve([]),
};

/** Told of every Ascent added to the catalogue, e.g. to find its Ascent Times. */
export type AscentAddedListener = (ascent: AscentPath) => Promise<void>;
