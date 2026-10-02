import { surfacesAllowing, type Activity } from '../domain/activity.ts';
import type {
  AscentRepository,
  NearbyAscent,
  NearbyCriteria,
} from '../domain/ascent-repository.ts';
import type { Category } from '../../../shared/domain/survey/category.ts';
import type { Position } from '../../../shared/domain/position.ts';

export const NEARBY_DEFAULT_RADIUS = 10_000;
export const NEARBY_MAXIMUM_RADIUS = 50_000;
export const NEARBY_DEFAULT_LIMIT = 20;
export const NEARBY_MAXIMUM_LIMIT = 100;

export interface FindAscentsNearbyInput {
  readonly position: Position;
  readonly radius: number;
  readonly limit: number;
  /** When given, only Ascents suitable for at least one of these Activities. */
  readonly activities?: readonly Activity[] | undefined;
  /** When given, only Ascents in one of these Categories. */
  readonly categories?: readonly Category[] | undefined;
}

/** Finds the Ascents whose Start is closest to a position. */
export class FindAscentsNearby {
  constructor(private readonly repository: AscentRepository) {}

  execute({ activities, categories, ...search }: FindAscentsNearbyInput): Promise<NearbyAscent[]> {
    const criteria: NearbyCriteria = {
      ...search,
      // Activities are derived from Surfaces, so filtering by Activity means filtering by Surface.
      ...(activities && { surfaces: surfacesAllowing(activities) }),
      ...(categories && { categories }),
    };
    return this.repository.findNearby(criteria);
  }
}
