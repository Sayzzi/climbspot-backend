/** A point on the Earth's surface, in WGS 84 decimal degrees. */
export interface Position {
  readonly latitude: number;
  readonly longitude: number;
}

/** A latitude and longitude box. */
export interface Bounds {
  readonly south: number;
  readonly west: number;
  readonly north: number;
  readonly east: number;
}
