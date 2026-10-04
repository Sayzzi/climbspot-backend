import type { Position } from './position.ts';

/**
 * What Ascent Times are found on, shared by the Ascents catalogue and the Strava
 * Connection: an Ascent's id, and its path from Start to Top.
 */
export interface AscentPath {
  readonly id: string;
  readonly path: readonly Position[];
}

/** A Visitor's best Ascent Time on an Ascent, in seconds, and how many they have there. */
export interface AscentTimeSummary {
  readonly best: number;
  readonly count: number;
}
