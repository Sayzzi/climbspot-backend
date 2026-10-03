import type { Activity } from '../src/shared/domain/activity.ts';
import type { Position } from '../src/shared/domain/position.ts';
import { distanceBetween } from '../src/shared/domain/survey/geodesy.ts';
import type {
  RoutedPath,
  RoutingProvider,
} from '../src/modules/itineraries/domain/routing-provider.ts';
import { METRES_PER_DEGREE_OF_LATITUDE } from './terrain.ts';

/** A position `metres` away from `from` towards `bearing` (degrees, 0 = north, 90 = east). */
export function offset(from: Position, bearing: number, metres: number): Position {
  const radians = (bearing * Math.PI) / 180;
  const metresPerDegreeOfLongitude =
    METRES_PER_DEGREE_OF_LATITUDE * Math.cos((from.latitude * Math.PI) / 180);
  return {
    latitude: from.latitude + (metres * Math.cos(radians)) / METRES_PER_DEGREE_OF_LATITUDE,
    longitude: from.longitude + (metres * Math.sin(radians)) / metresPerDegreeOfLongitude,
  };
}

/** Straight legs from `start`, each `[bearing, metres]`, as positions every 10 m. */
export function legs(
  start: Position,
  ...steps: readonly (readonly [number, number])[]
): Position[] {
  const positions: Position[] = [start];
  let here = start;
  for (const [bearing, metres] of steps) {
    for (let travelled = 10; travelled <= metres + 1e-6; travelled += 10) {
      positions.push(offset(here, bearing, travelled));
    }
    here = offset(here, bearing, metres);
  }
  return positions;
}

/** Goes `length / 2` towards `bearing`, then comes back the same way. */
export function outAndBack(start: Position, bearing: number, length: number): Position[] {
  return legs(start, [bearing, length / 2], [(bearing + 180) % 360, length / 2]);
}

export interface RoundTripRequest {
  readonly start: Position;
  readonly length: number;
  readonly activity: Activity;
  readonly variant: number;
}

export interface RouteThroughRequest {
  readonly positions: readonly Position[];
  readonly activity: Activity;
}

export interface FakeRoutingOptions {
  /** Elevation of the fake terrain at a position, in metres. */
  readonly elevationAt: (position: Position) => number;
  /** Geometry of a round trip, or undefined when no way is found. */
  readonly roundTrip?: (request: RoundTripRequest) => Position[] | undefined;
  /** Geometry through positions, or undefined when no way is found. Defaults to straight lines. */
  readonly routeThrough?: (request: RouteThroughRequest) => Position[] | undefined;
  /** Makes every call fail like an unreachable routing service. */
  readonly failWith?: Error;
}

/** A RoutingProvider over a fake terrain, recording every call. */
export function fakeRouting(options: FakeRoutingOptions) {
  const calls = { roundTrip: [] as RoundTripRequest[], routeThrough: [] as RouteThroughRequest[] };

  const toRoutedPath = (positions: Position[] | undefined): RoutedPath | undefined =>
    positions && {
      points: positions.map((position) => ({ position, elevation: options.elevationAt(position) })),
    };

  const provider: RoutingProvider = {
    roundTrip: (start, length, activity, variant) => {
      calls.roundTrip.push({ start, length, activity, variant });
      if (options.failWith) {
        return Promise.reject(options.failWith);
      }
      return Promise.resolve(
        toRoutedPath(options.roundTrip?.({ start, length, activity, variant })),
      );
    },
    routeThrough: (positions, activity) => {
      calls.routeThrough.push({ positions, activity });
      if (options.failWith) {
        return Promise.reject(options.failWith);
      }
      const geometry = options.routeThrough
        ? options.routeThrough({ positions, activity })
        : positions.flatMap((position, index) => {
            const next = positions[index + 1];
            if (next === undefined) {
              return [position];
            }
            const steps = Math.max(1, Math.round(distanceBetween(position, next) / 10));
            return Array.from({ length: steps }, (_, step) => ({
              latitude: position.latitude + ((next.latitude - position.latitude) * step) / steps,
              longitude:
                position.longitude + ((next.longitude - position.longitude) * step) / steps,
            }));
          });
      return Promise.resolve(toRoutedPath(geometry));
    },
  };

  return { provider, calls };
}
