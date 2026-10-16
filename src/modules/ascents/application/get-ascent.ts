import { AscentNotFoundError } from '../domain/ascent-errors.ts';
import type { AscentRepository } from '../domain/ascent-repository.ts';
import type { Ascent } from '../domain/ascent.ts';
import type { FavouriteAscents } from '../domain/favourite-ascents.ts';

/** An Ascent as a Visitor reads it: whether it is their favourite, when signed in. */
export interface AscentRead {
  readonly ascent: Ascent;
  readonly favourite?: boolean;
}

export class GetAscent {
  constructor(
    private readonly repository: AscentRepository,
    private readonly favourites: FavouriteAscents,
  ) {}

  /** @param visitorId The signed-in Visitor; none when signed out. */
  async execute(id: string, visitorId?: string): Promise<AscentRead> {
    const ascent = await this.repository.findById(id);
    if (ascent === undefined) {
      throw new AscentNotFoundError(id);
    }
    if (visitorId === undefined) {
      return { ascent };
    }
    const favourites = await this.favourites.among(visitorId, [id]);
    return { ascent, favourite: favourites.has(id) };
  }
}
