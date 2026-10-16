import type { AscentRepository } from '../domain/ascent-repository.ts';
import type { AscentSummary } from '../domain/ascent.ts';
import type { AscentTimeSummary, PersonalAscentTimes } from '../domain/personal-ascent-times.ts';

/** One of a Visitor's Favourite Ascents, with their own Ascent Times on it, if any. */
export interface FavouriteAscentResult {
  readonly ascent: AscentSummary;
  readonly myAscentTimes?: AscentTimeSummary;
}

/** Lists a signed-in Visitor's Favourite Ascents, most recently marked first. */
export class ListFavouriteAscents {
  constructor(
    private readonly repository: AscentRepository,
    private readonly ascentTimes: PersonalAscentTimes,
  ) {}

  async execute(visitorId: string): Promise<FavouriteAscentResult[]> {
    const favourites = await this.repository.findFavourites(visitorId);
    const summaries = await this.ascentTimes.summaries(
      visitorId,
      favourites.map((ascent) => ascent.id),
    );
    return favourites.map((ascent) => {
      const myAscentTimes = summaries.get(ascent.id);
      return myAscentTimes ? { ascent, myAscentTimes } : { ascent };
    });
  }
}
