import type { Position } from '../../../shared/domain/position.ts';
import { reverse, type ElevationProfile } from '../../../shared/domain/survey/elevation-profile.ts';
import { distanceBetween } from '../../../shared/domain/survey/geodesy.ts';
import { dipAllowance, measure } from '../../../shared/domain/survey/measurements.ts';
import { LENGTH_TOLERANCE, SAME_ITINERARY_DISTANCE } from './itinerary-rules.ts';
import type { UphillItinerary, UphillRequest } from './itinerary.ts';
import { geometryBetween, type SurveyedPath } from './surveyed-path.ts';

interface Stretch {
  /** Indices into the profile travelled in `direction`. */
  readonly first: number;
  readonly last: number;
  readonly reversed: boolean;
  readonly gradient: number;
  /** Height lost in Dips along the stretch, in metres. */
  readonly loss: number;
  /** How far the local Gradients stray from the asked range, weighted by length. */
  readonly unevenness: number;
  readonly length: number;
  readonly distanceToStart: number;
}

/** Lengths a stretch may have, in metres. */
export interface StretchLengths {
  readonly shortest: number;
  readonly longest: number;
}

/** An Uphill Itinerary's lengths: never shorter than asked, at most 20 % longer. */
export const uphillLengths = (length: number): StretchLengths => ({
  shortest: length,
  longest: length * (1 + LENGTH_TOLERANCE),
});

/**
 * The best stretch of a surveyed path going up as asked: length within `lengths`
 * (by default 100–120 % of the request), start within the radius, passing the Dip rule,
 * in either direction.
 */
export function bestUphillStretch(
  path: SurveyedPath,
  request: UphillRequest,
  lengths: StretchLengths = uphillLengths(request.length),
): UphillItinerary | undefined {
  let best: Stretch | undefined;

  for (const reversed of [false, true]) {
    const profile = reversed ? reverse(path.profile) : path.profile;
    const lost = cumulativeLoss(profile);
    const strayed = cumulativeUnevenness(profile, request);

    for (const [first, from] of profile.entries()) {
      const distanceToStart = distanceBetween(request.start, from.position);
      if (distanceToStart > request.radius) {
        continue;
      }
      for (let last = first + 1; last < profile.length; last += 1) {
        const to = profile[last];
        if (to === undefined) break;
        const length = to.distance - from.distance;
        if (length > lengths.longest) break;
        if (length < lengths.shortest) continue;

        const gain = to.elevation - from.elevation;
        const loss = (lost[last] ?? 0) - (lost[first] ?? 0);
        if (gain <= 0 || loss > dipAllowance(gain)) continue;

        const unevenness = (strayed[last] ?? 0) - (strayed[first] ?? 0);
        const gradient = gain / length;
        const stretch = {
          first,
          last,
          reversed,
          gradient,
          loss,
          unevenness,
          length,
          distanceToStart,
        };
        if (best === undefined || compare(stretch, best, request) < 0) {
          best = stretch;
        }
      }
    }
  }

  return best && toItinerary(path, best, request);
}

/**
 * Exact first, then without walls steeper than asked (maximum Gradient above the range,
 * in whole percents), then closest to the middle of the Gradient range, then nearest.
 */
export function rankUphill(
  itineraries: readonly UphillItinerary[],
  request: UphillRequest,
): UphillItinerary[] {
  const middle = (request.minGradient + request.maxGradient) / 2;
  const wall = (itinerary: UphillItinerary) =>
    Math.round(Math.max(0, itinerary.measurements.maximumGradient - request.maxGradient) * 100);
  return [...itineraries].sort(
    (a, b) =>
      Number(b.exact) - Number(a.exact) ||
      wall(a) - wall(b) ||
      Math.abs(a.measurements.averageGradient - middle) -
        Math.abs(b.measurements.averageGradient - middle) ||
      a.distanceToStart - b.distanceToStart,
  );
}

/** Whether two Itineraries start and end at about the same places. */
export function isSameItinerary(a: UphillItinerary, b: UphillItinerary): boolean {
  const ends = (itinerary: UphillItinerary): [Position, Position] => {
    const first = itinerary.path[0];
    const last = itinerary.path.at(-1);
    if (first === undefined || last === undefined) {
      throw new RangeError('An Itinerary has a path.');
    }
    return [first, last];
  };
  const [aStart, aEnd] = ends(a);
  const [bStart, bEnd] = ends(b);
  return (
    distanceBetween(aStart, bStart) < SAME_ITINERARY_DISTANCE &&
    distanceBetween(aEnd, bEnd) < SAME_ITINERARY_DISTANCE
  );
}

/**
 * Within one path: exact first, then the stretch going up most steadily (least height
 * lost, then local Gradients closest to the asked range), then the one starting
 * nearest, then the one closest to the asked length. Closeness to the middle of the
 * range only ranks proposals across paths.
 */
function compare(a: Stretch, b: Stretch, request: UphillRequest): number {
  return (
    Number(isExact(b.gradient, request)) - Number(isExact(a.gradient, request)) ||
    a.loss - b.loss ||
    a.unevenness - b.unevenness ||
    a.distanceToStart - b.distanceToStart ||
    Math.abs(a.length - request.length) - Math.abs(b.length - request.length)
  );
}

const isExact = (gradient: number, { minGradient, maxGradient }: UphillRequest) =>
  gradient >= minGradient && gradient <= maxGradient;

/** Height lost in Dips from the first sample to each sample. */
function cumulativeLoss(profile: ElevationProfile): number[] {
  let lost = 0;
  return profile.map((point, index) => {
    const previous = profile[index - 1];
    if (previous !== undefined) {
      lost += Math.max(0, previous.elevation - point.elevation);
    }
    return lost;
  });
}

/** From the first sample to each sample: Σ (how far each sample-to-sample Gradient is outside the range × its length). */
function cumulativeUnevenness(
  profile: ElevationProfile,
  { minGradient, maxGradient }: UphillRequest,
): number[] {
  let total = 0;
  return profile.map((point, index) => {
    const previous = profile[index - 1];
    if (previous !== undefined) {
      const length = point.distance - previous.distance;
      const gradient = length > 0 ? (point.elevation - previous.elevation) / length : 0;
      const outside = Math.max(0, minGradient - gradient, gradient - maxGradient);
      total += outside * length;
    }
    return total;
  });
}

function toItinerary(
  path: SurveyedPath,
  stretch: Stretch,
  request: UphillRequest,
): UphillItinerary {
  const profile = stretch.reversed ? reverse(path.profile) : path.profile;
  const samples = profile.slice(stretch.first, stretch.last + 1);
  const from = samples[0]?.distance ?? 0;
  const rebased = samples.map((sample) => ({ ...sample, distance: sample.distance - from }));

  const total = path.profile.at(-1)?.distance ?? 0;
  const to = samples.at(-1)?.distance ?? from;
  const geometry = stretch.reversed
    ? geometryBetween(path, total - to, total - from).toReversed()
    : geometryBetween(path, from, to);

  const exact = isExact(stretch.gradient, request);
  return {
    kind: 'uphill',
    path: geometry,
    profile: rebased,
    measurements: measure(rebased),
    distanceToStart: stretch.distanceToStart,
    exact,
    differences: exact
      ? []
      : [
          {
            kind: 'gradient',
            min: request.minGradient,
            max: request.maxGradient,
            actual: stretch.gradient,
          },
        ],
  };
}
