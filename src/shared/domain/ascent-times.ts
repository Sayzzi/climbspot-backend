import type { Position } from './position.ts';

/**
 * What Ascent Times are found on, shared by the Ascents catalogue and the Strava
 * Connection: an Ascent's id, and its path from Start to Top.
 */
export interface AscentPath {
  readonly id: string;
  readonly path: readonly Position[];
}

/**
 * A Visitor's Ascent Times on an Ascent, summed up: their best (seconds), how many they
 * have there, and their latest (when they left the Start, and how long they took).
 */
export interface AscentTimeSummary {
  readonly best: number;
  readonly count: number;
  readonly latest: { readonly startedAt: Date; readonly seconds: number };
}
