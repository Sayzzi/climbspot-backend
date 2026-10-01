import type { Ascent, AscentSummary } from './ascent.ts';
import type { Position } from './position.ts';

export interface NearbyCriteria {
  /** Where the Visitor is. */
  readonly position: Position;
  /** Metres between the position and an Ascent's Start. */
  readonly radius: number;
  readonly limit: number;
}

export interface NearbyAscent {
  readonly ascent: AscentSummary;
  /** Geodesic distance from the searched position to the Start, in metres. */
  readonly distanceToStart: number;
}

export interface AscentRepository {
  save(ascent: Ascent): Promise<void>;
  findById(id: string): Promise<Ascent | undefined>;
  /** Ascents whose Start is within the radius, nearest first. */
  findNearby(criteria: NearbyCriteria): Promise<NearbyAscent[]>;
}
