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

/** Metres per degree of latitude on the mean Earth sphere. */
export const METRES_PER_DEGREE_OF_LATITUDE = (Math.PI * EARTH_RADIUS) / 180;

/** The position `metres` away from `from` towards `bearing` (degrees, 0 = north, 90 = east). */
export function offset(from: Position, bearing: number, metres: number): Position {
  const radians = toRadians(bearing);
  const metresPerDegreeOfLongitude =
    METRES_PER_DEGREE_OF_LATITUDE * Math.cos(toRadians(from.latitude));
  return {
    latitude: from.latitude + (metres * Math.cos(radians)) / METRES_PER_DEGREE_OF_LATITUDE,
    longitude: from.longitude + (metres * Math.sin(radians)) / metresPerDegreeOfLongitude,
  };
}

/** Initial bearing from `from` to `to`, in degrees (0 = north, 90 = east). */
export function bearingBetween(from: Position, to: Position): number {
  const dLongitude = toRadians(to.longitude - from.longitude);
  const y = Math.sin(dLongitude) * Math.cos(toRadians(to.latitude));
  const x =
    Math.cos(toRadians(from.latitude)) * Math.sin(toRadians(to.latitude)) -
    Math.sin(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.cos(dLongitude);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
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
