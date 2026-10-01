import type {
  AscentRepository,
  NearbyAscent,
  NearbyCriteria,
} from '../domain/ascent-repository.ts';

export const NEARBY_DEFAULT_RADIUS = 10_000;
export const NEARBY_MAXIMUM_RADIUS = 50_000;
export const NEARBY_DEFAULT_LIMIT = 20;
export const NEARBY_MAXIMUM_LIMIT = 100;

/** Finds the Ascents whose Start is closest to a position. */
export class FindAscentsNearby {
  constructor(private readonly repository: AscentRepository) {}

  execute(criteria: NearbyCriteria): Promise<NearbyAscent[]> {
    return this.repository.findNearby(criteria);
  }
}
