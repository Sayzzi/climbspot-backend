import type { Position } from '../../../shared/domain/position.ts';
import { distanceBetween, offset } from '../../../shared/domain/survey/geodesy.ts';
import { heightGained, measure } from '../../../shared/domain/survey/measurements.ts';
import {
  HILLY_ABOVE,
  LENGTH_TOLERANCE,
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
  const centre = offset(start, bearing, radius);
  const around = [-90, 0, 90].map((turn) => offset(centre, bearing + turn, radius));
  return [start, ...around, start];
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

export function toLoop(path: SurveyedPath, request: LoopRequest): LoopItinerary {
  const measurements = measure(path.profile);
  const gained = heightGained(path.profile);
  const relief = reliefOf(gained / (measurements.length / 1000));
  const exact = relief === request.relief;
  return {
    kind: 'loop',
    path: path.geometry,
    profile: path.profile,
    measurements,
    heightGained: gained,
    relief,
    exact,
    differences: exact ? [] : [{ kind: 'relief', wanted: request.relief, actual: relief }],
  };
}

/** Matching Relief first, then Height Gained closest to the asked band. */
export function rankLoops(loops: readonly LoopItinerary[], request: LoopRequest): LoopItinerary[] {
  const gap = (loop: LoopItinerary) =>
    distanceToBand(loop.heightGained / (loop.measurements.length / 1000), request.relief);
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
