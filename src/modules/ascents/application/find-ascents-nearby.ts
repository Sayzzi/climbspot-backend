import type { Activity } from '../../../shared/domain/activity.ts';
import { surfacesAllowing } from '../domain/activity.ts';
import type {
  AscentRepository,
  NearbyAscent,
  NearbyCriteria,
} from '../domain/ascent-repository.ts';
import type { AscentTimeSummary, PersonalAscentTimes } from '../domain/personal-ascent-times.ts';
import type { Category } from '../../../shared/domain/survey/category.ts';
import type { Position } from '../../../shared/domain/position.ts';
import type { FavouriteAscents } from '../domain/favourite-ascents.ts';

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

/**
 * A nearby Ascent, with the signed-in Visitor's own Ascent Times on it, if any, and
 * whether it is one of their Favourite Ascents.
 */
export interface NearbyAscentResult extends NearbyAscent {
  readonly myAscentTimes?: AscentTimeSummary;
  readonly favourite?: boolean;
}

/** Finds the Ascents whose Start is closest to a position. */
export class FindAscentsNearby {
  constructor(
    private readonly repository: AscentRepository,
    private readonly ascentTimes: PersonalAscentTimes,
    private readonly favourites: FavouriteAscents,
  ) {}

  /**
   * @param visitorId The signed-in Visitor, whose Ascent Times and favourites are added;
   * none when signed out.
   */
  async execute(
    { activities, categories, ...search }: FindAscentsNearbyInput,
    visitorId?: string,
  ): Promise<NearbyAscentResult[]> {
    const criteria: NearbyCriteria = {
      ...search,
      // Activities are derived from Surfaces, so filtering by Activity means filtering by Surface.
      ...(activities && { surfaces: surfacesAllowing(activities) }),
      ...(categories && { categories }),
    };
    const results = await this.repository.findNearby(criteria);
    if (visitorId === undefined) {
      return results;
    }
    const ids = results.map((result) => result.ascent.id);
    const [summaries, favourites] = await Promise.all([
      this.ascentTimes.summaries(visitorId, ids),
      this.favourites.among(visitorId, ids),
    ]);
    return results.map((result) => {
      const myAscentTimes = summaries.get(result.ascent.id);
      return {
        ...result,
        ...(myAscentTimes && { myAscentTimes }),
        favourite: favourites.has(result.ascent.id),
      };
    });
  }
}
