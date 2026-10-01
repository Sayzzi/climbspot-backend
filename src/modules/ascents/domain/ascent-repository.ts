import type { Ascent, AscentSummary } from './ascent.ts';
import type { Category } from './category.ts';
import type { Position } from './position.ts';
import type { Surface } from './surface.ts';

export interface NearbyCriteria {
  /** Where the Visitor is. */
  readonly position: Position;
  /** Metres between the position and an Ascent's Start. */
  readonly radius: number;
  readonly limit: number;
  /** When given, only Ascents with one of these Surfaces. */
  readonly surfaces?: readonly Surface[];
  /** When given, only Ascents in one of these Categories. */
  readonly categories?: readonly Category[];
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
