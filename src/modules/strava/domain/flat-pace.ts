import type { TrackPoint } from './recorded-run.ts';
import { FLAT_GRADIENT_LIMIT, FLAT_STRETCH_LENGTH, MINIMUM_FLAT_DISTANCE } from './strava-rules.ts';

interface FlatStretch {
  readonly length: number;
  /** Seconds per kilometre, moving. */
  readonly pace: number;
}

/**
 * A runner's Flat Pace from their Recorded Runs: the median pace, moving, over the
 * stretches of about {@link FLAT_STRETCH_LENGTH} metres whose Gradient stays within
 * {@link FLAT_GRADIENT_LIMIT}, using the recorded altitude. None with fewer than
 * {@link MINIMUM_FLAT_DISTANCE} metres of such stretches: no guess.
 */
export function flatPaceFrom(tracks: readonly (readonly TrackPoint[])[]): number | undefined {
  const stretches = tracks.flatMap(flatStretches);
  const flatDistance = stretches.reduce((total, stretch) => total + stretch.length, 0);
  if (flatDistance < MINIMUM_FLAT_DISTANCE) {
    return undefined;
  }
  return Math.round(median(stretches.map((stretch) => stretch.pace)));
}

/** The track cut into consecutive stretches of about 100 m, keeping the flat ones. */
function flatStretches(track: readonly TrackPoint[]): FlatStretch[] {
  const stretches: FlatStretch[] = [];
  let start = track[0];
  for (const point of track.slice(1)) {
    if (!start || point.distance - start.distance < FLAT_STRETCH_LENGTH) {
      continue;
    }
    const length = point.distance - start.distance;
    const moving = point.moving - start.moving;
    const rise =
      point.altitude === null || start.altitude === null
        ? undefined
        : point.altitude - start.altitude;
    if (rise !== undefined && Math.abs(rise / length) <= FLAT_GRADIENT_LIMIT && moving > 0) {
      stretches.push({ length, pace: moving / (length / 1000) });
    }
    start = point;
  }
  return stretches;
}

function median(values: readonly number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}
