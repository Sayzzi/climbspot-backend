import { reverse, type ElevationProfile } from '../../../shared/domain/survey/elevation-profile.ts';
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

/** Exact first, then without a wall steeper than asked, then the shortest Warm-up. */
export function rankHillSessions(
  sessions: readonly HillSession[],
  maxGradient: number,
): HillSession[] {
  const warmUpLength = (session: HillSession) => session.warmUp.profile.at(-1)?.distance ?? 0;
  return [...sessions].sort(
    (a, b) =>
      Number(b.exact) - Number(a.exact) ||
      wallAbove(a.repeat, maxGradient) - wallAbove(b.repeat, maxGradient) ||
      warmUpLength(a) - warmUpLength(b),
  );
}

/** Profiles travelled one after the other, as one profile. */
function joined(parts: readonly ElevationProfile[]): ElevationProfile {
  let travelled = 0;
  return parts.flatMap((part) => {
    const shifted = part.map((point) => ({ ...point, distance: travelled + point.distance }));
    travelled += part.at(-1)?.distance ?? 0;
    return shifted;
  });
}
