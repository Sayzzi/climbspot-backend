import { randomUUID } from 'node:crypto';

import type { HttpModule } from '../../shared/http/http-module.ts';
import type { Database } from '../../shared/infrastructure/database.ts';
import { CreateAscent } from './application/create-ascent.ts';
import { MarkFavouriteAscent, UnmarkFavouriteAscent } from './application/favourite-ascents.ts';
import { FindAscentsNearby } from './application/find-ascents-nearby.ts';
import { GetAscent } from './application/get-ascent.ts';
import { GetMyAscentTimes } from './application/get-my-ascent-times.ts';
import type { Bounds } from '../../shared/domain/position.ts';
import type { ElevationProvider } from './domain/elevation-provider.ts';
import {
  noAscentTimes,
  type AscentAddedListener,
  type PersonalAscentTimes,
} from './domain/personal-ascent-times.ts';
import { registerAscentsOpenApi } from './http/ascents.openapi.ts';
import { createAscentsRouter } from './http/ascents.router.ts';
import { readGpxPath } from './infrastructure/gpx/gpx-path-reader.ts';
import { DrizzleAscentRepository } from './infrastructure/persistence/drizzle-ascent-repository.ts';
import { DrizzleFavouriteAscents } from './infrastructure/persistence/drizzle-favourite-ascents.ts';

export { OpenMeteoElevationProvider } from './infrastructure/open-meteo-elevation-provider.ts';

export interface AscentsModuleDependencies {
  readonly db: Database;
  readonly elevationProvider: ElevationProvider;
  /** Each Visitor's own Ascent Times; none by default. */
  readonly ascentTimes?: PersonalAscentTimes;
  /** Told of every Ascent added. */
  readonly onAscentAdded?: AscentAddedListener;
}

const basePath = '/ascents';

export function createAscentsModule({
  db,
  elevationProvider,
  ascentTimes = noAscentTimes,
  onAscentAdded = () => Promise.resolve(),
}: AscentsModuleDependencies): HttpModule {
  const repository = new DrizzleAscentRepository(db);
  const favourites = new DrizzleFavouriteAscents(db);
  const now = () => new Date();

  const createAscent = new CreateAscent({
    repository,
    elevationProvider,
    newId: randomUUID,
    now,
    onAscentAdded,
  });
  const getAscent = new GetAscent(repository, favourites);
  const findAscentsNearby = new FindAscentsNearby(repository, ascentTimes, favourites);
  const getMyAscentTimes = new GetMyAscentTimes(repository, ascentTimes);

  return {
    basePath,
    router: createAscentsRouter({
      createAscent,
      getAscent,
      findAscentsNearby,
      getMyAscentTimes,
      markFavouriteAscent: new MarkFavouriteAscent({ repository, favourites, now }),
      unmarkFavouriteAscent: new UnmarkFavouriteAscent(favourites),
      readGpxPath,
    }),
    registerOpenApi: (registry) => {
      registerAscentsOpenApi(registry, basePath);
    },
  };
}

/** Erases a Visitor's Favourite Ascents when their account is deleted. */
export function forgetFavouriteAscents(db: Database) {
  const favourites = new DrizzleFavouriteAscents(db);
  return {
    erase: async (visitorId: string) => {
      await favourites.forget(visitorId);
      return undefined;
    },
  };
}

/** Erases who added Ascents when a Contributor's account is deleted; the Ascents stay. */
export function forgetContributor(db: Database) {
  const repository = new DrizzleAscentRepository(db);
  return {
    erase: async (visitorId: string) => {
      await repository.forgetContributor(visitorId);
      return undefined;
    },
  };
}

/** The Ascents of the catalogue whose Start lies within a box, with their paths. */
export function ascentCatalogue(db: Database) {
  const repository = new DrizzleAscentRepository(db);
  return { startingWithin: (bounds: Bounds) => repository.findStartingWithin(bounds) };
}
