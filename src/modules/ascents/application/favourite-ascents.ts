import { AscentNotFoundError } from '../domain/ascent-errors.ts';
import type { AscentRepository } from '../domain/ascent-repository.ts';
import type { FavouriteAscents } from '../domain/favourite-ascents.ts';

export interface FavouriteAscentsDependencies {
  readonly repository: AscentRepository;
  readonly favourites: FavouriteAscents;
  readonly now: () => Date;
}

/** Marks an Ascent as one of a Visitor's Favourite Ascents. */
export class MarkFavouriteAscent {
  constructor(private readonly dependencies: FavouriteAscentsDependencies) {}

  /** @throws {AscentNotFoundError} when no Ascent has this id. */
  async execute(visitorId: string, ascentId: string): Promise<void> {
    const { repository, favourites, now } = this.dependencies;
    if (!(await repository.exists(ascentId))) {
      throw new AscentNotFoundError(ascentId);
    }
    await favourites.mark(visitorId, ascentId, now());
  }
}

/** Takes an Ascent out of a Visitor's Favourite Ascents, if it was one. */
export class UnmarkFavouriteAscent {
  constructor(private readonly favourites: FavouriteAscents) {}

  async execute(visitorId: string, ascentId: string): Promise<void> {
    await this.favourites.unmark(visitorId, ascentId);
  }
}
