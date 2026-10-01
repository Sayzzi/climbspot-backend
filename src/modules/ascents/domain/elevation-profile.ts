import { distanceBetween } from './geodesy.ts';
import type { Position } from './position.ts';

/** One point of an Elevation Profile. */
export interface ProfilePoint {
  readonly position: Position;
  /** Distance from the first point along the path, in metres. */
  readonly distance: number;
  /** Elevation in metres. */
  readonly elevation: number;
}

export type ElevationProfile = readonly ProfilePoint[];

/** Pairs each position with its elevation and its distance along the path. */
export function buildProfile(
  positions: readonly Position[],
  elevations: readonly number[],
): ElevationProfile {
  let distance = 0;
  let previous: Position | undefined;

  return positions.map((position, index) => {
    const elevation = elevations[index];
    if (elevation === undefined) {
      throw new RangeError(`Missing elevation for position ${String(index)}.`);
    }
    if (previous !== undefined) {
      distance += distanceBetween(previous, position);
    }
    previous = position;
    return { position, distance, elevation };
  });
}

/** First point of a profile, where an Ascent starts. */
export function firstPoint(profile: ElevationProfile): ProfilePoint {
  const [first] = profile;
  if (first === undefined) {
    throw new RangeError('An Elevation Profile has at least one point.');
  }
  return first;
}

/** Last point of a profile, where an Ascent tops out. */
export function lastPoint(profile: ElevationProfile): ProfilePoint {
  const last = profile.at(-1);
  if (last === undefined) {
    throw new RangeError('An Elevation Profile has at least one point.');
  }
  return last;
}

/**
 * Centred moving average. Near both ends the window shrinks symmetrically, so the
 * first and last elevations are kept and a uniform slope stays exactly uniform.
 */
export function smooth(elevations: readonly number[], window: number): number[] {
  const halfWindow = Math.floor(window / 2);

  return elevations.map((_, index) => {
    const reach = Math.min(halfWindow, index, elevations.length - 1 - index);
    const neighbours = elevations.slice(index - reach, index + reach + 1);
    return neighbours.reduce((sum, elevation) => sum + elevation, 0) / neighbours.length;
  });
}

/** The same profile travelled the other way. */
export function reverse(profile: ElevationProfile): ElevationProfile {
  const length = profile.at(-1)?.distance ?? 0;
  return profile.toReversed().map((point) => ({ ...point, distance: length - point.distance }));
}
