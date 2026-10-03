import {
  lastPoint,
  reverse,
  type ElevationProfile,
} from '../../../shared/domain/survey/elevation-profile.ts';
import { measure } from '../../../shared/domain/survey/measurements.ts';
import type { HillSession, UphillItinerary } from './itinerary.ts';
import type { SurveyedPath } from './surveyed-path.ts';
import { wallAbove } from './uphill-search.ts';

/**
 * A Hill Session on an Uphill Itinerary cut to the Repeat length, its Warm-up surveyed
 * from the starting point to the foot; measured over the whole session.
 */
export function toHillSession(
  repeat: UphillItinerary,
  warmUp: SurveyedPath,
  repeats: number,
): HillSession {
  const parts = [
    warmUp.profile,
    ...Array.from({ length: repeats }, () => [repeat.profile, reverse(repeat.profile)]).flat(),
    reverse(warmUp.profile),
  ];
  return {
    kind: 'session',
    repeats,
    repeat,
    warmUp: { path: warmUp.geometry, profile: warmUp.profile },
    measurements: measure(joined(parts)),
    exact: repeat.exact,
    differences: repeat.differences,
  };
}

/** Metres from the starting point to the foot of the Repeats. */
export const warmUpLength = (session: HillSession): number =>
  lastPoint(session.warmUp.profile).distance;

/**
 * Compares Repeats: exact first, then without a wall steeper than asked; ties are left
 * to the caller (nearest as the crow flies, or shortest Warm-up once routed).
 */
export const exactThenSteady =
  (maxGradient: number) =>
  (a: UphillItinerary, b: UphillItinerary): number =>
    Number(b.exact) - Number(a.exact) || wallAbove(a, maxGradient) - wallAbove(b, maxGradient);

/** Exact first, then without a wall steeper than asked, then the shortest Warm-up. */
export function rankHillSessions(
  sessions: readonly HillSession[],
  maxGradient: number,
): HillSession[] {
  const compare = exactThenSteady(maxGradient);
  return [...sessions].sort(
    (a, b) => compare(a.repeat, b.repeat) || warmUpLength(a) - warmUpLength(b),
  );
}

/**
 * Profiles travelled one after the other, as one profile. Each part begins where the
 * previous one ends: its first point is left out, so that two surveys of the same place
 * never count a rise or drop where no distance is travelled.
 */
function joined(parts: readonly ElevationProfile[]): ElevationProfile {
  let travelled = 0;
  return parts.flatMap((part, index) => {
    const shifted = part
      .slice(index === 0 ? 0 : 1)
      .map((point) => ({ ...point, distance: travelled + point.distance }));
    travelled += part.at(-1)?.distance ?? 0;
    return shifted;
  });
}
