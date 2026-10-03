import type { Position } from '../../../shared/domain/position.ts';
import { distanceBetween, offset } from '../../../shared/domain/survey/geodesy.ts';
import { measure, type Measurements } from '../../../shared/domain/survey/measurements.ts';
import {
  HILLY_ABOVE,
  LENGTH_TOLERANCE,
  LOOP_HIGH_POINT_RISE,
  LOOP_HIGH_POINT_SPACING,
  LOOP_HIGH_POINTS,
  LOOP_WINDING_FACTOR,
  ROLLING_FROM,
  SAME_ITINERARY_DISTANCE,
} from './itinerary-rules.ts';
import type { LoopItinerary, LoopRequest, Relief } from './itinerary.ts';
import { cumulativeDistances, geometryBetween, type SurveyedPath } from './surveyed-path.ts';

/** First radius to try: a circle whose winding perimeter is the asked distance. */
export const initialLoopRadius = (distance: number) =>
  distance / (2 * Math.PI * LOOP_WINDING_FACTOR);

/**
 * Positions to route through for a Loop: from the start, three waypoints on a circle
 * whose centre lies `radius` away towards `bearing`, then back to the start.
 */
export function loopWaypoints(start: Position, bearing: number, radius: number): Position[] {
  return stretchedLoopWaypoints(start, bearing, 2 * radius, radius);
}

/**
 * Positions to route through for a Loop reaching `reach` metres towards `bearing`:
 * out on one side, `width` metres from the axis halfway, and back on the other.
 */
export function stretchedLoopWaypoints(
  start: Position,
  bearing: number,
  reach: number,
  width: number,
): Position[] {
  const halfway = offset(start, bearing, reach / 2);
  return [
    start,
    offset(halfway, bearing - 90, width),
    offset(start, bearing, reach),
    offset(halfway, bearing + 90, width),
    start,
  ];
}

/**
 * The highest points of surveyed paths within `reach` of the start, worth steering a
 * Loop to: well above the start, and apart from each other.
 */
export function highPoints(
  paths: readonly SurveyedPath[],
  start: Position,
  reach: number,
): Position[] {
  const base = paths[0]?.profile[0]?.elevation;
  if (base === undefined) {
    return [];
  }
  const candidates = paths
    .flatMap((path) => path.profile)
    .filter(
      (point) =>
        point.elevation >= base + LOOP_HIGH_POINT_RISE &&
        distanceBetween(start, point.position) <= reach,
    )
    .sort((a, b) => b.elevation - a.elevation);

  const chosen: Position[] = [];
  for (const { position } of candidates) {
    if (chosen.length === LOOP_HIGH_POINTS) {
      break;
    }
    if (chosen.every((other) => distanceBetween(other, position) >= LOOP_HIGH_POINT_SPACING)) {
      chosen.push(position);
    }
  }
  return chosen;
}

export const fitsLength = (length: number, asked: number) =>
  length >= asked && length <= asked * (1 + LENGTH_TOLERANCE);

/** Relief from Height Gained per kilometre (provisional bands). */
export function reliefOf(heightGainedPerKm: number): Relief {
  if (heightGainedPerKm < ROLLING_FROM) return 'flat';
  return heightGainedPerKm <= HILLY_ABOVE ? 'rolling' : 'hilly';
}

/** How far, in metres per kilometre, a Height Gained per kilometre is from a Relief's band. */
function distanceToBand(heightGainedPerKm: number, relief: Relief): number {
  switch (relief) {
    case 'flat':
      return Math.max(0, heightGainedPerKm - ROLLING_FROM);
    case 'rolling':
      return Math.max(0, ROLLING_FROM - heightGainedPerKm, heightGainedPerKm - HILLY_ABOVE);
    case 'hilly':
      return Math.max(0, HILLY_ABOVE - heightGainedPerKm);
  }
}

/** Height Gained per kilometre, what the Relief is judged on. */
const heightGainedPerKm = ({ heightGained, length }: Measurements) =>
  heightGained / (length / 1000);

export function toLoop(path: SurveyedPath, request: LoopRequest): LoopItinerary {
  const measurements = measure(path.profile);
  const relief = reliefOf(heightGainedPerKm(measurements));
  const exact = relief === request.relief;
  return {
    kind: 'loop',
    path: path.geometry,
    profile: path.profile,
    measurements,
    relief,
    exact,
    differences: exact ? [] : [{ kind: 'relief', wanted: request.relief, actual: relief }],
  };
}

/** Matching Relief first, then Height Gained closest to the asked band. */
export function rankLoops(loops: readonly LoopItinerary[], request: LoopRequest): LoopItinerary[] {
  const gap = (loop: LoopItinerary) =>
    distanceToBand(heightGainedPerKm(loop.measurements), request.relief);
  return [...loops].sort((a, b) => Number(b.exact) - Number(a.exact) || gap(a) - gap(b));
}

/** Two Loops are the same when they pass by the same places a third and two thirds of the way. */
export function isSameLoop(a: LoopItinerary, b: LoopItinerary): boolean {
  const marks = (loop: LoopItinerary) => {
    const surveyed = {
      profile: loop.profile,
      geometry: loop.path,
      distances: cumulativeDistances(loop.path),
    };
    const length = surveyed.distances.at(-1) ?? 0;
    return [length / 3, (2 * length) / 3].map((at) => geometryBetween(surveyed, at, at)[0]);
  };
  const [aMarks, bMarks] = [marks(a), marks(b)];
  return aMarks.every((mark, index) => {
    const other = bMarks[index];
    return (
      mark !== undefined &&
      other !== undefined &&
      distanceBetween(mark, other) < SAME_ITINERARY_DISTANCE
    );
  });
}
