import type { ElevationProvider } from '../src/modules/ascents/domain/elevation-provider.ts';
import type { Position } from '../src/shared/domain/position.ts';

/**
 * Length of one degree of latitude in metres, on the mean-radius sphere used by
 * the domain's geodesy (2π × 6,371,008.8 m / 360).
 */
export const METRES_PER_DEGREE_OF_LATITUDE = 111_195.08;

/** Where test terrains are anchored and where searches are made from. */
export const REFERENCE: Position = { latitude: 45, longitude: 6 };

/** Positions due north of `from`, at the given distances in metres. */
export function northOf(from: Position, ...distances: number[]): Position[] {
  return distances.map((distance) => ({
    latitude: from.latitude + distance / METRES_PER_DEGREE_OF_LATITUDE,
    longitude: from.longitude,
  }));
}

/** Evenly spaced positions due north of `from`, from 0 m to `length` m. */
export function straightNorth(from: Position, length: number, points = 11): Position[] {
  return northOf(
    from,
    ...Array.from({ length: points }, (_, index) => (length * index) / (points - 1)),
  );
}

/** Terrain whose elevation depends only on the distance north of REFERENCE. */
export function terrainRisingNorth(
  elevationAt: (metresNorth: number) => number,
): ElevationProvider {
  return {
    elevationsAt: (positions) =>
      Promise.resolve(
        positions.map((position) =>
          elevationAt((position.latitude - REFERENCE.latitude) * METRES_PER_DEGREE_OF_LATITUDE),
        ),
      ),
  };
}

/** Uniform Gradient: `gradient` metres up per metre north, starting at `base` metres. */
export function uniformGradient(gradient: number, base = 200): ElevationProvider {
  return terrainRisingNorth((metresNorth) => base + gradient * metresNorth);
}
