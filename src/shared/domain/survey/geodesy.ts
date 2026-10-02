import type { Position } from '../position.ts';

/** Mean Earth radius (IUGG), in metres. */
const EARTH_RADIUS = 6_371_008.8;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance between two positions, in metres (haversine formula). */
export function distanceBetween(from: Position, to: Position): number {
  const dLatitude = toRadians(to.latitude - from.latitude);
  const dLongitude = toRadians(to.longitude - from.longitude);
  const h =
    Math.sin(dLatitude / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(dLongitude / 2) ** 2;

  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Position at `fraction` (0–1) of the way from `from` to `to`; accurate for short segments. */
export function interpolate(from: Position, to: Position, fraction: number): Position {
  return {
    latitude: from.latitude + (to.latitude - from.latitude) * fraction,
    longitude: from.longitude + (to.longitude - from.longitude) * fraction,
  };
}

/** Length of a path along its positions, in metres. */
export function lengthOf(path: readonly Position[]): number {
  let length = 0;
  for (const [index, position] of path.entries()) {
    const previous = path[index - 1];
    if (previous !== undefined) {
      length += distanceBetween(previous, position);
    }
  }
  return length;
}
